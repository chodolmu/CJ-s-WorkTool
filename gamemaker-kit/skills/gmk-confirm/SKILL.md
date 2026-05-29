---
name: gmk-confirm
description: Render a visual .html confirmation page for a playable build — embeds a new-tab link to the module prototype, lists the conventions it must honor (numeric ones with the bot-measured value, qualitative ones as observe-and-check rows), and captures the user's per-convention Y/N verdict. The concept-P5 check-in gate — every playable build gets a human look before it advances. Use when the user says "/gmk-confirm <Mn>", "confirm the build", "컨펌 화면", "check-in", or after /gmk-module-build produced a playable HTML. Writes a confirm page + records the verdict in milestones.json (the single source of truth). Latency-safe — the verdict persists in milestones.json so confirmation can finish in a later session.
model: sonnet
---

# gmk-confirm — Visual .html check-in for a playable build (Layer 2, P5)

Concept principle **P5**: *every playable build gets a user confirmation — a `.html` visual check-in (the build + its core claims), not a code review.* This skill renders that page and records the verdict.

`gmk-module-build` Step 5 already does a fast *text* per-convention Y/N check in chat. This skill is the *visual* layer above it: a self-contained `.html` page the user opens, plays the build from, and judges convention-by-convention. Both write the same `milestones.json` `confirm` field; gmk-confirm overwrites it authoritatively with `method: "visual"`.

## Why this skill exists (read once)

A build can pass a bot fidelity trial (numeric conventions) and still not *look* like the reference on screen — the qualitative (`needs_metric`) conventions are exactly the ones a machine can't gate. P5 says a human must look. This skill makes that look **structured and observable**: a per-convention checklist, not a vibe reaction. It does not build, validate, or fix — it only renders the page and records the user's per-convention verdict.

**Single source of truth = `milestones.json` `confirm`.** A `file://` browser page cannot write into the repo, and a fresh Claude session cannot read browser `localStorage`. So the verdict's authoritative home is `milestones.json` (which Claude writes), reached by the user pasting the page's verdict text into chat. The page's `localStorage` is UI-only (restores checkbox state on refresh); it is *not* recovery state.

## Precondition

Reference-clone module from `gmk-module-build` (`mode: "reference-clone"`, has `covers_conventions`). Blank-page / differentiation builds are out of scope here (their visual confirm — hypothesis rows instead of conventions — is a later skill).

## Flow

### Step 0 — Verify (disk + git)

First sub-step, always:
1. Target milestone exists in `milestones.json` AND its `prototype` HTML file actually exists on disk.
2. `genre-decisions.json` exists + `JSON.parse` + the module's `covers_conventions` are present there.
3. **Mode check**: milestone `mode === "reference-clone"`. If not → STOP: *"This build is blank-page/differentiation mode. The hypothesis-row version of visual confirm is a later skill (S4 covers reference-clone modules only)."*
4. **Resume check (latency, single source)**: read `milestones.json` `confirm`. If `confirm.status === "pending"` (`confirmed: false`) → a prior session already generated the page; tell the user *"Confirmation pending — open `<confirm_html>`, judge, paste the verdict text here. Port is blocked until you do."* Do NOT regenerate unless asked. If `confirm.method === "text"` AND a `<Mn>-confirm.html` exists on disk → the build was rebuilt after a visual confirm (module-build clobbered it back to text); tell the user *"Build changed — re-confirm visually"* and regenerate.
5. Fallback: prototype HTML missing → STOP (*"No build HTML. Run /gmk-module-build first."*).

### Step 1 — Read build + contract

- milestone entry: `prototype` path, `covers_conventions`, `validation` (numeric measured values + verdict if present), `mode`.
- For each covered convention: statement + `acceptance` (numeric) / `needs_metric` (qualitative), split.
- Numeric conventions: pull the *measured value* from `validation.by_convention` (e.g. `C9 late_level_moves=15`, gate `[12,18]` → row shows "bot: 15 ✓"). If no validation yet, show "측정 대기".

### Step 2 — Render the confirm page (visual .html)

Generate `<confirm-dir>/<Mn>-confirm.html` — self-contained, vanilla JS, no external deps. (Not a prototype, so the 300/600 line caps don't apply — but the page is **data-driven from `covers_conventions`**, so its size scales with convention count; a 5-convention page over ~500 lines is a smell, re-examine.) Structure:

- **Top**: a *"코드 말고 이 화면으로 판단하세요"* banner (P5 — this is the gate, not a code review), module name + pillars + reference URL.
- **Left (play the build)** — **new-tab link is the primary path** (`<a href="../prototypes/<Mn>-*.html" target="_blank">Play the build ↗</a>`): a `file://` iframe commonly fails cross-origin, so the page must not depend on it. An `<iframe src=...>` is included as a *bonus* (shows if it loads); the confirm flow works regardless. A screenshot placeholder for manual attach.
- **Right (convention checklist)** — one row per covered convention:
  - numeric: `C9 late_level_moves [12,18] — bot: 15 ✓ | 화면에서도 맞나?` + a `<select>`.
  - needs_metric: `C7 <statement verbatim> — 화면에서 관측됨?` + a `<select>`.
  - **Row DOM (the reproducible contract)**: each row is one `<select>` with options `["", "Y", "N", "skip"]` (empty = unanswered). `localStorage` key `gmk-confirm-<Mn>` restores selections on refresh (UI convenience only).
- **Bottom**: a `notes` `<textarea>` + a **"판정 텍스트 생성" button**. It is `disabled` while any row is unanswered (empty), showing "N개 미응답". When all answered, it serializes to JSON and writes it into a `<textarea readonly>` for the user to select-all + copy. Verdict JSON:
  ```json
  { "method": "visual", "module_id": "<Mn>",
    "per_convention": { "C2": true, "C7": false, "C9": true },
    "confirmed": false,
    "notes": "...", "confirmed_at": "<ISO>" }
  ```
  where each value is `true` (Y) / `false` (N) / `"skip"`, and `confirmed = (every row is "Y")`.
- A small note by the textarea: *"체크만으론 저장 안 됨 — 이 텍스트를 채팅에 붙여넣어야 기록됩니다."* (localStorage is not recovery; the paste is.)
- A download button is fine as a bonus, but it lands in the browser's download folder — Claude trusts the pasted text, not the file.

### Step 3 — Take field authority (latency-safe, single source)

The moment the page is generated, Claude writes the pending state to `milestones.json` `confirm` (Claude is the disk-writer, not the browser):
```json
"confirm": { "method": "visual", "confirmed": false, "status": "pending",
             "per_convention": {}, "confirm_html": "<path>", "confirmed_at": null }
```
- **`pending` ⇒ `confirmed: false`** → `gmk-port`'s `confirm.confirmed === true` gate genuinely blocks the port until the user finishes. `status` is a human-readable hint; the gate rides `confirmed` (the only field gmk-port reads).
- Record in the resume point that this milestone has a *pending confirmation* (risk-flag — port blocked). A fresh session recovers from `milestones.json` `confirm` alone (Step 0 #4) — never from the download file or `localStorage`.

### Step 4 — Capture the verdict (paste-to-chat primary)

- **Primary path**: the user pastes the page's verdict JSON into chat; Claude validates and writes it to `milestones.json`. (No reliance on a `file://` page writing to the repo.)
- **Validate before applying** (rejects stale/mismatched paste): (a) `JSON.parse` succeeds, (b) `module_id === <Mn>`, (c) `per_convention` key-set === the module's `covers_conventions` set. Any mismatch → reject: *"This verdict looks like a different module or an older page — re-judge on the current `<Mn>` page."*
- On valid paste: Claude fills `confirm_html` + `confirmed_at`, sets `status: "done"`, sets `confirmed` to the pasted value, and atomic-writes `milestones.json`.
- If `confirmed: false` (any row N/skip): name which conventions failed on screen — that's a fidelity miss → re-build (`gmk-module-build`) or re-examine the contract (`gmk-genre-decide`). gmk-confirm only records; it does not fix.

### Step 5 — Write back + resume (atomic, P8)

- `milestones.json` `confirm` updated (atomic), `status: "done"`.
- Update resume; clear the pending risk-flag.
- **Next**: *"Confirm done. If confirmed=true → /gmk-port (or, on a fidelity-INCONCLUSIVE module, this visual confirm is the sole gate). If false → see which convention failed and /gmk-module-build to rebuild."*

## What gmk-confirm does NOT do

- Doesn't build (gmk-module-build), validate/bot (gmk-validate), or fix (it only records the verdict).
- Doesn't judge "fun" — convention-anchored observation only (P2, concept §1).
- Doesn't share/deploy — the confirm page is local.
- Isn't a code-review tool — if the user wants to read the code instead of the .html, that's the S4 STOP signal (see Notes).
- Doesn't run on blank-page/differentiation builds (Step 0 #3 STOP).

## Notes for the model running this skill

- **`milestones.json` `confirm` is the only source of truth.** Never recover a verdict from `localStorage` (a fresh session can't read it) or the downloaded `confirm.json` (browser-folder, untrusted). Step 0 reads `confirm.status`/`confirm.confirmed` only.
- **The gate rides `confirm.confirmed`, not `confirm.status`.** gmk-port reads `confirmed`; `status` is a human hint. A pending confirm must set `confirmed: false` or the port isn't actually blocked.
- **Paste, don't depend on download.** A `file://` page can't write to the repo. Claude is the disk-writer; the user's pasted text is the channel. Validate it (parse + module_id + key-set) before trusting it.
- **"Reads the code instead of the page" is the P5 STOP.** It's a user-behavior signal, not greppable — the page's banner nudges, and if the user asks to see code instead, surface: *"P5 is a visual .html check-in; code review is gmk-refactor-check's job. Judge from the page, or is this really a module that needs a code look?"*
- **Re-running module-build resets this.** A rebuild clobbers `confirm` back to text shape (module-build owns its Step 5 write). That's intended — a changed build invalidates the prior visual confirm. Step 0 #4 detects it and re-confirms.
