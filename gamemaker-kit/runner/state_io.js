// runner/state_io.js — atomic JSON I/O for auto-mode state plane.
//
// All state files (.gamemaker-kit/auto/auto-state.json, runner.lock,
// auto-incidents.json, auto-checkpoints/*.json) are read and written through
// this module. The 4 trap defences in plan §"4 함정" rely on this being the
// single point of truth:
//   - "No prose memory" (Drift trap) — JSON only, strict shape.
//   - Crash-safe checkpoint — write-temp-then-rename so a SIGKILL mid-write
//     never leaves a half-file. POSIX rename + Windows ReplaceFile are both
//     atomic on same-volume.
//   - "kit_version read contract" (Rule 16) — warn on future MAJOR, refuse on
//     missing/malformed/older-MAJOR.
//
// This module is intentionally Node-builtin-only (no deps) so the runner can
// `require()` it without an install step on a fresh checkout.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const KIT_VERSION = '0.10.0';
const KIT_MAJOR = 0;
const KIT_MINOR = 10;

// ---------------------------------------------------------------------------
// Atomic write
// ---------------------------------------------------------------------------

function atomicWriteJson(filePath, value) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + '.tmp.' + process.pid + '.' + Date.now();
  const body = JSON.stringify(value, null, 2);
  fs.writeFileSync(tmp, body, { encoding: 'utf8' });
  // fs.renameSync is atomic on the same volume on both POSIX and Windows.
  // If a crash happens before rename, the original file is untouched and the
  // .tmp.* file is orphaned (recoverable by manual inspection).
  fs.renameSync(tmp, filePath);
}

function readJson(filePath) {
  const body = fs.readFileSync(filePath, { encoding: 'utf8' });
  return JSON.parse(body);
}

function existsFile(filePath) {
  try { return fs.statSync(filePath).isFile(); }
  catch (_) { return false; }
}

// ---------------------------------------------------------------------------
// kit_version read contract (Rule 16)
//   - Missing field        → refuse (return { ok:false, reason })
//   - Malformed MAJOR.MINOR → refuse
//   - MAJOR mismatch       → refuse  (we won't read a v1 file from v0 runner)
//   - MAJOR ok, MINOR > us → warn (forward compatible per kit policy)
//   - MAJOR ok, MINOR <= us→ ok
// ---------------------------------------------------------------------------

function verifyKitVersion(obj, contextLabel) {
  const v = obj && obj.kit_version;
  if (typeof v !== 'string' || !v) {
    return {
      ok: false,
      reason: `${contextLabel}: missing kit_version field`,
    };
  }
  const m = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(v);
  if (!m) {
    return {
      ok: false,
      reason: `${contextLabel}: kit_version "${v}" not in MAJOR.MINOR(.PATCH) form`,
    };
  }
  const major = parseInt(m[1], 10);
  const minor = parseInt(m[2], 10);
  if (major !== KIT_MAJOR) {
    return {
      ok: false,
      reason: `${contextLabel}: kit_version "${v}" MAJOR ${major} != runner MAJOR ${KIT_MAJOR}`,
    };
  }
  if (minor > KIT_MINOR) {
    return {
      ok: true,
      warning: `${contextLabel}: kit_version "${v}" is newer than runner ${KIT_VERSION} (forward-compat read)`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// auto-state.json — written by /gmk-auto-start, updated by runner each phase.
// Schema is the union of fields documented in
// _workspace/examples/auto-state-example.json. Validation is shallow on the
// load path (presence of the load-bearing fields) and structural on the write
// path (we never persist objects without phase / kit_version / runner).
// ---------------------------------------------------------------------------

const REQUIRED_STATE_FIELDS = [
  'kit_version', 'phase', 'started_at', 'runner', 'budget',
  'target', 'stop_requested', 'preflight',
];

function loadAutoState(stateFile) {
  if (!existsFile(stateFile)) {
    return {
      ok: false,
      reason: `auto-state.json not found at ${stateFile} — run /gmk-auto-start first`,
    };
  }
  let parsed;
  try { parsed = readJson(stateFile); }
  catch (err) {
    return { ok: false, reason: `auto-state.json malformed: ${err.message}` };
  }
  const v = verifyKitVersion(parsed, 'auto-state.json');
  if (!v.ok) return { ok: false, reason: v.reason };
  for (const f of REQUIRED_STATE_FIELDS) {
    if (!(f in parsed)) {
      return { ok: false, reason: `auto-state.json missing required field: ${f}` };
    }
  }
  return { ok: true, state: parsed, warning: v.warning || null };
}

function saveAutoState(stateFile, state) {
  if (!state || typeof state !== 'object') {
    throw new Error('saveAutoState: state must be an object');
  }
  if (!state.kit_version) state.kit_version = KIT_VERSION;
  for (const f of REQUIRED_STATE_FIELDS) {
    if (!(f in state)) {
      throw new Error(`saveAutoState refuses incomplete state: missing ${f}`);
    }
  }
  atomicWriteJson(stateFile, state);
}

function transitionPhase(state, nextPhase) {
  const now = new Date().toISOString();
  state.phase = nextPhase;
  state.phase_history = state.phase_history || [];
  state.phase_history.push({ phase: nextPhase, entered_at: now });
  state.last_checkpoint_at = now;
  return state;
}

// ---------------------------------------------------------------------------
// runner.lock — single-instance guard. See
// _workspace/examples/auto-runner-lock-example.json for the canonical shape.
// Heartbeat staleness threshold is 5 minutes; that decision lives in the
// gmk-auto-start SKILL Check (c) and in the runner's loop.
// ---------------------------------------------------------------------------

const LOCK_REQUIRED_FIELDS = ['kit_version', 'pid', 'host', 'started_at', 'heartbeat_at'];

function loadRunnerLock(lockFile) {
  if (!existsFile(lockFile)) return { present: false };
  let parsed;
  try { parsed = readJson(lockFile); }
  catch (err) {
    return { present: true, malformed: true, reason: `lock malformed: ${err.message}` };
  }
  const v = verifyKitVersion(parsed, 'runner.lock');
  if (!v.ok) return { present: true, malformed: true, reason: v.reason };
  for (const f of LOCK_REQUIRED_FIELDS) {
    if (!(f in parsed)) {
      return { present: true, malformed: true, reason: `lock missing ${f}` };
    }
  }
  return { present: true, lock: parsed };
}

function writeRunnerLock(lockFile, fields) {
  const lock = Object.assign({
    kit_version: KIT_VERSION,
    pid: process.pid,
    host: os.hostname(),
    started_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
  }, fields || {});
  atomicWriteJson(lockFile, lock);
  return lock;
}

function refreshHeartbeat(lockFile) {
  if (!existsFile(lockFile)) return false;
  const { lock } = loadRunnerLock(lockFile);
  if (!lock) return false;
  lock.heartbeat_at = new Date().toISOString();
  atomicWriteJson(lockFile, lock);
  return true;
}

function clearRunnerLock(lockFile) {
  if (existsFile(lockFile)) fs.unlinkSync(lockFile);
}

// ---------------------------------------------------------------------------
// auto-incidents.json — append-only journal. Every classified failure ends
// up here. Schema is { kit_version, started_at, entries[] } where each entry
// is whatever incident_classifier.js emitted plus a wall-clock timestamp.
// Append is implemented as read-modify-atomic-write because true POSIX append
// from a separate process would race with the runner's own writes.
// ---------------------------------------------------------------------------

function appendIncident(incidentsFile, entry) {
  let journal;
  if (existsFile(incidentsFile)) {
    try { journal = readJson(incidentsFile); }
    catch (_) { journal = null; }
  }
  if (!journal || !Array.isArray(journal.entries)) {
    journal = {
      kit_version: KIT_VERSION,
      started_at: new Date().toISOString(),
      entries: [],
    };
  }
  journal.entries.push(Object.assign({
    logged_at: new Date().toISOString(),
  }, entry));
  atomicWriteJson(incidentsFile, journal);
}

// ---------------------------------------------------------------------------
// auto-checkpoints — opaque snapshots of arbitrary state objects, named by
// monotonic timestamp. The runner writes one per cycle and on every clean
// exit so a crash-restart can pick the last good one.
// ---------------------------------------------------------------------------

function writeCheckpoint(checkpointDir, label, payload) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = `${stamp}__${label}.json`;
  const fpath = path.join(checkpointDir, fname);
  atomicWriteJson(fpath, {
    kit_version: KIT_VERSION,
    label,
    written_at: new Date().toISOString(),
    payload,
  });
  return fpath;
}

module.exports = {
  KIT_VERSION,
  KIT_MAJOR,
  KIT_MINOR,
  atomicWriteJson,
  readJson,
  existsFile,
  verifyKitVersion,
  loadAutoState,
  saveAutoState,
  transitionPhase,
  loadRunnerLock,
  writeRunnerLock,
  refreshHeartbeat,
  clearRunnerLock,
  appendIncident,
  writeCheckpoint,
};
