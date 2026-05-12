---
name: gmk-share
description: Deploy a validated prototype to the public web (GitHub Pages by default, itch.io optional) so testers can play it from a link. Refuses to deploy prototypes that haven't passed /gmk-validate. Outputs a single shareable URL plus a feedback-collection prompt the user can paste to testers. Use when the user says "/gmk-share <name>", "deploy prototype", "share to itch", "테스터한테 보내기", or wants to put a milestone in front of humans. Run AFTER /gmk-validate has marked the milestone PASS.
model: haiku
---

# gmk-share — Get the link, send the link

The job here is small and dumb on purpose: **take an HTML file, put it behind a URL, return that URL.**

The kit's value isn't in deployment cleverness; it's in the discipline of only deploying validated prototypes. So this skill's main feature is the **gate**, not the upload.

## Preconditions

Stop with a clear message if any fails:

1. **Milestone exists.** Read `.gamemaker-kit/milestones.json`, find entry where `id === <name>`. If missing: list available milestone IDs and stop.
2. **Prototype file exists.** Path from the milestone's `prototype` field. If missing: stop.
3. **Validation passed.** The milestone's `validation.verdict` must be `"PASS"`.
   - If `null`: *"This milestone hasn't been validated yet. Run /gmk-validate <name> first — sharing a prototype no bot has stress-tested wastes tester goodwill."*
   - If `"FAIL"`: *"Last validation FAILED. The bot found {short reason from validation.metrics}. Fix the prototype and re-validate, or kill the milestone."*
   - If `"INCONCLUSIVE"`: *"Last validation was INCONCLUSIVE — {reason from validation}. You can override with /gmk-share <name> --force, but the bot is telling you something. Read the validation report first."*
   - If `--force` flag is passed by the user, accept the override but stamp the deploy with `forced: true` so the audit trail records it.

## Flow

### Step 1 — Pick the deployment target

Read `.gamemaker-kit/share-config.json` if it exists, otherwise ask:

```
Where should this go?
  1. GitHub Pages       — free, fast, zero account setup beyond `gh` CLI
  2. itch.io            — public game discovery, requires `butler` CLI + API key
  3. Local file server  — `python -m http.server`, link is your LAN IP (testing only)
```

Default to **GitHub Pages** if the user is unsure. Reasons:
- The `gh` CLI is already installed in this environment (Claude Code default).
- No separate account/API token to configure on first use.
- itch.io is better for discovery once a milestone is real, but most prototypes never get there — don't make the user configure butler for a milestone that might be killed in two days.

Save the choice to `.gamemaker-kit/share-config.json` so subsequent shares don't re-ask:

```json
{
  "default_target": "github-pages",
  "github_pages": {
    "repo": "user/zoomerge-prototypes",
    "branch": "gh-pages",
    "subdir": "prototypes"
  },
  "itch": {
    "user": "chodol",
    "project_slug": "zoomerge"
  }
}
```

### Step 2a — GitHub Pages deploy

If target is `github-pages`:

1. **Resolve the repo.** Read `share-config.github_pages.repo`. If unset, ask: *"Which GitHub repo should host the prototype links? (format: `user/repo`. I'll use the `gh-pages` branch.)"*
   - If the repo doesn't exist, offer to create it: `gh repo create <repo> --public --description "gamemaker-kit prototypes"`.
   - Don't push to a private repo for prototype sharing — testers can't access. If user says private, refuse: *"Private repos can't serve Pages to testers without auth. Use a public repo for prototypes; the URLs are obscure and unindexed by default."*
2. **Set up the branch.** Use `gh api` to ensure `gh-pages` branch exists and Pages is enabled on it. Idempotent — safe to re-run.
3. **Copy the prototype.** Clone or `git fetch` the gh-pages branch into a temp dir, drop `prototypes/<name>.html` into `prototypes/<name>-<short-sha>.html` (sha = first 8 chars of SHA-256 of the file content), commit, push.
   - Why content-hashed filename: the same `<name>` may be re-shared after edits. Hashing prevents browser/CDN caching of the old version, and the latest URL always points to current bytes.
4. **Build the link.**
   - Format: `https://<user>.github.io/<repo>/prototypes/<name>-<sha>.html`
   - Confirm the page is reachable (`curl -sI`, expect 200) before printing it. GitHub Pages can take 30-90s on first deploy; poll up to 2 minutes with a `[share] waiting for Pages: 30s/120s` line every 30s.
5. **Save the deploy record** to the milestone (Step 4 below).

### Step 2b — itch.io deploy

If target is `itch`:

1. **Check for butler.** `butler -V`. If missing: *"itch.io deploys need butler. Install: https://itch.io/docs/butler/installing.html — set butler API key with `butler login`. Then re-run /gmk-share."* Stop.
2. **Resolve project slug.** Format `user/project:channel`. Channel = `prototype-<name>`. Each milestone gets its own channel, so testers can switch between milestones inside one itch project.
3. **Push.** Wrap the single HTML file into a folder (itch wants a folder, not a loose file): `<tmpdir>/<name>/index.html`. Run:
   ```
   butler push <tmpdir>/<name> <user>/<project>:prototype-<name> --userversion <YYYYMMDDHHMM>
   ```
4. **Build the link.** `https://<user>.itch.io/<project>` — note that itch hides the channel from the URL; testers see the most recent channel by default, which is fine for prototype iteration. If the user has multiple active milestones on one project, warn them: *"Latest push wins on itch. If you're A/B testing two milestones, GitHub Pages is better — every milestone has its own URL."*

### Step 2c — Local file server (LAN testing)

If target is `local`:

1. Pick a port (default 8765). Confirm it's free.
2. Spawn `python -m http.server 8765` in the prototypes/ directory as a background process. Tell the user it's running.
3. Get the LAN IP: `ipconfig` (Windows) or `ifconfig` / `ip addr` and grab the first non-loopback IPv4.
4. Print: `http://<lan-ip>:8765/<name>.html` plus a warning: *"This link only works on your local network. Stop the server with Ctrl+C in the terminal when done. For real testers, use GitHub Pages."*

This option is rarely the right choice; offer it last.

### Step 3 — Build the tester message

After successful deploy, draft a short message the user can paste into Discord/iMessage/Slack/etc. The message contains:

- The link.
- A 1-sentence framing of what to look for, derived from the hypothesis's *human* row(s).
- A nudge to capture specific reactions, not vague "did you like it" feedback.
- A pointer to where the user wants feedback to land (ask once, save to share-config).

Example output (for a milestone with hypothesis row `"3 of 5 testers spontaneously say 'satisfying'"`):

```
Hey — quick prototype, 5 minutes. No setup, just open in any browser:

  <link>

Specifically curious if you find yourself saying anything out loud while
playing — what words come up. Especially in the first 60 seconds.

If you can paste back even a one-liner of "this is what I felt" I owe
you a coffee. — <user-name>
```

The model should:
- Pull the human-row metric verbatim from `hypothesis.measured_by` to write the "specifically curious" line.
- Keep it under 6 lines. Testers don't read long asks.
- Not write "give me feedback" — write "tell me what words came up." Specific prompts get specific responses.

Don't auto-send the message anywhere. Print it for the user to copy.

### Step 4 — Write back to `milestones.json`

Update the milestone entry with a `share` block:

```json
{
  "id": "m1-merge-feel",
  "share": {
    "deployed_at": "2026-05-09T14:18:00Z",
    "target": "github-pages",
    "url": "https://chodol.github.io/zoomerge-prototypes/prototypes/m1-merge-feel-a1b2c3d4.html",
    "content_sha": "a1b2c3d4...",
    "forced": false,
    "history": []
  }
}
```

If a previous share exists, push the old `share` (minus `history`) into `history: [...]` and replace the top-level `share` with the new one. Most recent always at the top level.

### Step 5 — Print the deploy report

```
m1-merge-feel — DEPLOYED

  Target  : GitHub Pages
  URL     : https://chodol.github.io/zoomerge-prototypes/prototypes/m1-merge-feel-a1b2c3d4.html
  Content : a1b2c3d4 (re-share will produce a new URL if you edit the prototype)

Tester message (copy/paste):

  Hey — quick prototype, 5 minutes. No setup, just open in any browser:

    https://chodol.github.io/zoomerge-prototypes/prototypes/m1-merge-feel-a1b2c3d4.html

  Specifically curious if you find yourself saying anything out loud while
  playing — what words come up. Especially in the first 60 seconds.

  If you can paste back even a one-liner of "this is what I felt" I owe
  you a coffee.

Next:
  /gmk-feedback m1-merge-feel  — paste tester replies, get thematic coding +
                                 hypothesis pass/fail on the human rows.
```

## Edge cases & policy

### Re-sharing after editing the prototype

User edits `prototypes/<name>.html`, runs `/gmk-share <name>` again. The skill:
1. Re-validates? **No.** Validation is a separate step. But: if the file has changed since the last `validation.ran_at`, warn: *"You've edited the prototype since the last validation. Bot results may not reflect the current code. Recommended: /gmk-validate before re-sharing."* Allow with `--force`.
2. Computes a new content-hash, deploys to a new URL, records old URL in `share.history`. Old links keep working until the user prunes the gh-pages branch.

### What if no testers reply?

Not this skill's problem. `/gmk-feedback` handles "I have N tester messages" → coding. Empty feedback after sharing is a UX/social problem, not a kit problem.

### Prototypes that depend on local files

Prototypes are supposed to be single-file (per `/gmk-prototype` rules). If the prototype references external assets (e.g. `<img src="dragon.png">`), deployment will 404 those. Detect by parsing the HTML for `src=`/`href=` attributes pointing to relative paths that aren't `data:` URIs. If found:

- Either copy the referenced files alongside the HTML (preserving relative paths), OR
- Stop and tell the user: *"This prototype references external files: {list}. Either inline them as data: URIs or accept that they'll 404 in the deploy."*

Default behavior: copy alongside, but warn — multi-file prototypes violate the kit's spirit and should be a yellow flag for the user.

### `gh` CLI not authenticated

If `gh auth status` fails: *"GitHub CLI isn't authenticated. Run `gh auth login` once, then re-run /gmk-share."* Stop. Don't try to authenticate via this skill.

### Repo doesn't have Pages enabled

The skill should attempt to enable Pages via `gh api -X POST repos/<owner>/<repo>/pages -f source[branch]=gh-pages`. If the API call returns 422 (already enabled or org policy blocks), continue and rely on the existing config or stop with a clear org-policy message.

### Custom domains, branch protection rules, monorepos

Out of scope for MVP. If the user has those, the user can manually configure share-config.json's `repo`/`branch`/`subdir` fields and the skill will respect them. Don't try to auto-detect monorepo layouts.

### Privacy / "I don't want this indexed"

Add `<meta name="robots" content="noindex">` to the served HTML (a tiny copy step). GitHub Pages URLs aren't indexed by default unless someone links to them, but this is cheap insurance. Don't ask the user — just do it for prototypes.

### Rate limits

Don't deploy more than once per minute per milestone. If the user spams `/gmk-share`, debounce with: *"Just deployed 12s ago. URLs are cached at the CDN edge for ~30s. Try again in a moment."*

## What this skill does NOT do

- **Doesn't run validation.** That's `/gmk-validate`. Sharing only checks that validation already passed.
- **Doesn't collect feedback.** That's `/gmk-feedback`. Sharing only emits a copy-pasteable ask.
- **Doesn't store tester identities or contact info.** Out of scope; privacy concerns; the user owns their own outreach.
- **Doesn't attempt to make the prototype look polished.** No favicon, no title tweak beyond what's in the HTML, no analytics. The prototype goes up as written.
- **Doesn't notify Discord/Slack/email automatically.** The user pastes the message themselves. Auto-posting is a footgun; a typo in the link or hypothesis is a tester-trust burn.

## Notes for the model running this skill

- **Wall time:** GitHub Pages first deploy can take 60s+. Show progress.
- **Atomic deploys:** if a `git push` fails midway, leave gh-pages in a clean state — don't leave half-pushed commits the user has to revert. Use a temp clone, push from there.
- **Don't pretty-print HTML.** The deploy is byte-identical to `prototypes/<name>.html`. If the user edited it weirdly, that's what testers see.
- **Trust the URL.** Once `curl -sI` returns 200, print the URL and stop. Don't fetch the HTML body to "verify it loads" — the bot already validated functional correctness; the share step's job is publishing.
- **Pages domain quirk:** Personal pages (`<user>.github.io`) and project pages (`<user>.github.io/<repo>`) have different URL roots. Get the user's GitHub username via `gh api user --jq .login` and build the URL correctly per repo type.
- **If the user runs this on a milestone that's already shared and PASS-validated unchanged**, just print the existing URL: *"Already deployed at <url> (content-hash matches current file). Skipping deploy."* No-op is the friendly answer.
- **The tester message is the whole point.** Spend more attention on writing a sharp tester ask than on the deploy mechanics. The deploy almost always works; the tester message is what gets you usable feedback.
