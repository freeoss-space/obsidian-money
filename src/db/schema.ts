export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS accounts (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	kind TEXT NOT NULL CHECK(kind IN ('bank','credit_card')),
	currency TEXT NOT NULL DEFAULT 'USD',
	statement_day INTEGER,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	icon TEXT NOT NULL DEFAULT 'circle-dot',
	parent_id TEXT REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS entries (
	id TEXT PRIMARY KEY,
	account_id TEXT NOT NULL REFERENCES accounts(id),
	to_account_id TEXT REFERENCES accounts(id),
	type TEXT NOT NULL CHECK(type IN ('expense','income','transfer')),
	amount INTEGER NOT NULL CHECK(amount > 0),
	description TEXT NOT NULL DEFAULT '',
	category_id TEXT REFERENCES categories(id),
	schedule TEXT NOT NULL CHECK(schedule IN ('single','fixed','split')),
	date TEXT NOT NULL,
	fixed_interval TEXT CHECK(fixed_interval IN ('monthly','weekly','yearly')),
	fixed_end_date TEXT,
	split_months INTEGER CHECK(split_months > 0),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_entries_account ON entries(account_id);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
`;
