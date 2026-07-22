import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config';

/**
 * SQLite holds only metadata — the actual media lives in Cloudflare R2.
 * A single shared connection is fine: better-sqlite3 is synchronous and the
 * app runs as one Node process behind PM2.
 */

let _db: Database.Database | null = null;

export function db(): Database.Database {
	if (_db) return _db;

	const dir = dirname(config.dbPath);
	if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });

	const database = new Database(config.dbPath);
	database.pragma('journal_mode = WAL');
	database.pragma('foreign_keys = ON');
	database.pragma('busy_timeout = 5000');
	migrate(database);
	_db = database;
	return _db;
}

function migrate(d: Database.Database) {
	d.exec(`
		CREATE TABLE IF NOT EXISTS uploads (
			id                TEXT PRIMARY KEY,
			r2_key            TEXT NOT NULL UNIQUE,
			original_filename TEXT NOT NULL,
			mime              TEXT NOT NULL,
			size              INTEGER NOT NULL DEFAULT 0,
			kind              TEXT NOT NULL CHECK (kind IN ('image','video')),
			guest_name        TEXT,
			thumb_key         TEXT,
			poster_key        TEXT,
			width             INTEGER,
			height            INTEGER,
			duration          REAL,
			hidden            INTEGER NOT NULL DEFAULT 0,
			processed         INTEGER NOT NULL DEFAULT 0,
			ip_hash           TEXT,
			created_at        INTEGER NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_uploads_created ON uploads (created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_uploads_visible ON uploads (hidden, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_uploads_processed ON uploads (processed) WHERE processed = 0;

		-- Pending multipart uploads not yet completed (lets us abort/clean up).
		CREATE TABLE IF NOT EXISTS pending_uploads (
			id                TEXT PRIMARY KEY,
			r2_key            TEXT NOT NULL,
			upload_id         TEXT,
			original_filename TEXT NOT NULL DEFAULT '',
			mime              TEXT NOT NULL,
			declared_size     INTEGER NOT NULL,
			kind              TEXT NOT NULL,
			guest_name        TEXT,
			ip_hash           TEXT,
			created_at        INTEGER NOT NULL
		);

		-- Optional guest reactions (hearts).
		CREATE TABLE IF NOT EXISTS reactions (
			upload_id  TEXT NOT NULL,
			ip_hash    TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			PRIMARY KEY (upload_id, ip_hash)
		);
	`);
}

export interface UploadRow {
	id: string;
	r2_key: string;
	original_filename: string;
	mime: string;
	size: number;
	kind: 'image' | 'video';
	guest_name: string | null;
	thumb_key: string | null;
	poster_key: string | null;
	width: number | null;
	height: number | null;
	duration: number | null;
	hidden: number;
	processed: number;
	ip_hash: string | null;
	created_at: number;
}

export interface PendingRow {
	id: string;
	r2_key: string;
	upload_id: string | null;
	original_filename: string;
	mime: string;
	declared_size: number;
	kind: string;
	guest_name: string | null;
	ip_hash: string | null;
	created_at: number;
}
