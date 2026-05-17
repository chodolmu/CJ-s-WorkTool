---
name: gmk-loop
description: Run one Plan → Build → Validate → Integrate cycle for the active milestone. Single-pass dispatcher that delegates to existing skills (gmk-task-split, gmk-prototype, gmk-validate, gmk-self-test, gmk-merge-gate, gmk-port). Use when the user says "/gmk-loop", "run the loop", "next iteration", or wants the kit to drive one full cycle on the current milestone. Max one iteration per call — refuses to auto-recurse.
model: sonnet
---

# gmk-loop — One Plan/Build/Validate/Integrate cycle, supervised

This is the **supervisor** for a single milestone cycle. It dispatches to other skills in sequence and stops at each gate. It does not run autonomously, it does not retry, it does not recurse.

The point: when the user says *"just do the next thing,"* `/gmk-loop` figures out which gate they're at and runs **one step**. The user owns advancing to the next.

## Why one-iteration-max

The kit deliberately rejects multi-step autonomous loops. Two reasons:

1. **Cost incidents** — the Anthropic Cursor pattern of $47K agent runaways happened in setups where one agent could loop on its own validators. Single-pass + user-gated keeps the kit out of that category.
2. **Honest evaluation** — between each gate, the user's brain is the highest-leverage validator. Auto-advancing past PASS deprives the user of a decision point that's cheap for them and impossible for the model.

If the user wants `/gmk-loop` to run twice, they invoke it twice. The kit does **not** auto-recurse.

## The four gates

```
   ┌──────────────────┐
   │  Plan            │  (gates: hypothesis exists, tasks split)
   │  - gmk-prototype │
   │  - gmk-task-split│
   └────────┬─────────┘
            ↓
   ┌──────────────────┐
   │  Build           │  (gates: HTML prototype exists, hook works)
   │  - user writes   │
   │  - gmk-mock-inject (optional)│
   └────────┬─────────┘
            ↓
   ┌──────────────────┐
   │  Validate        │  (gates: bot PASS, self-test PASS)
   │  - gmk-validate  │
   │  - gmk-self-test │
   └────────┬─────────┘
            ↓
   ┌──────────────────┐
   │  Integrate       │  (gates: merge-gate PASS, port RE_PASS)
   │  - gmk-merge-gate│
   │  - gmk-port      │
   └──────────────────┘
            ↓
        🏁 milestone shipped (dev-complete)
```

`/gmk-loop` figures out which gate the active milestone is at and runs one step.

## Preconditions

1. **A clearly active milestone exists.** If multiple are active, the user must pick: *"Active milestones: m2, m3, m4. Which should this loop iteration target?"*
   - **Heuristic for picking the default** when only the user is ambiguous: highest position in `roadmap.md` order that isn't shipped/killed.
2. **`pillars.json` exists.** (Plan stage requires it.)
3. **No global lock file.** If `.gamemaker-kit/.loop.lock` exists, check `started_at` and `pid` (lock file format: `{"started_at": "<iso>", "pid": <int>, "host": "<name>"}`).
   - If `started_at` is **> 60 minutes ago**, treat the lock as stale and auto-clear it. Print *"Cleared stale loop lock (started_at {timestamp}, > 60 min ago)."* and proceed.
   - If `started_at` is recent and `pid` is alive on the same host, refuse: *"Another loop is in progress (PID {pid}, started {timestamp}). Wait for it, or if you're sure it's stuck, delete `.gamemaker-kit/.loop.lock` manually."*
   - If `started_at` is recent but `pid` is dead or unreachable, auto-clear with a note.

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard) follow `gmk-prototype-rules` Rule 13-14._

## Flow

### Step 1 — Take the lock

Write `.gamemaker-kit/.loop.lock` with `{ started_at, milestone_id, step }`. Release on exit (success or failure). This prevents two concurrent `/gmk-loop` calls from stepping on each other in multi-window sessions.

### Step 2 — Determine the current gate

Read the active milestone. The gate is the **earliest stage with a failing or missing precondition**.

| Gate | Indicator the milestone is here |
|---|---|
| **Plan**: hypothesis missing | `hypothesis.if` or `hypothesis.then` or `hypothesis.measured_by` is empty/null |
| **Plan**: tasks not split | `tasks` is missing or empty |
| **Build**: prototype missing | `prototype: null` or file does not exist |
| **Build**: hook broken | running gmk-validate smoke check fails on `__gmk_botHook__` |
| **Validate**: bot not run | `validation: null` or last verdict missing |
| **Validate**: bot FAIL | last `validation.verdict === 'FAIL'` |
| **Validate**: bot INCONCLUSIVE | last `validation.verdict === 'INCONCLUSIVE'` |
| **Validate**: self-test missing | `validation.verdict === 'PASS'` but `self_test` is null/empty |
| **Validate**: self-test FAIL or NEEDS_MORE_PLAY | last self-test verdict isn't PASS |
| **Integrate**: merge-gate not run | bot+self_test PASS but `merge_gate` is null |
| **Integrate**: merge-gate FAIL | `merge_gate.verdict === 'FAIL'` |
| **Integrate**: port missing | merge-gate PASS but `ported_to` is null |
| **Integrate**: port RE_FAIL or NEEDS_TUNING | last port verdict isn't `RE_PASS` |
| **Shipped** | all of above PASS |

Print the gate detection to the user:

```
Active milestone: m2-dragon-evo
Current gate: Validate → bot not run yet

Next step (this iteration): /gmk-validate m2-dragon-evo
Proceed?
```

### Step 3 — Confirm

Wait for explicit user confirmation. **Always confirm before invoking the next skill** — the loop is the user's hands, not autopilot.

If the user wants to skip a gate ("I already ran the bot manually, skip to self-test"), accept but warn: *"Skipping bot validation means later gates can't reference its metrics. If `validation` is null, gmk-port can't compare HTML metrics in stage 4."*

### Step 4 — Dispatch ONE skill

Run exactly one downstream skill based on the gate:

| Gate | Skill to dispatch | Notes |
|---|---|---|
| Plan: hypothesis missing | `/gmk-prototype <milestone>` | The prototype skill prompts for hypothesis if missing |
| Plan: tasks not split | `/gmk-task-split <milestone>` | |
| Plan: system spec needed (≥3 systems or ≥4-state machine in design-system.md) | `/gmk-design-system <milestone>` THEN recommend `@systems-designer <milestone>` | The agent's strict spec lands `system-spec.md` which gmk-port Stage 1 will need anyway |
| Build: prototype missing | Stop and tell the user to write it (this is a *human* task — `/gmk-prototype` produces the *spec*, but a real prototype often needs the user to iterate on the HTML by hand) | |
| Build: hook broken | Stop. Tell the user to fix the hook; point at `gmk-prototype-rules` for the API spec | |
| Validate: bot not run / FAIL / INCONCLUSIVE | `/gmk-validate <milestone>` | Bot is rerun (FAIL/INCONCLUSIVE → user may want to fix the prototype first; ask) |
| Validate: bot FAIL (crash/dominant/persona) | After `/gmk-validate` produces FAIL, surface its Step 8.5 agent route — typically `@playtest-analyst <milestone>` | Loop doesn't auto-invoke the agent; it surfaces the route the validate skill already prepared |
| Validate: self-test missing / FAIL | `/gmk-self-test <milestone>` | |
| Validate: self-test FAIL (sensory) | Surface self-test Step 8.5 route — `@feel-engineer <milestone>` for sensation-word notes, `@playtest-analyst <milestone>` otherwise | Same — agent is recommended, never auto-invoked |
| Integrate: regression drift / REGRESSION | `/gmk-regression` THEN surface `@playtest-analyst` route for drift > 25% or PASS→FAIL | |
| Integrate: merge-gate not run / FAIL | `/gmk-merge-gate <milestone>` | |
| Integrate: port missing / RE_FAIL | `/gmk-port <milestone>` | |
| Integrate: port NEEDS_TUNING | Surface port Stage 6 route — `@feel-engineer` or `@economy-balancer` based on the user's `--reason` text | |
| Shipped (this milestone) | Print: *"m2-dragon-evo is dev-complete. Next: pick another milestone (`/gmk-status`) or, if this was the last one, run `/gmk-dev-complete` for the project-level release-readiness checkpoint."* | The project-level release-readiness checkpoint (`gmk-dev-complete`) is a separate SKILL — see Wave B |

**Dispatch is not auto-execution.** Surface the skill name and let the user invoke it. If the user wants the loop to *actually run* the next skill, the next iteration of `/gmk-loop` will do it (after the user confirms again).

_When surfacing an agent route, the output follows `gmk-prototype-rules` Rule 15 (agent routing block format)._

### Step 5 — On the dispatched skill's completion

The downstream skill writes its own state (validation result, port checklist, etc.). `/gmk-loop` reads the updated state and prints:

```
Step complete: /gmk-validate m2-dragon-evo
Verdict: PASS

New gate: Validate → self-test missing

Suggested next: /gmk-self-test m2-dragon-evo (or run /gmk-loop again)
```

Then **release the lock and exit**. Do not auto-advance to the next gate.

### Step 6 — Release the lock

Delete `.gamemaker-kit/.loop.lock`. Always — on success, on user abort, on dispatched skill failure.

## Safety: why no auto-recursion

| Risk | Mitigation |
|---|---|
| Cost runaway | `max-iteration = 1` per invocation. The user calls the loop again to advance. |
| Validator/builder feedback cycle | gmk-loop dispatches; it does not validate the validator. Only `playtest-analyst` agent verifies, and only in single direction. |
| Lost user judgment between gates | Confirm before every dispatch. User is the supervisor of the supervisor. |
| Lock leak | Lock has `started_at`; if `> 1 hour` and user manually deletes, that's their call. |
| Wrong milestone targeted in multi-active state | Refuse to default — ask the user. |

The loop never:
- Calls itself recursively
- Calls a skill that calls back into `/gmk-loop`
- Auto-confirms a dispatch
- Skips a gate based on heuristics (only on explicit user instruction)

## Edge cases & policy

### User invokes `/gmk-loop` with no active milestones

```
No active milestones. Either:
  - All milestones are shipped or killed → /gmk-roadmap to plan new ones
  - No milestones exist yet → /gmk-roadmap or /gmk-prototype to start

The loop has nothing to dispatch.
```

### Active milestone is killed

```
The active milestone m2-dragon-evo is KILLED. The loop won't dispatch.
Either:
  - Revive: /gmk-kill-milestone m2-dragon-evo --revive
  - Pick a different milestone via /gmk-status
```

### Multiple active milestones, user doesn't pick

Don't guess. Show all and ask. *"Three active milestones — m2, m3, m4. Which one is this iteration about?"* Don't default to the lowest-numbered.

### User says "just do the whole cycle"

Refuse:

> *"The loop runs **one** gate per call. There's no auto-run-to-completion. Reasons (1) the user gate between Validate and Integrate is the user's own playthrough — the kit can't fake that, (2) running multi-stage without confirmation is the failure mode that produces $47K LLM bills. Run `/gmk-loop` once per gate."*

### User wants to skip a gate

Accept, but warn what later gates will lose:

| Skipped gate | What breaks downstream |
|---|---|
| Skip bot validation | Port stage 4 (metric diff) has no HTML baseline |
| Skip self-test | Merge-gate runs but the "is this fun" gate is unverified |
| Skip merge-gate | Port may proceed against unscanned secrets/regressions |
| Skip port | Milestone never reaches dev-complete |

Don't refuse — the user knows their tradeoffs. Set `forced: true` on the relevant downstream record if it accepts a `forced` flag.

### Dispatched skill returns FAIL or INCONCLUSIVE

`/gmk-loop` reads the result, prints the new gate (which is now "Validate: bot FAIL"), and **stops**. It does not auto-fix, auto-revise, or auto-retry. The user decides: fix the prototype, kill the milestone, or rerun with different config.

### Stale lock

If `.gamemaker-kit/.loop.lock` exists with `started_at` more than 1 hour old:

```
Found a stale loop lock (started {timestamp}, {duration} ago).
  Likely cause: previous /gmk-loop crashed or was interrupted.
  Action: delete `.gamemaker-kit/.loop.lock` manually if you're sure no other session is running, then retry.
```

Don't auto-delete. The lock is a safety contract; auto-clearing it defeats the purpose.

## What this skill does NOT do

- **Doesn't auto-recurse.** One gate per call. The user is the recursion.
- **Doesn't run multiple skills in one invocation.** Even if Plan-stage tasks (gmk-prototype + gmk-task-split) feel like one logical unit, the loop runs them as separate iterations.
- **Doesn't auto-invoke domain agents.** The dispatch table *surfaces* agent routes that downstream skills (gmk-validate, gmk-self-test, gmk-regression, gmk-port) already prepared. The user invokes `@feel-engineer` / `@economy-balancer` / `@systems-designer` / `@playtest-analyst` themselves. Reasoning: agents have `max-iteration=1` and require user-supervised input; auto-invocation from a dispatcher would violate the single-supervisor model.
- **Doesn't validate validators.** Only `playtest-analyst` agent does that, and only single-direction.
- **Doesn't track milestone *between* loops.** Each call re-reads `milestones.json` fresh. Stateful between calls = bugs.
- **Doesn't write to `milestones.json` itself** — downstream skills do that. The loop just orchestrates the order.
- **Doesn't compose with `/gmk-validate --watch` or similar long-running modes.** Those don't exist; the kit doesn't have them.
- **Doesn't suggest skill arguments beyond the milestone ID.** The user passes their own flags (`--policy mcts`, etc.) to the dispatched skill in the next call.

## Notes for the model running this skill

- **One gate, one call. That's the entire skill.** If you find yourself reasoning about "after the bot passes I'll then..." — stop, that's the *next* iteration.
- **Confirm verbosely.** The user should know exactly what the kit is about to dispatch and what state will change. "Run /gmk-validate m2-dragon-evo?" — short and explicit.
- **Don't infer the user's intent.** If they say "next step," ask which milestone. If they say "do everything," refuse the everything part.
- **Read the gate from current state every time.** Don't cache between calls; the user might have hand-edited milestones.json.
- **If the user wants automation**, they're really asking for a separate higher-level tool (a daemon, a scheduled job). gmk-loop is *not* that tool — it's a single-step dispatcher. Tell them so: *"The loop is one step per call by design. If you want unattended automation, gmk isn't where that lives — but you'd typically schedule `/gmk-status` and decide based on output."*
- **The lock is load-bearing.** Don't skip it even for "quick" calls. Concurrent loop runs corrupt milestones.json easily.
- **Gates are about state, not about what's interesting.** A milestone that's at "Validate: bot PASS, self-test missing" is at the self-test gate even if the user *wants* to skip to port. State first, user wish second.
