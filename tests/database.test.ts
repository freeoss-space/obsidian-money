import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { Database } from "../src/db/database";

let db: Database;

beforeEach(async () => {
	const SQL = await initSqlJs();
	const sqlDb = new SQL.Database();
	db = new Database(sqlDb);
});

/* ───────────────────────────────────────
   Accounts
   ─────────────────────────────────────── */

describe("Accounts", () => {
	it("creates a bank account", () => {
		const acc = db.createAccount("Checking", "bank", "USD");
		expect(acc.name).toBe("Checking");
		expect(acc.kind).toBe("bank");
		expect(acc.currency).toBe("USD");
		expect(acc.id).toBeTruthy();
	});

	it("creates a credit card with statement day", () => {
		const cc = db.createAccount("Visa", "credit_card", "USD", 15);
		expect(cc.kind).toBe("credit_card");
		expect(cc.statementDay).toBe(15);
	});

	it("retrieves an account by ID", () => {
		const acc = db.createAccount("Savings", "bank", "EUR");
		const found = db.getAccount(acc.id);
		expect(found).toBeDefined();
		expect(found!.name).toBe("Savings");
		expect(found!.currency).toBe("EUR");
	});

	it("returns undefined for missing account", () => {
		expect(db.getAccount("nonexistent")).toBeUndefined();
	});

	it("lists all accounts", () => {
		db.createAccount("A", "bank", "USD");
		db.createAccount("B", "credit_card", "EUR");
		const all = db.getAllAccounts();
		expect(all).toHaveLength(2);
	});

	it("filters accounts by kind", () => {
		db.createAccount("Bank1", "bank", "USD");
		db.createAccount("CC1", "credit_card", "USD");
		db.createAccount("Bank2", "bank", "EUR");
		expect(db.getAccountsByKind("bank")).toHaveLength(2);
		expect(db.getAccountsByKind("credit_card")).toHaveLength(1);
	});

	it("deletes an account and its entries", () => {
		const acc = db.createAccount("ToDelete", "bank", "USD");
		db.createEntry({
			accountId: acc.id,
			type: "expense",
			amount: 1000,
			description: "test",
			schedule: "single",
			date: "2024-01-15",
		});
		db.deleteAccount(acc.id);
		expect(db.getAccount(acc.id)).toBeUndefined();
		expect(db.getEntriesByAccount(acc.id)).toHaveLength(0);
	});

	it("updates an account", () => {
		const acc = db.createAccount("Old Name", "bank", "USD");
		db.updateAccount(acc.id, "New Name", "EUR", 10);
		const updated = db.getAccount(acc.id);
		expect(updated!.name).toBe("New Name");
		expect(updated!.currency).toBe("EUR");
		expect(updated!.statementDay).toBe(10);
	});
});

/* ───────────────────────────────────────
   Categories
   ─────────────────────────────────────── */

describe("Categories", () => {
	it("creates a category", () => {
		const cat = db.createCategory("Food", "utensils");
		expect(cat.name).toBe("Food");
		expect(cat.icon).toBe("utensils");
		expect(cat.id).toBeTruthy();
	});

	it("lists all categories", () => {
		db.createCategory("Food", "utensils");
		db.createCategory("Transport", "car");
		expect(db.getAllCategories()).toHaveLength(2);
	});

	it("retrieves a category by ID", () => {
		const cat = db.createCategory("Shopping", "shopping-bag");
		const found = db.getCategory(cat.id);
		expect(found).toBeDefined();
		expect(found!.name).toBe("Shopping");
	});

	it("deletes a category and nullifies entries", () => {
		const acc = db.createAccount("Bank", "bank", "USD");
		const cat = db.createCategory("Food", "utensils");
		const entry = db.createEntry({
			accountId: acc.id,
			type: "expense",
			amount: 500,
			description: "lunch",
			categoryId: cat.id,
			schedule: "single",
			date: "2024-01-15",
		});
		db.deleteCategory(cat.id);
		expect(db.getCategory(cat.id)).toBeUndefined();
		const updatedEntry = db.getEntry(entry.id);
		expect(updatedEntry!.categoryId).toBeUndefined();
	});

	it("supports parent categories", () => {
		const parent = db.createCategory("Food", "utensils");
		const child = db.createCategory("Groceries", "shopping-cart", parent.id);
		expect(child.parentId).toBe(parent.id);
	});
});

/* ───────────────────────────────────────
   Entries
   ─────────────────────────────────────── */

describe("Entries", () => {
	let bankId: string;
	let ccId: string;
	let catId: string;

	beforeEach(() => {
		const bank = db.createAccount("Checking", "bank", "USD");
		const cc = db.createAccount("Visa", "credit_card", "USD", 15);
		const cat = db.createCategory("Food", "utensils");
		bankId = bank.id;
		ccId = cc.id;
		catId = cat.id;
	});

	it("creates a single expense", () => {
		const e = db.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 2500,
			description: "Groceries",
			categoryId: catId,
			schedule: "single",
			date: "2024-03-10",
		});
		expect(e.type).toBe("expense");
		expect(e.amount).toBe(2500);
		expect(e.schedule).toBe("single");
	});

	it("creates a fixed (recurring) entry", () => {
		const e = db.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 10000,
			description: "Rent",
			schedule: "fixed",
			date: "2024-01-01",
			fixedInterval: "monthly",
			fixedEndDate: "2024-12-31",
		});
		expect(e.schedule).toBe("fixed");
		expect(e.fixedInterval).toBe("monthly");
		expect(e.fixedEndDate).toBe("2024-12-31");
	});

	it("creates a split entry", () => {
		const e = db.createEntry({
			accountId: ccId,
			type: "expense",
			amount: 120000,
			description: "Laptop",
			schedule: "split",
			date: "2024-02-01",
			splitMonths: 12,
		});
		expect(e.schedule).toBe("split");
		expect(e.splitMonths).toBe(12);
	});

	it("creates an income entry", () => {
		const e = db.createEntry({
			accountId: bankId,
			type: "income",
			amount: 500000,
			description: "Salary",
			schedule: "fixed",
			date: "2024-01-01",
			fixedInterval: "monthly",
		});
		expect(e.type).toBe("income");
	});

	it("creates a transfer between accounts", () => {
		const e = db.createEntry({
			accountId: bankId,
			toAccountId: ccId,
			type: "transfer",
			amount: 50000,
			description: "Pay credit card",
			schedule: "single",
			date: "2024-03-15",
		});
		expect(e.type).toBe("transfer");
		expect(e.toAccountId).toBe(ccId);
	});

	it("retrieves entries by account (includes both sides of transfer)", () => {
		db.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 1000,
			description: "Coffee",
			schedule: "single",
			date: "2024-03-01",
		});
		db.createEntry({
			accountId: bankId,
			toAccountId: ccId,
			type: "transfer",
			amount: 5000,
			description: "CC payment",
			schedule: "single",
			date: "2024-03-02",
		});

		const bankEntries = db.getEntriesByAccount(bankId);
		expect(bankEntries).toHaveLength(2);

		const ccEntries = db.getEntriesByAccount(ccId);
		expect(ccEntries).toHaveLength(1);
	});

	it("deletes an entry", () => {
		const e = db.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 500,
			description: "Snack",
			schedule: "single",
			date: "2024-03-01",
		});
		db.deleteEntry(e.id);
		expect(db.getEntry(e.id)).toBeUndefined();
	});

	it("updates an entry", () => {
		const e = db.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 500,
			description: "Snack",
			schedule: "single",
			date: "2024-03-01",
		});
		db.updateEntry(e.id, { amount: 750, description: "Big snack" });
		const updated = db.getEntry(e.id);
		expect(updated!.amount).toBe(750);
		expect(updated!.description).toBe("Big snack");
	});

	it("lists all entries", () => {
		db.createEntry({
			accountId: bankId,
			type: "expense",
			amount: 100,
			description: "a",
			schedule: "single",
			date: "2024-01-01",
		});
		db.createEntry({
			accountId: bankId,
			type: "income",
			amount: 200,
			description: "b",
			schedule: "single",
			date: "2024-02-01",
		});
		expect(db.getAllEntries()).toHaveLength(2);
	});
});

/* ───────────────────────────────────────
   Database Export
   ─────────────────────────────────────── */

describe("Database export/import", () => {
	it("exports and re-imports data", async () => {
		db.createAccount("Test", "bank", "USD");
		db.createCategory("Food", "utensils");

		const data = db.export();
		expect(data).toBeInstanceOf(Uint8Array);
		expect(data.length).toBeGreaterThan(0);

		// Re-import
		const SQL = await initSqlJs();
		const newSqlDb = new SQL.Database(data);
		const newDb = new Database(newSqlDb);
		expect(newDb.getAllAccounts()).toHaveLength(1);
		expect(newDb.getAllCategories()).toHaveLength(1);
	});
});
