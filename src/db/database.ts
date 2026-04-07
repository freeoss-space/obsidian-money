import type { Database as SqlJsDatabase } from "sql.js";
import type {
	Account,
	AccountKind,
	Category,
	Entry,
	EntryType,
	EntrySchedule,
	EntityId,
} from "../types";
import { SCHEMA_SQL } from "./schema";

/* ─── helpers ───────────────────────── */

function uuid(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

function now(): string {
	return new Date().toISOString();
}

/* ─── Database wrapper ──────────────── */

export class Database {
	private db: SqlJsDatabase;

	constructor(db: SqlJsDatabase) {
		this.db = db;
		this.db.run("PRAGMA journal_mode=WAL;");
		this.db.run("PRAGMA foreign_keys=ON;");
		this.db.run(SCHEMA_SQL);
	}

	/* ── serialisation ────────────────── */

	/** Export the entire database as a Uint8Array (for saving to disk). */
	export(): Uint8Array {
		return this.db.export();
	}

	/* ── Accounts ─────────────────────── */

	createAccount(
		name: string,
		kind: AccountKind,
		currency: string,
		statementDay?: number,
	): Account {
		const id = uuid();
		const createdAt = now();
		this.db.run(
			`INSERT INTO accounts (id, name, kind, currency, statement_day, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[id, name, kind, currency, statementDay ?? null, createdAt],
		);
		return { id, name, kind, currency, statementDay, createdAt };
	}

	getAccount(id: EntityId): Account | undefined {
		const rows = this.db.exec(
			"SELECT id, name, kind, currency, statement_day, created_at FROM accounts WHERE id = ?",
			[id],
		);
		if (!rows.length || !rows[0].values.length) return undefined;
		const r = rows[0].values[0];
		return {
			id: r[0] as string,
			name: r[1] as string,
			kind: r[2] as AccountKind,
			currency: r[3] as string,
			statementDay: r[4] as number | undefined,
			createdAt: r[5] as string,
		};
	}

	getAllAccounts(): Account[] {
		const rows = this.db.exec(
			"SELECT id, name, kind, currency, statement_day, created_at FROM accounts ORDER BY name",
		);
		if (!rows.length) return [];
		return rows[0].values.map((r: unknown[]) => ({
			id: r[0] as string,
			name: r[1] as string,
			kind: r[2] as AccountKind,
			currency: r[3] as string,
			statementDay: r[4] as number | undefined,
			createdAt: r[5] as string,
		}));
	}

	getAccountsByKind(kind: AccountKind): Account[] {
		const rows = this.db.exec(
			"SELECT id, name, kind, currency, statement_day, created_at FROM accounts WHERE kind = ? ORDER BY name",
			[kind],
		);
		if (!rows.length) return [];
		return rows[0].values.map((r: unknown[]) => ({
			id: r[0] as string,
			name: r[1] as string,
			kind: r[2] as AccountKind,
			currency: r[3] as string,
			statementDay: r[4] as number | undefined,
			createdAt: r[5] as string,
		}));
	}

	deleteAccount(id: EntityId): void {
		this.db.run("DELETE FROM entries WHERE account_id = ? OR to_account_id = ?", [id, id]);
		this.db.run("DELETE FROM accounts WHERE id = ?", [id]);
	}

	updateAccount(id: EntityId, name: string, currency: string, statementDay?: number): void {
		this.db.run(
			"UPDATE accounts SET name = ?, currency = ?, statement_day = ? WHERE id = ?",
			[name, currency, statementDay ?? null, id],
		);
	}

	/* ── Categories ───────────────────── */

	createCategory(name: string, icon: string, parentId?: EntityId): Category {
		const id = uuid();
		this.db.run(
			"INSERT INTO categories (id, name, icon, parent_id) VALUES (?, ?, ?, ?)",
			[id, name, icon, parentId ?? null],
		);
		return { id, name, icon, parentId };
	}

	getAllCategories(): Category[] {
		const rows = this.db.exec(
			"SELECT id, name, icon, parent_id FROM categories ORDER BY name",
		);
		if (!rows.length) return [];
		return rows[0].values.map((r: unknown[]) => ({
			id: r[0] as string,
			name: r[1] as string,
			icon: r[2] as string,
			parentId: (r[3] as string) || undefined,
		}));
	}

	getCategory(id: EntityId): Category | undefined {
		const rows = this.db.exec(
			"SELECT id, name, icon, parent_id FROM categories WHERE id = ?",
			[id],
		);
		if (!rows.length || !rows[0].values.length) return undefined;
		const r = rows[0].values[0];
		return {
			id: r[0] as string,
			name: r[1] as string,
			icon: r[2] as string,
			parentId: (r[3] as string) || undefined,
		};
	}

	deleteCategory(id: EntityId): void {
		this.db.run("UPDATE entries SET category_id = NULL WHERE category_id = ?", [id]);
		this.db.run("DELETE FROM categories WHERE id = ?", [id]);
	}

	/* ── Entries ──────────────────────── */

	createEntry(params: {
		accountId: EntityId;
		toAccountId?: EntityId;
		type: EntryType;
		amount: number;
		description: string;
		categoryId?: EntityId;
		schedule: EntrySchedule;
		date: string;
		fixedInterval?: "monthly" | "weekly" | "yearly";
		fixedEndDate?: string;
		splitMonths?: number;
	}): Entry {
		const id = uuid();
		const createdAt = now();
		this.db.run(
			`INSERT INTO entries (id, account_id, to_account_id, type, amount, description,
			 category_id, schedule, date, fixed_interval, fixed_end_date, split_months, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				params.accountId,
				params.toAccountId ?? null,
				params.type,
				params.amount,
				params.description,
				params.categoryId ?? null,
				params.schedule,
				params.date,
				params.fixedInterval ?? null,
				params.fixedEndDate ?? null,
				params.splitMonths ?? null,
				createdAt,
			],
		);
		return {
			id,
			accountId: params.accountId,
			toAccountId: params.toAccountId,
			type: params.type,
			amount: params.amount,
			description: params.description,
			categoryId: params.categoryId,
			schedule: params.schedule,
			date: params.date,
			fixedInterval: params.fixedInterval,
			fixedEndDate: params.fixedEndDate,
			splitMonths: params.splitMonths,
			createdAt,
		};
	}

	getEntry(id: EntityId): Entry | undefined {
		const rows = this.db.exec(
			`SELECT id, account_id, to_account_id, type, amount, description,
			 category_id, schedule, date, fixed_interval, fixed_end_date, split_months, created_at
			 FROM entries WHERE id = ?`,
			[id],
		);
		if (!rows.length || !rows[0].values.length) return undefined;
		return this.rowToEntry(rows[0].values[0]);
	}

	getEntriesByAccount(accountId: EntityId): Entry[] {
		const rows = this.db.exec(
			`SELECT id, account_id, to_account_id, type, amount, description,
			 category_id, schedule, date, fixed_interval, fixed_end_date, split_months, created_at
			 FROM entries WHERE account_id = ? OR to_account_id = ? ORDER BY date DESC`,
			[accountId, accountId],
		);
		if (!rows.length) return [];
		return rows[0].values.map((r: unknown[]) => this.rowToEntry(r));
	}

	getEntriesByMonth(month: string): Entry[] {
		// month is "YYYY-MM"
		const rows = this.db.exec(
			`SELECT id, account_id, to_account_id, type, amount, description,
			 category_id, schedule, date, fixed_interval, fixed_end_date, split_months, created_at
			 FROM entries WHERE substr(date, 1, 7) = ? OR schedule IN ('fixed', 'split')
			 ORDER BY date DESC`,
			[month],
		);
		if (!rows.length) return [];
		return rows[0].values.map((r: unknown[]) => this.rowToEntry(r));
	}

	getAllEntries(): Entry[] {
		const rows = this.db.exec(
			`SELECT id, account_id, to_account_id, type, amount, description,
			 category_id, schedule, date, fixed_interval, fixed_end_date, split_months, created_at
			 FROM entries ORDER BY date DESC`,
		);
		if (!rows.length) return [];
		return rows[0].values.map((r: unknown[]) => this.rowToEntry(r));
	}

	deleteEntry(id: EntityId): void {
		this.db.run("DELETE FROM entries WHERE id = ?", [id]);
	}

	updateEntry(id: EntityId, params: Partial<Omit<Entry, "id" | "createdAt">>): void {
		const fields: string[] = [];
		const values: unknown[] = [];

		if (params.accountId !== undefined) {
			fields.push("account_id = ?");
			values.push(params.accountId);
		}
		if (params.toAccountId !== undefined) {
			fields.push("to_account_id = ?");
			values.push(params.toAccountId);
		}
		if (params.type !== undefined) {
			fields.push("type = ?");
			values.push(params.type);
		}
		if (params.amount !== undefined) {
			fields.push("amount = ?");
			values.push(params.amount);
		}
		if (params.description !== undefined) {
			fields.push("description = ?");
			values.push(params.description);
		}
		if (params.categoryId !== undefined) {
			fields.push("category_id = ?");
			values.push(params.categoryId);
		}
		if (params.schedule !== undefined) {
			fields.push("schedule = ?");
			values.push(params.schedule);
		}
		if (params.date !== undefined) {
			fields.push("date = ?");
			values.push(params.date);
		}
		if (params.fixedInterval !== undefined) {
			fields.push("fixed_interval = ?");
			values.push(params.fixedInterval);
		}
		if (params.fixedEndDate !== undefined) {
			fields.push("fixed_end_date = ?");
			values.push(params.fixedEndDate);
		}
		if (params.splitMonths !== undefined) {
			fields.push("split_months = ?");
			values.push(params.splitMonths);
		}

		if (fields.length === 0) return;

		values.push(id);
		this.db.run(`UPDATE entries SET ${fields.join(", ")} WHERE id = ?`, values);
	}

	/* ── private helpers ──────────────── */

	private rowToEntry(r: unknown[]): Entry {
		return {
			id: r[0] as string,
			accountId: r[1] as string,
			toAccountId: (r[2] as string) || undefined,
			type: r[3] as EntryType,
			amount: r[4] as number,
			description: r[5] as string,
			categoryId: (r[6] as string) || undefined,
			schedule: r[7] as EntrySchedule,
			date: r[8] as string,
			fixedInterval: (r[9] as "monthly" | "weekly" | "yearly") || undefined,
			fixedEndDate: (r[10] as string) || undefined,
			splitMonths: (r[11] as number) || undefined,
			createdAt: r[12] as string,
		};
	}
}
