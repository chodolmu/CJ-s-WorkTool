---
name: gmk-save-migrate
description: Plan save-file compatibility and schema migration when a milestone adds or changes persisted fields (after engine port). Detects field additions/removals/renames against the previous save schema, drafts the migration function pseudocode, and writes _workspace/milestones/<id>/save-migration.md. Use when the user says "/gmk-save-migrate <milestone>", "save migration", "save file 깨지나", "schema migration", or before merging a milestone whose port changes the persistent data shape. Read-only on save-schema.json (if present) + milestones.json; writes one markdown plan file.
model: sonnet
---

# gmk-save-migrate — Don't break the user's save file

Per `gmk-prototype-rules` §6, HTML prototypes don't persist game state at all — `localStorage` is forbidden. So save-file concerns are entirely **engine-side**, surfacing only after `/gmk-port` lands a milestone in Godot/Unity.

But once a player has a save file in the engine build and the next milestone adds a field (or renames one), the existing save file either crashes the game on load, silently corrupts, or "works" but with the new field undefined in subtle ways. This skill makes you plan the migration **before** the port lands, not after the player reports it.

Output: a markdown plan describing the schema delta, the migration function pseudocode, and a rollback strategy.

## Preconditions

1. **Milestone exists** in `.gamemaker-kit/milestones.json`.
2. **The milestone's port plan touches persistent data.** Heuristic: the milestone modifies state visible across sessions (player progress, unlocks, settings, save slots). If unsure, ask the user: *"Does this milestone change anything the player keeps between sessions? Score history, unlocks, settings, save slots? If no, /gmk-save-migrate isn't needed."* If no, stop.
3. **A previous save schema is documented OR the project is pre-port** (no save file exists yet). The kit doesn't auto-detect engine-side schemas — the user maintains `<engine-root>/save-schema.json` (or a similar reference) and points this skill at it.
   - If no previous schema and the project IS post-port for at least one milestone: warn. *"This is the first save-migration plan but the project has shipped at least one milestone. Existing save files are at risk; document the current schema before adding fields."*
   - If pre-port: write the first schema baseline as part of this plan.

## Flow

### Step 1 — Read the current schema (or baseline)

If `save-schema.json` exists in the engine project root (path conventionally documented in `_workspace/structure.md` or the engine project README), read it. Else, ask the user to paste the current schema, or guide them through writing a baseline:

```json
{
  "version": 1,
  "fields": {
    "player_name": "string",
    "current_milestone": "string (kebab-case)",
    "high_scores": "object: {[milestone_id]: number}",
    "settings": "object: {volume: number 0..1, vibration: boolean}"
  },
  "migrated_from": null
}
```

Schema version is an integer counter. v1 = baseline. v2 = after one migration. Each milestone-induced migration bumps version by 1.

### Step 2 — Identify the schema delta for this milestone

What does the milestone add/change? Three classes of change:

| Class | Example | Migration complexity |
|---|---|---|
| **Add field** | new `unlocked_species: string[]` | Easy: default value, fill on load |
| **Remove field** | drop `legacy_combo_count` | Easy: ignore on load |
| **Rename field** | `combo_count` → `merge_streak` | Medium: read old, write new |
| **Change type** | `high_scores: number` → `high_scores: object` | Hard: data transformation logic |
| **Change semantics** | same name, different meaning | Hard: usually requires user action |

Walk the user through their changes. For each, classify and document:

```
## Schema delta — m3-egg-spawn

| Field                | Before     | After                          | Class    | Migration |
|----------------------|------------|--------------------------------|----------|-----------|
| egg_count            | (absent)   | number, default 0              | Add      | trivial   |
| unlocked_species     | string[]   | string[] (no change)           | (no-op)  | none      |
| high_scores          | (absent)   | object: {[m_id]: number}, {} default | Add | trivial |
| legacy_combo_count   | number     | (removed)                      | Remove   | ignore    |
| current_milestone    | string     | string (no change)             | (no-op)  | none      |
```

Cap: a milestone's migration should touch ≤ 5 fields. More than that = the port plan is too ambitious; consider splitting via `/gmk-mechanic-merge`.

### Step 3 — Draft the migration function (engine-language-agnostic pseudocode)

A one-direction migration: load old, return new. Idempotent (calling on an already-migrated save returns the save unchanged).

```
function migrate_v1_to_v2(save_v1):
    save_v2 = copy(save_v1)

    # Add: egg_count
    if "egg_count" not in save_v2:
        save_v2["egg_count"] = 0

    # Add: high_scores
    if "high_scores" not in save_v2:
        save_v2["high_scores"] = {}

    # Remove: legacy_combo_count
    save_v2.pop("legacy_combo_count", None)

    # Set version
    save_v2["version"] = 2
    save_v2["migrated_from"] = save_v1.get("version", 1)
    save_v2["migrated_at"] = now_iso()

    return save_v2
```

If a rename happens, copy the old value into the new key, delete the old. If a type change happens, write the transformation explicitly:

```
# Type change: high_scores number → object
if isinstance(save_v2.get("high_scores"), (int, float)):
    old_value = save_v2["high_scores"]
    save_v2["high_scores"] = {"m1-merge-feel": old_value}  # attribute to the first milestone
```

### Step 4 — Rollback strategy

What if migration fails or produces wrong output? Three options:

1. **Backup-and-replace** (default): before migrating, save `save.json` → `save-v{N}-backup-{timestamp}.json`. Player can manually restore if needed. **Most projects use this.**
2. **In-place with checksum**: write the migrated save with a checksum field; if load detects a checksum mismatch, refuse to write further and tell the user to investigate. Adds engine complexity but prevents silent corruption.
3. **No-rollback**: the user accepts that bad migrations are unrecoverable. Acceptable for prototype-stage projects, not for shipped builds.

Document the chosen strategy:

```
## Rollback strategy

Backup-and-replace selected.
- Before migration runs, the engine copies `save.json` → `saves/backup-v1-2026-05-12.json`.
- Migration writes a new `save.json` at v2.
- The old `save.json` is preserved as backup for 30 days (engine-side cleanup task).
- Player can manually restore from the backups folder; no in-game UI.
```

### Step 5 — Test plan

Three test cases the engine port should cover:

1. **Fresh save** (no save file): writes v2 directly, no migration runs.
2. **v1 save with all v1 fields populated**: migration runs, output matches expected v2.
3. **v1 save with optional fields missing** (e.g., the user opened the v1 game but never saved high scores): migration runs, defaults kick in.

Plus an edge case if the schema is touchy:

4. **Type-mismatch save** (user edited `save.json` by hand or save was partial): migration detects type, either coerces or refuses with clear error.

### Step 6 — Write the plan

Path: `_workspace/milestones/<milestone-id>/save-migration.md`. Overwrite.

Template:

```markdown
# Save migration plan — {milestone.id} {milestone.name}

> Generated: {timestamp} by /gmk-save-migrate. Engine-side reference; runs at port time.

## Current schema version
v{N} (last migrated for {previous milestone or "baseline"})

## Schema delta this milestone introduces
{table}

## Migration function (pseudocode)
{code block}

## Rollback strategy
{chosen strategy + rationale}

## Test plan
{4 test cases}

## Next
- /gmk-task-split <id> — add a "implement migrate_v{N}_to_v{N+1}" task under discipline:code
- /gmk-port <id>      — port the milestone; migration function runs at engine load time
- After port: re-verify save-schema.json is updated to v{N+1} in the engine project
```

### Step 7 — Don't touch milestones.json

Working doc only. Migration tasks land via `/gmk-task-split`.

## Output: tell the user what happens next

```
Save migration plan written: _workspace/milestones/m3-egg-spawn/save-migration.md
Schema delta: v1 → v2 (3 fields touched: +egg_count, +high_scores, -legacy_combo_count)
Rollback: backup-and-replace selected (30-day retention)
Test cases: 4 (fresh, full v1, partial v1, type-mismatch)

Next:
  - /gmk-task-split m3-egg-spawn — add migrate_v1_to_v2 task to engine code
  - /gmk-port m3-egg-spawn — port milestone with migration wired into load path
  - After port: bump save-schema.json to v2 in the engine project root
```

## Edge cases & policy

### Multi-milestone batch port

If the user ports m3, m4, m5 all at once, schema delta should be cumulative. Plan: run `/gmk-save-migrate` per milestone, then combine into a single `migrate_v1_to_v4` function (or three chained migrations).

### The engine project has no save-schema.json

Many projects don't formalize the schema until they need to migrate. If this is the first migration, treat the current state as v1 baseline, document it now, and start v2 migration. Surface: *"This is the first save migration. The current save state becomes documented v1 baseline. Write `save-schema.json` to the engine project root before porting."*

### Save schema includes binary blobs or proprietary formats

The kit's pseudocode assumes JSON-friendly schemas. For binary save formats (Unity's BinaryFormatter, Godot's ResourceLoader), the migration logic is engine-specific. Surface: *"Binary save format detected. Migration logic is engine-specific; the spec here captures the schema delta but the actual migration is in {Godot script | C# class}. Reference the engine's save serializer docs."*

### Backward-compat-forever pressure

If the user wants to preserve v1-loadability forever (chain migrations endlessly), surface: *"Chained migrations work but the chain length grows. After 5-6 migrations, consider 'save format v2 is the new baseline; v1 saves require a one-time external converter.' This is a reasonable retirement point."*

### Player edited their save by hand

Type-mismatch test case covers this. Default behavior: refuse to load with clear error. Don't silently coerce — the player may have intended the edit (mod, cheat) but the engine shouldn't quietly accept it as the new normal.

### Pre-port milestone with no save data

If the milestone is entirely in-memory and never persists, the skill applies trivially: schema delta is empty, no migration needed. Tell the user: *"This milestone doesn't change persistent data. Save migration is a no-op. Skip and proceed to /gmk-port."*

## What this skill does NOT do

- **Doesn't run the migration.** Generates the plan and pseudocode; engine implementation is the user's job (or a code task split via `/gmk-task-split`).
- **Doesn't auto-detect engine-side schema changes.** The user maintains `save-schema.json` and tells this skill what changed.
- **Doesn't migrate HTML prototype state.** `gmk-prototype-rules` §6 forbids `localStorage`; HTML prototypes are stateless. The skill only applies post-port.
- **Doesn't write the engine code.** Pseudocode for design review; the engine code (GDScript / C#) is implemented during port.
- **Doesn't handle cross-platform save sync.** Cloud saves, Steam Cloud, mobile sync — out of scope for the kit (and out of scope per "no external services").

## Notes for the model running this skill

- **Schema version is an integer counter.** Resist semver-style versions (`v1.2.3`). The kit's save migrations are linear; integers work.
- **Defaults must be safe.** A new field with a default of `null` or `0` is fine. A new field that requires the player to "choose at first launch" needs UX flow integration — surface that.
- **Backups beat cleverness.** The default rollback strategy (backup-and-replace) covers 95% of cases. Don't push toward fancy in-place migration with checksums unless the user has a specific reason.
- **The pseudocode is a *plan*, not source.** Write it readable, not executable. The user (or code task) translates into engine-specific code.
- **Per-milestone migration plans accumulate.** Each milestone with persistent change gets its own plan; reading them in order tells the schema's full history.
- **Don't lecture about database migrations.** Save files aren't databases. Keep the spec scoped to single-player local files.
- **Cite `gmk-prototype-rules` §6 once** when the user is confused about why save-migration is only post-port. Save state in HTML prototypes is forbidden, so all save concerns are engine-side.
