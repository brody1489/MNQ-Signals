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

function migrateProtectedCacheColumns(database) {
  const cols = new Set(
    database.prepare('PRAGMA table_info(protected_cache)').all().map((c) => c.name)
  );
  if (!cols.has('display_name')) {
    database.exec("ALTER TABLE protected_cache ADD COLUMN display_name TEXT DEFAULT ''");
  }
  if (!cols.has('global_name')) {
    database.exec("ALTER TABLE protected_cache ADD COLUMN global_name TEXT DEFAULT ''");
  }
  if (!cols.has('avatar_url')) {
    database.exec("ALTER TABLE protected_cache ADD COLUMN avatar_url TEXT DEFAULT ''");
  }
  if (!cols.has('bio')) {
    database.exec("ALTER TABLE protected_cache ADD COLUMN bio TEXT DEFAULT ''");
  }
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
  migrateProtectedCacheColumns(database);
  const stmt = database.prepare("SELECT 1 FROM settings WHERE key = 'threshold'");
  if (!stmt.get()) {
    database.prepare("INSERT INTO settings (key, value) VALUES ('threshold', '1')").run();
    database.prepare("INSERT INTO settings (key, value) VALUES ('enforce', 'true')").run();
    database.prepare("INSERT INTO settings (key, value) VALUES ('dry_run', 'false')").run();
    database.prepare("INSERT INTO settings (key, value) VALUES ('message_mod', 'true')").run();
  }
  const msgModStmt = database.prepare("SELECT 1 FROM settings WHERE key = 'message_mod'");
  if (!msgModStmt.get()) {
    database.prepare("INSERT INTO settings (key, value) VALUES ('message_mod', 'true')").run();
  }
  const displayStmt = database.prepare("SELECT 1 FROM settings WHERE key = 'display_match'");
  if (!displayStmt.get()) {
    database.prepare("INSERT INTO settings (key, value) VALUES ('display_match', 'true')").run();
    database.prepare("INSERT INTO settings (key, value) VALUES ('display_threshold', '1')").run();
    database.prepare("INSERT INTO settings (key, value) VALUES ('display_min_len', '5')").run();
    database.prepare("INSERT INTO settings (key, value) VALUES ('display_handle_max', '3')").run();
  }
  const displayHandleStmt = database.prepare("SELECT 1 FROM settings WHERE key = 'display_handle_max'");
  if (!displayHandleStmt.get()) {
    database.prepare("INSERT INTO settings (key, value) VALUES ('display_handle_max', '3')").run();
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
  const database = getDb();
  const now = Date.now();
  const run = database.prepare(
    `INSERT OR REPLACE INTO protected_cache
      (user_id, handle, updated_at, display_name, global_name, avatar_url, bio)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const trans = database.transaction((list) => {
    for (const e of list) {
      run.run(
        e.userId,
        e.handle,
        now,
        e.displayName || '',
        e.globalName || '',
        e.avatarUrl || '',
        e.bio || ''
      );
    }
  });
  trans(entries);
}

function loadProtectedCache() {
  return getDb()
    .prepare(
      'SELECT user_id, handle, display_name, global_name, avatar_url, bio FROM protected_cache'
    )
    .all();
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
