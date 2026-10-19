const path = require('node:path');
const fs = require('node:fs');

let SqliteDriver;
try {
  const { DatabaseSync } = require('node:sqlite');
  SqliteDriver = DatabaseSync;
} catch {
  SqliteDriver = require('better-sqlite3');
}

function createDatabase(customPath) {
  const dbPath = customPath || path.join(__dirname, 'data', 'enquiries.sqlite');
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new SqliteDriver(dbPath);
  try {
    db.exec('PRAGMA journal_mode = WAL');
  } catch {
    // In-memory or certain OS configurations may not support WAL
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      destination TEXT NOT NULL,
      study_level TEXT NOT NULL,
      message TEXT,
      consent_recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'New',
      is_sample INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}

function seedSampleData(db) {
  const countStmt = db.prepare('SELECT COUNT(*) AS count FROM enquiries');
  const countRow = countStmt.get();
  const count = countRow ? countRow.count : 0;

  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO enquiries (name, phone, email, destination, study_level, message, status, is_sample)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insert.run(
      'Sample Student A',
      '+91 98765 00001 (Demo)',
      'sample.a@example.invalid',
      'UK',
      'Postgraduate',
      'Fictional sample enquiry for dashboard demonstration. Exploring Master of Science programmes in London.',
      'New'
    );

    insert.run(
      'Sample Student B',
      '+91 98765 00002 (Demo)',
      'sample.b@example.invalid',
      'Canada',
      'Undergraduate',
      'Fictional sample enquiry for dashboard demonstration. Interested in computer science undergraduate admissions.',
      'Contacted'
    );
  }
}

module.exports = {
  createDatabase,
  seedSampleData
};
