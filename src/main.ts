import { Plugin, Notice, WorkspaceLeaf } from "obsidian";
import sqlWasmBinary from "../node_modules/sql.js/dist/sql-wasm.wasm";
import { initSqlDatabase } from "./db/init";
import { MoneyStore } from "./services/store";
import { MoneySidebarView, MONEY_SIDEBAR_VIEW_TYPE } from "./views/sidebar-view";
import { MoneyMainView, MONEY_MAIN_VIEW_TYPE } from "./views/main-view";
import type { MainViewMode } from "./views/main-view";
import { AddAccountModal } from "./modals/add-account-modal";
import { AddEntryModal } from "./modals/add-entry-modal";
import type { MoneyPluginSettings } from "./types";
import { DEFAULT_SETTINGS, DEFAULT_CATEGORIES } from "./types";

export default class MoneyPlugin extends Plugin {
	store: MoneyStore | null = null;
	private settings: MoneyPluginSettings = DEFAULT_SETTINGS;
	private dbPath = "";

	async onload(): Promise<void> {
		// Load settings
		const saved = await this.loadData();
		if (saved) {
			this.settings = { ...DEFAULT_SETTINGS, ...saved };
		}

		// Initialize database
		await this.initDatabase();

		// Register views
		this.registerView(
			MONEY_SIDEBAR_VIEW_TYPE,
			(leaf) => new MoneySidebarView(leaf, this),
		);
		this.registerView(
			MONEY_MAIN_VIEW_TYPE,
			(leaf) => new MoneyMainView(leaf, this),
		);

		// Ribbon icon
		this.addRibbonIcon("banknote", "Money", () => {
			this.activateSidebar();
		});

		// Commands
		this.addCommand({
			id: "open-money-sidebar",
			name: "Open Money sidebar",
			callback: () => this.activateSidebar(),
		});

		this.addCommand({
			id: "add-entry",
			name: "Add new entry",
			callback: () => this.openAddEntryModal(),
		});

		this.addCommand({
			id: "add-account",
			name: "Add new account",
			callback: () => this.openAddAccountModal(),
		});

		// Auto-save periodically
		this.registerInterval(
			window.setInterval(() => this.persistData(), 60_000),
		);
	}

	async onunload(): Promise<void> {
		await this.persistData();
		this.app.workspace.detachLeavesOfType(MONEY_SIDEBAR_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(MONEY_MAIN_VIEW_TYPE);
	}

	/* ── Database initialisation ──────── */

	private async initDatabase(): Promise<void> {
		const pluginDir = this.manifest.dir ?? "";
		this.dbPath = `${pluginDir}/${this.settings.dbFileName}`;

		let existingData: Uint8Array | undefined;
		const exists = await this.app.vault.adapter.exists(this.dbPath);
		if (exists) {
			const buffer = await this.app.vault.adapter.readBinary(this.dbPath);
			existingData = new Uint8Array(buffer);
		}

		const db = await initSqlDatabase(sqlWasmBinary, existingData);
		this.store = new MoneyStore(db);

		// Seed default categories
		this.store.seedDefaultCategories(DEFAULT_CATEGORIES);

		// Persist after seeding
		if (!exists) {
			await this.persistData();
		}
	}

	/* ── Data persistence ─────────────── */

	async persistData(): Promise<void> {
		if (!this.store) return;
		const data = this.store.db.export();
		await this.app.vault.adapter.writeBinary(this.dbPath, data.buffer);
	}

	/* ── View management ──────────────── */

	async activateSidebar(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(MONEY_SIDEBAR_VIEW_TYPE);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({
			type: MONEY_SIDEBAR_VIEW_TYPE,
			active: true,
		});
		this.app.workspace.revealLeaf(leaf);
	}

	async openMainView(mode: MainViewMode, accountId?: string): Promise<void> {
		let leaf: WorkspaceLeaf;
		const existing = this.app.workspace.getLeavesOfType(MONEY_MAIN_VIEW_TYPE);
		if (existing.length > 0) {
			leaf = existing[0];
		} else {
			leaf = this.app.workspace.getLeaf("tab");
			await leaf.setViewState({
				type: MONEY_MAIN_VIEW_TYPE,
				active: true,
			});
		}
		this.app.workspace.revealLeaf(leaf);

		const view = leaf.view as MoneyMainView;
		if (view && typeof view.setMode === "function") {
			view.setMode(mode, accountId);
		}
	}

	/* ── Modals ───────────────────────── */

	openAddAccountModal(): void {
		new AddAccountModal(this.app, this).open();
	}

	openAddEntryModal(presetAccountId?: string): void {
		new AddEntryModal(this.app, this, presetAccountId).open();
	}

	/* ── Refresh helpers ──────────────── */

	refreshSidebar(): void {
		const leaves = this.app.workspace.getLeavesOfType(MONEY_SIDEBAR_VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view as MoneySidebarView;
			if (view && typeof view.refresh === "function") {
				view.refresh();
			}
		}
	}

	refreshMainView(): void {
		const leaves = this.app.workspace.getLeavesOfType(MONEY_MAIN_VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view as MoneyMainView;
			if (view && typeof view.refresh === "function") {
				view.refresh();
			}
		}
	}
}
