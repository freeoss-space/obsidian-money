// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { MoneySidebarView, MONEY_SIDEBAR_VIEW_TYPE } from "../src/views/sidebar-view";
import initSqlJs from "sql.js";
import { Database } from "../src/db/database";
import { MoneyStore } from "../src/services/store";

/** Minimal plugin stub that provides a store */
function createPluginStub(store: MoneyStore) {
	return {
		store,
		openMainView: vi.fn(),
		openAddAccountModal: vi.fn(),
	} as unknown as import("../src/main").default;
}

let store: MoneyStore;

beforeEach(async () => {
	const SQL = await initSqlJs();
	const sqlDb = new SQL.Database();
	const db = new Database(sqlDb);
	store = new MoneyStore(db);
});

/* ───────────────────────────────────────
   Sidebar: no auto-open on load
   ─────────────────────────────────────── */

describe("Sidebar: no auto-open on load", () => {
	it("does not call openMainView automatically when the sidebar opens", async () => {
		const leaf = new WorkspaceLeaf();
		const plugin = createPluginStub(store);
		const view = new MoneySidebarView(leaf, plugin);

		await view.onOpen();

		// Merely opening the sidebar must not auto-navigate to any view
		expect(plugin.openMainView).not.toHaveBeenCalled();
	});
});

/* ───────────────────────────────────────
   Sidebar: nav items
   ─────────────────────────────────────── */

describe("Sidebar: nav items", () => {
	it("renders a Checklist nav item", async () => {
		const leaf = new WorkspaceLeaf();
		const plugin = createPluginStub(store);
		const view = new MoneySidebarView(leaf, plugin);

		await view.onOpen();

		// The sidebar content area is the second child of containerEl
		const container = view.containerEl.children[1] as HTMLElement;
		const navNames = Array.from(
			container.querySelectorAll(".money-navitem-name"),
		).map((el) => (el.textContent ?? "").trim());

		expect(navNames).toContain("Checklist");
	});

	it("calls openMainView with 'checklist' when Checklist is clicked", async () => {
		const leaf = new WorkspaceLeaf();
		const plugin = createPluginStub(store);
		const view = new MoneySidebarView(leaf, plugin);

		await view.onOpen();

		const container = view.containerEl.children[1] as HTMLElement;
		const navItems = Array.from(
			container.querySelectorAll(".money-navitem-content"),
		);
		const checklistContent = navItems.find((el) =>
			(el.querySelector(".money-navitem-name")?.textContent ?? "").trim() === "Checklist",
		) as HTMLElement | undefined;

		expect(checklistContent).toBeDefined();
		checklistContent!.click();

		expect(plugin.openMainView).toHaveBeenCalledWith("checklist");
	});
});
