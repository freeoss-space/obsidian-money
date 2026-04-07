import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { Database } from "../src/db/database";
import { MoneyStore } from "../src/services/store";

let store: MoneyStore;

beforeEach(async () => {
	const SQL = await initSqlJs();
	const sqlDb = new SQL.Database();
	const db = new Database(sqlDb);
	store = new MoneyStore(db);
});

/* ───────────────────────────────────────
   Store: Account management
   ─────────────────────────────────────── */

describe("Store: Accounts", () => {
	it("creates and retrieves bank accounts", () => {
		store.createAccount("Checking", "bank", "USD");
		store.createAccount("Savings", "bank", "USD");
		expect(store.getBankAccounts()).toHaveLength(2);
	});

	it("creates and retrieves credit cards", () => {
		store.createAccount("Visa", "credit_card", "USD", 15);
		expect(store.getCreditCards()).toHaveLength(1);
		expect(store.getCreditCards()[0].statementDay).toBe(15);
	});

	it("lists all accounts", () => {
		store.createAccount("Checking", "bank", "USD");
		store.createAccount("Visa", "credit_card", "USD", 15);
		expect(store.getAllAccounts()).toHaveLength(2);
	});
});

/* ───────────────────────────────────────
   Store: Categories
   ─────────────────────────────────────── */

describe("Store: Categories", () => {
	it("seeds default categories without duplicates", () => {
		const defaults = [
			{ name: "Food", icon: "utensils" },
			{ name: "Transport", icon: "car" },
		];
		store.seedDefaultCategories(defaults);
		expect(store.getAllCategories()).toHaveLength(2);

		// Seed again – no duplicates
		store.seedDefaultCategories(defaults);
		expect(store.getAllCategories()).toHaveLength(2);
	});
});

/* ───────────────────────────────────────
   Store: Ledger expansion – single entries
   ─────────────────────────────────────── */

describe("Store: Ledger – single entries", () => {
	let bankId: string;

	beforeEach(() => {
		const bank = store.createAccount("Checking", "bank", "USD");
		bankId = bank.id;
	});

	it("includes a single entry in its month", () => {
		store.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 2500,
			description: "Coffee",
			schedule: "single",
			date: "2024-03-10",
		});

		const rows = store.getLedgerForMonth("2024-03");
		expect(rows).toHaveLength(1);
		expect(rows[0].amount).toBe(2500);
		expect(rows[0].date).toBe("2024-03-10");
	});

	it("excludes a single entry outside its month", () => {
		store.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 2500,
			description: "Coffee",
			schedule: "single",
			date: "2024-03-10",
		});

		expect(store.getLedgerForMonth("2024-04")).toHaveLength(0);
		expect(store.getLedgerForMonth("2024-02")).toHaveLength(0);
	});
});

/* ───────────────────────────────────────
   Store: Ledger expansion – fixed entries
   ─────────────────────────────────────── */

describe("Store: Ledger – fixed entries", () => {
	let bankId: string;

	beforeEach(() => {
		const bank = store.createAccount("Checking", "bank", "USD");
		bankId = bank.id;
	});

	it("expands a monthly fixed entry into each month", () => {
		store.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 100000,
			description: "Rent",
			schedule: "fixed",
			date: "2024-01-01",
			fixedInterval: "monthly",
		});

		for (const m of ["2024-01", "2024-02", "2024-03", "2024-06", "2024-12"]) {
			const rows = store.getLedgerForMonth(m);
			expect(rows).toHaveLength(1);
			expect(rows[0].amount).toBe(100000);
		}
	});

	it("respects fixedEndDate", () => {
		store.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 5000,
			description: "Subscription",
			schedule: "fixed",
			date: "2024-01-15",
			fixedInterval: "monthly",
			fixedEndDate: "2024-06-30",
		});

		expect(store.getLedgerForMonth("2024-03")).toHaveLength(1);
		expect(store.getLedgerForMonth("2024-06")).toHaveLength(1);
		expect(store.getLedgerForMonth("2024-07")).toHaveLength(0);
	});

	it("does not appear before start date", () => {
		store.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 5000,
			description: "Subscription",
			schedule: "fixed",
			date: "2024-06-01",
			fixedInterval: "monthly",
		});

		expect(store.getLedgerForMonth("2024-05")).toHaveLength(0);
		expect(store.getLedgerForMonth("2024-06")).toHaveLength(1);
	});

	it("expands weekly fixed entries", () => {
		// 2024-03-04 is a Monday
		store.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 1000,
			description: "Weekly coffee",
			schedule: "fixed",
			date: "2024-03-04",
			fixedInterval: "weekly",
		});

		const rows = store.getLedgerForMonth("2024-03");
		// March 2024 has Mondays on 4, 11, 18, 25
		expect(rows).toHaveLength(4);
	});

	it("expands yearly fixed entries only in matching month", () => {
		store.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 50000,
			description: "Annual insurance",
			schedule: "fixed",
			date: "2024-03-15",
			fixedInterval: "yearly",
		});

		expect(store.getLedgerForMonth("2024-03")).toHaveLength(1);
		expect(store.getLedgerForMonth("2024-04")).toHaveLength(0);
		expect(store.getLedgerForMonth("2025-03")).toHaveLength(1);
	});
});

/* ───────────────────────────────────────
   Store: Ledger expansion – split entries
   ─────────────────────────────────────── */

describe("Store: Ledger – split entries", () => {
	let ccId: string;

	beforeEach(() => {
		const cc = store.createAccount("Visa", "credit_card", "USD", 15);
		ccId = cc.id;
	});

	it("splits an entry across specified months", () => {
		store.createEntry({
			accountId: ccId,
			type: "expense",
			amount: 120000, // $1200 → $100/month for 12 months
			description: "Laptop",
			schedule: "split",
			date: "2024-01-15",
			splitMonths: 12,
		});

		// Months 1–12 should each have an installment
		for (let m = 1; m <= 12; m++) {
			const rows = store.getLedgerForMonth(`2024-${String(m).padStart(2, "0")}`);
			expect(rows).toHaveLength(1);
			expect(rows[0].amount).toBe(10000); // 120000 / 12
		}

		// Month 13 (Jan 2025) should not have it
		expect(store.getLedgerForMonth("2025-01")).toHaveLength(0);
	});

	it("handles uneven split amounts", () => {
		store.createEntry({
			accountId: ccId,
			type: "expense",
			amount: 10000, // $100 split over 3 months
			description: "Something",
			schedule: "split",
			date: "2024-06-01",
			splitMonths: 3,
		});

		const rows1 = store.getLedgerForMonth("2024-06");
		expect(rows1[0].amount).toBe(3333); // Math.round(10000/3)
	});
});

/* ───────────────────────────────────────
   Store: Monthly summaries
   ─────────────────────────────────────── */

describe("Store: Monthly summaries", () => {
	let bankId: string;
	let ccId: string;

	beforeEach(() => {
		const bank = store.createAccount("Checking", "bank", "USD");
		const cc = store.createAccount("Visa", "credit_card", "USD", 15);
		bankId = bank.id;
		ccId = cc.id;
	});

	it("calculates account-level summary", () => {
		store.createEntry({
			accountId: bankId,
			type: "income",
			amount: 500000,
			description: "Salary",
			schedule: "single",
			date: "2024-03-01",
		});
		store.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 100000,
			description: "Rent",
			schedule: "single",
			date: "2024-03-05",
		});
		store.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 5000,
			description: "Coffee",
			schedule: "single",
			date: "2024-03-10",
		});

		const summary = store.getMonthSummary(bankId, "2024-03");
		expect(summary.totalIncome).toBe(500000);
		expect(summary.totalExpenses).toBe(105000);
		expect(summary.balance).toBe(395000);
	});

	it("transfer counts as expense for source and income for destination", () => {
		store.createEntry({
			accountId: bankId,
			toAccountId: ccId,
			type: "transfer",
			amount: 50000,
			description: "Pay credit card",
			schedule: "single",
			date: "2024-03-15",
		});

		const bankSummary = store.getMonthSummary(bankId, "2024-03");
		expect(bankSummary.totalExpenses).toBe(50000);
		expect(bankSummary.totalIncome).toBe(0);

		const ccSummary = store.getMonthSummary(ccId, "2024-03");
		expect(ccSummary.totalIncome).toBe(50000);
		expect(ccSummary.totalExpenses).toBe(0);
	});

	it("overall summary excludes transfers", () => {
		store.createEntry({
			accountId: bankId,
			type: "income",
			amount: 500000,
			description: "Salary",
			schedule: "single",
			date: "2024-03-01",
		});
		store.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 100000,
			description: "Rent",
			schedule: "single",
			date: "2024-03-05",
		});
		store.createEntry({
			accountId: bankId,
			toAccountId: ccId,
			type: "transfer",
			amount: 50000,
			description: "CC payment",
			schedule: "single",
			date: "2024-03-15",
		});

		const overall = store.getOverallMonthSummary("2024-03");
		expect(overall.totalIncome).toBe(500000);
		expect(overall.totalExpenses).toBe(100000);
		expect(overall.balance).toBe(400000);
	});

	it("groups expenses by category", () => {
		const food = store.createCategory("Food", "utensils");
		const transport = store.createCategory("Transport", "car");

		store.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 3000,
			description: "Lunch",
			categoryId: food.id,
			schedule: "single",
			date: "2024-03-01",
		});
		store.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 2000,
			description: "Dinner",
			categoryId: food.id,
			schedule: "single",
			date: "2024-03-02",
		});
		store.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 5000,
			description: "Gas",
			categoryId: transport.id,
			schedule: "single",
			date: "2024-03-03",
		});
		store.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 1000,
			description: "Unknown",
			schedule: "single",
			date: "2024-03-04",
		});

		const byCategory = store.getExpensesByCategory("2024-03");
		expect(byCategory.get(food.id)).toBe(5000);
		expect(byCategory.get(transport.id)).toBe(5000);
		expect(byCategory.get("uncategorized")).toBe(1000);
	});
});
