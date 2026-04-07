/* ──────────────────────────────────────
   Types for obsidian-money plugin
   ────────────────────────────────────── */

/** Unique ID type (UUID string) */
export type EntityId = string;

/* ── Account types ─────────────────── */

export type AccountKind = "bank" | "credit_card";

export interface Account {
	id: EntityId;
	name: string;
	kind: AccountKind;
	/** ISO 4217 currency code, e.g. "USD" */
	currency: string;
	/** Only for credit cards: monthly statement day (1-28) */
	statementDay?: number;
	createdAt: string; // ISO date
}

/* ── Category ──────────────────────── */

export interface Category {
	id: EntityId;
	name: string;
	icon: string;
	parentId?: EntityId;
}

/* ── Entry types ───────────────────── */

export type EntryType = "expense" | "income" | "transfer";

/** How the entry recurs */
export type EntrySchedule = "single" | "fixed" | "split";

export interface Entry {
	id: EntityId;
	accountId: EntityId;
	/** For transfers: the destination account */
	toAccountId?: EntityId;
	type: EntryType;
	/** Total amount in cents (positive) */
	amount: number;
	description: string;
	categoryId?: EntityId;
	schedule: EntrySchedule;
	/** ISO date of the entry (or first occurrence) */
	date: string;
	/** For fixed: recurrence interval */
	fixedInterval?: "monthly" | "weekly" | "yearly";
	/** For fixed: optional end date (ISO) */
	fixedEndDate?: string;
	/** For split: how many months to split over */
	splitMonths?: number;
	createdAt: string; // ISO date
}

/* ── Computed / view helpers ───────── */

/** A "materialised" row for a given month (from fixed / split entries) */
export interface LedgerRow {
	entryId: EntityId;
	accountId: EntityId;
	toAccountId?: EntityId;
	type: EntryType;
	/** Amount for this particular occurrence (cents) */
	amount: number;
	description: string;
	categoryId?: EntityId;
	date: string; // ISO date of this occurrence
	schedule: EntrySchedule;
}

/** Monthly summary for an account */
export interface MonthSummary {
	accountId: EntityId;
	month: string; // "YYYY-MM"
	totalIncome: number;
	totalExpenses: number;
	balance: number;
}

/* ── Plugin settings ───────────────── */

export interface MoneyPluginSettings {
	dbFileName: string;
	defaultCurrency: string;
}

export const DEFAULT_SETTINGS: MoneyPluginSettings = {
	dbFileName: "money.db",
	defaultCurrency: "USD",
};

/* ── Default categories ────────────── */

export const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
	{ name: "Food & Dining", icon: "utensils" },
	{ name: "Transportation", icon: "car" },
	{ name: "Housing", icon: "home" },
	{ name: "Utilities", icon: "zap" },
	{ name: "Healthcare", icon: "heart-pulse" },
	{ name: "Entertainment", icon: "tv" },
	{ name: "Shopping", icon: "shopping-bag" },
	{ name: "Education", icon: "graduation-cap" },
	{ name: "Savings", icon: "piggy-bank" },
	{ name: "Income", icon: "banknote" },
	{ name: "Transfer", icon: "arrow-right-left" },
	{ name: "Other", icon: "circle-dot" },
];
