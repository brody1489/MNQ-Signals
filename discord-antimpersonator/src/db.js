const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'antimpersonator.db');

let db;

function getDb() {
  if (!db) {
    const { mkdirSync, existsSync } = require('fs');
    const dir = path.dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS ignored_roles (
      role_id TEXT PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS manual_protected (
      user_id TEXT PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS protected_cache (
      user_id TEXT PRIMARY KEY,
      handle TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  const stmt = database.prepare("SELECT 1 FROM settings WHERE key = 'threshold'");
  if (!stmt.get()) {
    database.prepare("INSERT INTO settings (key, value) VALUES ('threshold', '1')").run();
    database.prepare("INSERT INTO settings (key, value) VALUES ('enforce', 'true')").run();
    database.prepare("INSERT INTO settings (key, value) VALUES ('dry_run', 'false')").run();
  }
}

function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

function getIgnoredRoleIds() {
  return getDb().prepare('SELECT role_id FROM ignored_roles').all().map((r) => r.role_id);
}

function addIgnoredRole(roleId) {
  getDb().prepare('INSERT OR IGNORE INTO ignored_roles (role_id) VALUES (?)').run(roleId);
}

function removeIgnoredRole(roleId) {
  getDb().prepare('DELETE FROM ignored_roles WHERE role_id = ?').run(roleId);
}

function getManualProtectedIds() {
  return getDb().prepare('SELECT user_id FROM manual_protected').all().map((r) => r.user_id);
}

function addManualProtected(userId) {
  getDb().prepare('INSERT OR IGNORE INTO manual_protected (user_id) VALUES (?)').run(userId);
}

function removeManualProtected(userId) {
  getDb().prepare('DELETE FROM manual_protected WHERE user_id = ?').run(userId);
}

function saveProtectedCache(entries) {
  const db = getDb();
  const now = Date.now();
  const run = db.prepare('INSERT OR REPLACE INTO protected_cache (user_id, handle, updated_at) VALUES (?, ?, ?)');
  const trans = db.transaction((list) => {
    for (const { userId, handle } of list) run.run(userId, handle, now);
  });
  trans(entries);
}

function loadProtectedCache() {
  return getDb().prepare('SELECT user_id, handle FROM protected_cache').all();
}

module.exports = {
  getDb,
  getSetting,
  setSetting,
  getIgnoredRoleIds,
  addIgnoredRole,
  removeIgnoredRole,
  getManualProtectedIds,
  addManualProtected,
  removeManualProtected,
  saveProtectedCache,
  loadProtectedCache,
};
