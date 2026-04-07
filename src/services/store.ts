import { Database } from "../db/database";
import type {
	Account,
	AccountKind,
	Category,
	Entry,
	EntryType,
	EntrySchedule,
	EntityId,
	LedgerRow,
	MonthSummary,
} from "../types";

/**
 * Application-level store that wraps the Database and provides
 * business logic such as ledger expansion and monthly summaries.
 */
export class MoneyStore {
	readonly db: Database;

	constructor(db: Database) {
		this.db = db;
	}

	/* ── Accounts ─────────────────────── */

	createAccount(name: string, kind: AccountKind, currency: string, statementDay?: number): Account {
		return this.db.createAccount(name, kind, currency, statementDay);
	}

	getAccount(id: EntityId): Account | undefined {
		return this.db.getAccount(id);
	}

	getAllAccounts(): Account[] {
		return this.db.getAllAccounts();
	}

	getBankAccounts(): Account[] {
		return this.db.getAccountsByKind("bank");
	}

	getCreditCards(): Account[] {
		return this.db.getAccountsByKind("credit_card");
	}

	deleteAccount(id: EntityId): void {
		this.db.deleteAccount(id);
	}

	updateAccount(id: EntityId, name: string, currency: string, statementDay?: number): void {
		this.db.updateAccount(id, name, currency, statementDay);
	}

	/* ── Categories ───────────────────── */

	createCategory(name: string, icon: string, parentId?: EntityId): Category {
		return this.db.createCategory(name, icon, parentId);
	}

	getAllCategories(): Category[] {
		return this.db.getAllCategories();
	}

	deleteCategory(id: EntityId): void {
		this.db.deleteCategory(id);
	}

	seedDefaultCategories(defaults: Array<{ name: string; icon: string }>): void {
		const existing = this.db.getAllCategories();
		const existingNames = new Set(existing.map((c) => c.name));
		for (const d of defaults) {
			if (!existingNames.has(d.name)) {
				this.db.createCategory(d.name, d.icon);
			}
		}
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
		return this.db.createEntry(params);
	}

	getEntry(id: EntityId): Entry | undefined {
		return this.db.getEntry(id);
	}

	getEntriesByAccount(accountId: EntityId): Entry[] {
		return this.db.getEntriesByAccount(accountId);
	}

	getAllEntries(): Entry[] {
		return this.db.getAllEntries();
	}

	deleteEntry(id: EntityId): void {
		this.db.deleteEntry(id);
	}

	updateEntry(id: EntityId, params: Partial<Omit<Entry, "id" | "createdAt">>): void {
		this.db.updateEntry(id, params);
	}

	/* ── Ledger expansion ─────────────── */

	/**
	 * Expand all entries into concrete ledger rows for a given month.
	 * - Single entries that fall in the month appear as-is.
	 * - Fixed entries are expanded into each occurrence in the month.
	 * - Split entries appear with amount / splitMonths for each month in range.
	 */
	getLedgerForMonth(month: string): LedgerRow[] {
		const allEntries = this.db.getAllEntries();
		const rows: LedgerRow[] = [];

		for (const entry of allEntries) {
			const expanded = this.expandEntry(entry, month);
			rows.push(...expanded);
		}

		return rows.sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
		);
	}

	/**
	 * Get the monthly summary for a specific account in a month.
	 */
	getMonthSummary(accountId: EntityId, month: string): MonthSummary {
		const rows = this.getLedgerForMonth(month).filter(
			(r) => r.accountId === accountId || r.toAccountId === accountId,
		);

		let totalIncome = 0;
		let totalExpenses = 0;

		for (const row of rows) {
			if (row.type === "income" && row.accountId === accountId) {
				totalIncome += row.amount;
			} else if (row.type === "expense" && row.accountId === accountId) {
				totalExpenses += row.amount;
			} else if (row.type === "transfer") {
				if (row.accountId === accountId) {
					// Money leaving this account
					totalExpenses += row.amount;
				}
				if (row.toAccountId === accountId) {
					// Money coming into this account
					totalIncome += row.amount;
				}
			}
		}

		return {
			accountId,
			month,
			totalIncome,
			totalExpenses,
			balance: totalIncome - totalExpenses,
		};
	}

	/**
	 * Get the overall summary across all accounts for a month.
	 */
	getOverallMonthSummary(month: string): MonthSummary {
		const rows = this.getLedgerForMonth(month);
		let totalIncome = 0;
		let totalExpenses = 0;

		for (const row of rows) {
			if (row.type === "income") {
				totalIncome += row.amount;
			} else if (row.type === "expense") {
				totalExpenses += row.amount;
			}
			// transfers don't affect overall income/expense totals
		}

		return {
			accountId: "all",
			month,
			totalIncome,
			totalExpenses,
			balance: totalIncome - totalExpenses,
		};
	}

	/**
	 * Get expenses grouped by category for a given month.
	 */
	getExpensesByCategory(month: string): Map<string, number> {
		const rows = this.getLedgerForMonth(month).filter((r) => r.type === "expense");
		const map = new Map<string, number>();
		for (const row of rows) {
			const key = row.categoryId ?? "uncategorized";
			map.set(key, (map.get(key) ?? 0) + row.amount);
		}
		return map;
	}

	/* ── Private: entry expansion ─────── */

	private expandEntry(entry: Entry, month: string): LedgerRow[] {
		const [targetYear, targetMonth] = month.split("-").map(Number);

		switch (entry.schedule) {
			case "single":
				return this.expandSingle(entry, targetYear, targetMonth);
			case "fixed":
				return this.expandFixed(entry, targetYear, targetMonth);
			case "split":
				return this.expandSplit(entry, targetYear, targetMonth);
			default:
				return [];
		}
	}

	private expandSingle(entry: Entry, targetYear: number, targetMonth: number): LedgerRow[] {
		const entryDate = new Date(entry.date);
		if (
			entryDate.getUTCFullYear() === targetYear &&
			entryDate.getUTCMonth() + 1 === targetMonth
		) {
			return [this.entryToLedgerRow(entry, entry.date, entry.amount)];
		}
		return [];
	}

	private expandFixed(entry: Entry, targetYear: number, targetMonth: number): LedgerRow[] {
		const startDate = new Date(entry.date);
		const endDate = entry.fixedEndDate ? new Date(entry.fixedEndDate) : null;
		const targetStart = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
		const targetEnd = new Date(Date.UTC(targetYear, targetMonth, 0)); // last day of month

		if (startDate > targetEnd) return [];
		if (endDate && endDate < targetStart) return [];

		const interval = entry.fixedInterval ?? "monthly";
		const rows: LedgerRow[] = [];

		if (interval === "monthly") {
			// Check if this month is on or after start
			if (
				targetYear > startDate.getUTCFullYear() ||
				(targetYear === startDate.getUTCFullYear() &&
					targetMonth >= startDate.getUTCMonth() + 1)
			) {
				const day = Math.min(startDate.getUTCDate(), targetEnd.getUTCDate());
				const dateStr = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
				rows.push(this.entryToLedgerRow(entry, dateStr, entry.amount));
			}
		} else if (interval === "weekly") {
			// Find all weeks in target month that match the weekday
			const weekday = startDate.getUTCDay();
			const cursor = new Date(targetStart);

			while (cursor.getUTCDay() !== weekday) {
				cursor.setUTCDate(cursor.getUTCDate() + 1);
			}

			while (cursor <= targetEnd) {
				if (cursor >= startDate && (!endDate || cursor <= endDate)) {
					const dateStr = cursor.toISOString().split("T")[0];
					rows.push(this.entryToLedgerRow(entry, dateStr, entry.amount));
				}
				cursor.setUTCDate(cursor.getUTCDate() + 7);
			}
		} else if (interval === "yearly") {
			if (startDate.getUTCMonth() + 1 === targetMonth) {
				if (
					targetYear > startDate.getUTCFullYear() ||
					(targetYear === startDate.getUTCFullYear())
				) {
					const day = Math.min(startDate.getUTCDate(), targetEnd.getUTCDate());
					const dateStr = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
					rows.push(this.entryToLedgerRow(entry, dateStr, entry.amount));
				}
			}
		}

		return rows;
	}

	private expandSplit(entry: Entry, targetYear: number, targetMonth: number): LedgerRow[] {
		const splitMonths = entry.splitMonths ?? 1;
		const startDate = new Date(entry.date);
		const startYear = startDate.getUTCFullYear();
		const startMonth = startDate.getUTCMonth() + 1;

		// Calculate if the target month falls within the split range
		const monthsDiff =
			(targetYear - startYear) * 12 + (targetMonth - startMonth);

		if (monthsDiff >= 0 && monthsDiff < splitMonths) {
			const installmentAmount = Math.round(entry.amount / splitMonths);
			const day = Math.min(
				startDate.getUTCDate(),
				new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate(),
			);
			const dateStr = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
			return [this.entryToLedgerRow(entry, dateStr, installmentAmount)];
		}

		return [];
	}

	private entryToLedgerRow(entry: Entry, date: string, amount: number): LedgerRow {
		return {
			entryId: entry.id,
			accountId: entry.accountId,
			toAccountId: entry.toAccountId,
			type: entry.type,
			amount,
			description: entry.description,
			categoryId: entry.categoryId,
			date,
			schedule: entry.schedule,
		};
	}
}
