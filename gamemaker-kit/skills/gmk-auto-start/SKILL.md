---
name: gmk-auto-start
description: Run the auto-mode preflight contract — verify Claude CLI flags, git base safety, single-instance lock, and milestone eligibility — then write `.gamemaker-kit/auto/auto-state.json` and tell the user the exact OS command to launch `scripts/auto-runner.js`. Use when the user says "/gmk-auto-start", "야간 자율 루프 시작", "auto-mode 시작", "overnight run preflight", or wants to schedule a night-long bot+patch loop. This is the **only** auto-mode entrypoint that runs inside a Claude Code session — the actual runner is an OS-level Node process, not a SKILL.
model: opus
---

# gmk-auto-start — Preflight, then hand the runner to the OS

This skill is the **control-plane door** to auto-mode. It does **not** iterate, it does **not** spawn the runner itself, and it does **not** invoke Claude inside the loop. Auto-mode lives at OS level (`node scripts/auto-runner.js`) because Claude Code's 5-hour session limit and lack of a built-in scheduler make in-session overnight loops structurally impossible.

What this skill does:
1. Runs four preflight checks. If any check fails, refuses to start and prints exactly which check + how to fix it.
2. On success, writes `.gamemaker-kit/auto/auto-state.json` with `phase: "preflight_ok"` and the resolved configuration.
3. Prints the exact OS command (or Task Scheduler entry) the user should run, then exits.

After this skill exits, the user is responsible for launching `node scripts/auto-runner.js` themselves (manually, or via Windows Task Scheduler / cron). The runner reads `auto-state.json` and takes over.

## Why this split

A Claude Code SKILL cannot survive the session that called it. If `/gmk-auto-start` itself launched the runner as a subprocess, killing the Claude session would orphan or kill the runner. The clean separation — SKILL writes state, OS scheduler runs the loop — means the runner outlives the Claude session and survives the user closing their laptop's terminal window.

This is the same pattern as `git push` (a one-shot command) vs `git daemon` (a long-lived OS process). The kit's SKILLs are `git push`. `scripts/auto-runner.js` is `git daemon`.

## Preconditions (the four checks, in order)

Each check has a single fail message and a single fix path. **No check is bundled.** If multiple checks fail, the skill stops at the first failure — fix it, retry, see the next one. This avoids the v0.4-style "huge failure dump" anti-pattern.

### Check (a) — Claude CLI flag probe

Verify the user's `claude` CLI exposes the four flags auto-runner requires. Without these, the runner cannot invoke Claude as a stateless worker with budget cap.

**Procedure:**
1. Run `claude --version`. Capture output. If exit code is non-zero or output doesn't match `MAJOR.MINOR.PATCH (Claude Code)`, fail with:
   > *"Couldn't run `claude --version`. Auto-mode needs the Claude Code CLI on PATH. Install / fix the CLI, then retry."*
2. Run `claude -p --help`. Capture stdout.
3. Confirm all four flags appear as literal substrings in the help text:
   - `--max-budget-usd`
   - `--output-format`
   - `--allowedTools`
   - `--session-id`
4. If any flag is missing, fail with:
   > *"Claude CLI version `{version}` is missing the flag `{flag}`. Auto-runner needs all four of {--max-budget-usd, --output-format, --allowedTools, --session-id}. Update the Claude Code CLI and retry."*
5. Record `cli_flags.ok = true`, `cli_flags.claude_version`, `cli_flags.flags_found[]`, `cli_flags.flags_missing = []` in `auto-state.json`.

This check is the auto-mode equivalent of Rule 16 (`kit_version` read contract — `gmk-prototype-rules` §Rule 16) but for the *Claude binary* rather than the kit schema. Plugin schemas are additive (warn-only); CLI flags are not (hard-fail), because a missing flag breaks the runner's only execution mechanism.

### Check (b) — Git base protection

Verify the project's git state is safe to branch off. Auto-mode commits every accepted patch to `auto-night-<date>` branches, never main; that branching strategy assumes a clean known base.

**Procedure:**
1. Run `git status --porcelain`. If output is non-empty, fail with:
   > *"Working tree has uncommitted changes. Auto-mode branches off the current HEAD; uncommitted files would either be lost (if `git stash` is used silently) or accidentally committed to `auto-night-<date>`. Commit or stash explicitly, then retry."*
2. Run `git rev-parse --abbrev-ref HEAD`. Check against the branch allowlist (default: `["main"]`). If the current branch is not allowlisted:
   - If the user passed `--allow-current-branch`, record `git_base.user_override_recorded = true` and continue.
   - Otherwise fail with:
     > *"Current branch is `{branch}`. Auto-mode defaults to branching off `main` only — running it from a feature branch can produce surprising base states. Either checkout main, or rerun with `/gmk-auto-start --allow-current-branch` to acknowledge."*
3. Run `git rev-list --left-right --count @{upstream}...HEAD` (if upstream exists). If the right side (local-ahead-of-remote) is > 0, warn — *don't fail*:
   > *"Heads up: you have {n} unpushed commit(s) on `{branch}`. Auto-mode will still branch off HEAD (including these commits). If the run produces a patch you want to revert and these commits move, history can get confusing. Push or note this before continuing."*
   Wait for user confirmation, then continue.
4. Record `git_base.ok = true`, `git_base.current_branch`, `git_base.porcelain_clean = true`, `git_base.unpushed_commits` in `auto-state.json`.

The branch allowlist matches the safety pattern of Rule 14 (refuse-chain cycle guard — `gmk-prototype-rules` §Rule 14): a small, audit-able set of known-good states; everything else requires explicit opt-in.

### Check (c) — Single-instance lock

Verify no other runner is already active. Two concurrent runners would race on `auto-state.json` and `auto-patches/` and produce undefined merge behavior.

**Procedure:**
1. Check for `.gamemaker-kit/auto/runner.lock`. If absent, record `runner_lock.previous_lock = null`, `runner_lock.ok = true`, and continue.
2. If present, parse it (see `_workspace/examples/auto-runner-lock-example.json`). Compute `now - heartbeat_at` in minutes:
   - **Active (≤ 5 min)** — fail with:
     > *"Another auto-runner is active: PID `{pid}` on host `{host}`, started `{started_at}`, last heartbeat `{heartbeat_at}` ({age}). Stop it cleanly with `/gmk-auto-stop` first, or wait for it to finish. Do **not** delete the lock manually unless you're sure no process holds it."*
   - **Stale (> 5 min, same host, PID dead)** — auto-clear, log:
     > *"Cleared stale runner lock (PID `{pid}` on `{host}`, no heartbeat since `{heartbeat_at}` / `{age}` ago, PID not alive). Proceeding."*
     Record `runner_lock.previous_lock = {full prior lock content}`, `runner_lock.stale_reason = "heartbeat-expired-pid-dead"`, `runner_lock.ok = true`, and continue.
   - **Stale (> 5 min, different host)** — refuse:
     > *"Stale lock from host `{host}` (not this machine: `{this_host}`). Auto-mode is single-machine by design; the other host may still be running. Manually delete `.gamemaker-kit/auto/runner.lock` after confirming the other machine isn't active."*
3. Liveness check: on Windows use `tasklist /FI "PID eq {pid}"`, on POSIX use `kill -0 {pid}`. Treat unknown OS as "PID dead" and follow the stale-clear path.

This check is the auto-mode counterpart of `gmk-loop`'s `.gamemaker-kit/.loop.lock`, with two differences: (1) lock includes `heartbeat_at` (gmk-loop only had `started_at`), so we can detect *running-but-stuck* runners separately from *crashed* runners; (2) the lock is read by **both** the SKILL preflight and the runner itself on startup, so concurrent SKILL invocations also serialize.

### Check (d) — Milestone eligibility

Verify the target milestone passes the **anti-D-013 gate**. Auto-mode running on a milestone with a degenerate hypothesis (bot PASS that masks an empty mechanic) will amplify the false positive — the runner will "improve" metrics that were never validly measuring anything.

**Procedure:**
1. Resolve the target milestone from the user's argument: `/gmk-auto-start --milestone <id>`. If missing, fail with the list of available IDs.
2. Read the milestone entry from `.gamemaker-kit/milestones.json`. If `killed === true`, fail:
   > *"Milestone `{id}` is killed. Auto-mode does not operate on killed milestones. Revive with `/gmk-kill-milestone {id} --revive`, or pick a live milestone."*
3. **Eligibility rule (the load-bearing check):** at least **one** of the following must be true. If neither, fail:
   - **Path A: human self-test PASS** — `milestone.self_test.latest_verdict === "PASS"` AND `milestone.self_test.latest_session_at` is within the last 30 days.
   - **Path B: mechanic-density sanity** — `milestone.validation.verdict === "PASS"` AND **all four** of the following hold:
     - `validation.metrics.dominant_strategy_ratio >= 0.05` (not "no strategy at all" — D-013 floor)
     - `validation.metrics.dominant_strategy_ratio <= 0.60` (not "single forced strategy" — gmk-validate PASS ceiling)
     - `validation.metrics.action_entropy >= 0.5` (bots aren't doing one literal thing)
     - `validation.metrics.state_coverage` is not `null` AND `>= 3` (mechanic produces distinct states)
4. If both paths fail, fail with the specific reason:
   > *"Milestone `{id}` is not eligible for auto-mode. Reason: {self_test_reason} AND {density_reason}. The kit's dogfood discovered D-013: bot PASS on a milestone with no real decision (dominant_strategy ≈ 0, state_coverage ceiling) produces a false PASS that auto-mode would amplify. Run `/gmk-self-test {id}` to validate the mechanic is non-empty, then retry."*
5. Record `milestone_eligibility.ok = true`, `milestone_eligibility.self_test_verdict`, `milestone_eligibility.mechanic_density_score = { dominant_strategy_ratio, action_entropy, state_coverage }`, `milestone_eligibility.blocked_reason = null`.

**Why this check is here, not in the runner:** the runner runs unsupervised. The cheapest place to surface a degenerate hypothesis is in the user's interactive session, before the runner even starts. Catching it post-hoc in the morning report means a wasted night.

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard, kit_version read contract, pillars.kind read contract) follow `gmk-prototype-rules` Rule 13-14, 16, 17._

## Flow

### Step 1 — Parse arguments

Accept:
- `--milestone <id>` (required) — the milestone the runner will iterate on
- `--budget-usd <amount>` (default: 5.00) — hard cap, passed verbatim to `claude -p --max-budget-usd`
- `--max-hours <n>` (default: 4) — wall-clock cap, runner self-enforces
- `--allow-current-branch` (default: false) — opt-in for Check (b) branch allowlist override

Reject unknown flags. Echo the resolved config back to the user before checks.

### Step 2 — Run the four preflight checks, in order

Stop at the first failure. Print the fail message verbatim, exit with non-zero. Each check's result is recorded in `auto-state.json` regardless of pass/fail — failures are inspectable post-hoc.

### Step 3 — On all four PASS, write state

Write `.gamemaker-kit/auto/auto-state.json`:
- `phase: "preflight_ok"`
- `preflight.{cli_flags, git_base, runner_lock, milestone_eligibility}.ok = true`
- `target.{milestone_id, project_root}`
- `budget.{usd_cap, max_hours, started_at}`
- `runner.{pid: null, host, branch: null, heartbeat_at: null}` (runner fills these on startup)

Use the atomic write-temp-then-rename pattern. Do **not** write `runner.lock` here — that's the runner's job on startup.

### Step 4 — Print the OS command and stop

Print exactly:

```
Preflight PASS for milestone `{milestone_id}`.

Budget cap: ${budget_usd} | Max wall: {max_hours}h | Target branch: auto-night-{date}

Run the runner now in a new terminal:

    node scripts/auto-runner.js

The runner will read .gamemaker-kit/auto/auto-state.json and take over.

To stop cleanly mid-run: /gmk-auto-stop (sets stop_requested; runner exits at the next checkpoint).
To check progress: /gmk-auto-status
To review the morning report: /gmk-auto-report
```

Optionally, on Windows, surface a one-liner that registers a Task Scheduler entry — but as a *suggestion*, not an auto-action. The user owns scheduling decisions.

## What this skill does NOT do

- **Doesn't launch the runner.** The user types `node scripts/auto-runner.js` themselves. (Reason: SKILL outlives no Claude session; runner must outlive the Claude session.)
- **Doesn't invoke `claude -p`.** That's the runner's job, per work unit.
- **Doesn't write to `milestones.json`.** Read-only on canonical state.
- **Doesn't auto-clear locks from other hosts.** Single-machine by design.
- **Doesn't accept `--force` on the four checks.** Each check has a specific opt-in (e.g., `--allow-current-branch`); there is no blanket override. Reason: the four checks defend against the exact failure modes that produce wasted overnight runs.

## Refusal patterns (Rule 13-14)

If the user runs `/gmk-auto-start` without any argument: list available milestone IDs, refuse with *"Pick one with `--milestone <id>`."*

If the user runs it while preflight has previously failed at Check (a) (CLI version): refuse re-running until the CLI is updated. `[Rule 14] /gmk-auto-start → CLI flag missing — no satisfiable precondition from current state without CLI update.`

If the user wants to skip preflight entirely: refuse. *"Preflight exists because the kit's dogfood already paid for the lesson it encodes (D-013). There is no `--skip-preflight`. If a check is wrong, fix the check — don't bypass it."*

## Notes for the model running this skill

- **One failed check, one message, stop.** Don't bundle. Don't try to be helpful by listing what *would* have failed next — that information is wrong (the user might fix check A and check B turns out fine).
- **Print probe output verbatim when failing.** `claude --version` output, `git status --porcelain` output, the lock file's JSON. Don't paraphrase — the user needs the raw signal to debug.
- **Do not invoke `node scripts/auto-runner.js` yourself.** Even if the user explicitly asks. The Claude session must not be the runner's parent process.
- **The eligibility check is the most likely to be wrong.** If the user keeps hitting Check (d) on a milestone they believe is real, that's a signal the kit's mechanic-density heuristic needs revision — log it in the morning incident report category `eligibility-may-be-too-strict`.
