import { describe, it, expect } from "vitest";
import fs from "fs";
import { initSqlDatabase } from "../src/db/init";

const wasmBinary = fs.readFileSync(
	"node_modules/sql.js/dist/sql-wasm.wasm",
);

describe("initSqlDatabase", () => {
	it("creates a fresh database with explicit wasmBinary", async () => {
		const db = await initSqlDatabase(wasmBinary);
		const acc = db.createAccount("Test", "bank", "USD");
		expect(acc.name).toBe("Test");
	});

	it("restores an existing database from exported data", async () => {
		const db1 = await initSqlDatabase(wasmBinary);
		db1.createAccount("Savings", "bank", "EUR");
		const exported = db1.export();

		const db2 = await initSqlDatabase(wasmBinary, exported);
		expect(db2.getAllAccounts()).toHaveLength(1);
		expect(db2.getAllAccounts()[0].name).toBe("Savings");
	});
});
