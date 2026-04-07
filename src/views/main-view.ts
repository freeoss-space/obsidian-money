import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type MoneyPlugin from "../main";
import type { Account, LedgerRow, MonthSummary, Category, EntityId } from "../types";

export const MONEY_MAIN_VIEW_TYPE = "money-main-view";

export type MainViewMode = "overview" | "charts" | "account";

export class MoneyMainView extends ItemView {
	private plugin: MoneyPlugin;
	private mode: MainViewMode = "overview";
	private accountId: string = "";
	private currentMonth: string;

	constructor(leaf: WorkspaceLeaf, plugin: MoneyPlugin) {
		super(leaf);
		this.plugin = plugin;
		const now = new Date();
		this.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
	}

	getViewType(): string {
		return MONEY_MAIN_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Money";
	}

	getIcon(): string {
		return "banknote";
	}

	setMode(mode: MainViewMode, accountId?: string): void {
		this.mode = mode;
		this.accountId = accountId ?? "";
		this.render();
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	async onClose(): Promise<void> {
		this.containerEl.empty();
	}

	public refresh(): void {
		this.render();
	}

	/* ── Main render ──────────────────── */

	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("money-main-view");

		switch (this.mode) {
			case "overview":
				this.renderOverview(container);
				break;
			case "charts":
				this.renderCharts(container);
				break;
			case "account":
				this.renderAccount(container);
				break;
		}
	}

	/* ── Month navigation ─────────────── */

	private renderMonthNav(parent: HTMLElement): void {
		const nav = parent.createDiv({ cls: "money-month-nav" });

		const prevBtn = nav.createEl("button", {
			cls: "money-icon-button",
			attr: { "aria-label": "Previous month" },
		});
		setIcon(prevBtn, "chevron-left");
		prevBtn.addEventListener("click", () => {
			this.changeMonth(-1);
		});

		const monthLabel = nav.createEl("span", {
			cls: "money-month-label",
			text: this.formatMonth(this.currentMonth),
		});

		const nextBtn = nav.createEl("button", {
			cls: "money-icon-button",
			attr: { "aria-label": "Next month" },
		});
		setIcon(nextBtn, "chevron-right");
		nextBtn.addEventListener("click", () => {
			this.changeMonth(1);
		});
	}

	private changeMonth(delta: number): void {
		const [year, month] = this.currentMonth.split("-").map(Number);
		const d = new Date(Date.UTC(year, month - 1 + delta, 1));
		this.currentMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
		this.render();
	}

	private formatMonth(month: string): string {
		const [year, m] = month.split("-").map(Number);
		const date = new Date(Date.UTC(year, m - 1, 1));
		return date.toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "UTC" });
	}

	/* ── Overview ─────────────────────── */

	private renderOverview(container: HTMLElement): void {
		const store = this.plugin.store;
		if (!store) return;

		// Header
		const header = container.createDiv({ cls: "money-view-header" });
		header.createEl("h2", { text: "Overview", cls: "money-view-title" });

		const addBtn = header.createEl("button", {
			cls: "money-btn money-btn-primary",
			text: "+ Add Entry",
		});
		addBtn.addEventListener("click", () => {
			this.plugin.openAddEntryModal();
		});

		// Month navigation
		this.renderMonthNav(container);

		// Overall summary
		const overall = store.getOverallMonthSummary(this.currentMonth);
		this.renderSummaryCards(container, overall);

		// Account summaries
		const accounts = store.getAllAccounts();
		if (accounts.length > 0) {
			const accountsSection = container.createDiv({ cls: "money-section" });
			accountsSection.createEl("h3", { text: "Accounts", cls: "money-section-title" });

			const grid = accountsSection.createDiv({ cls: "money-account-grid" });
			for (const account of accounts) {
				const summary = store.getMonthSummary(account.id, this.currentMonth);
				this.renderAccountCard(grid, account, summary);
			}
		}

		// Credit card monthly totals
		const ccTotals = store.getCreditCardMonthlyTotals(this.currentMonth);
		const ccEntries = Array.from(ccTotals.entries()).filter(([_, info]) => info.total > 0);
		if (ccEntries.length > 0) {
			const ccSection = container.createDiv({ cls: "money-section" });
			ccSection.createEl("h3", { text: "Credit Card Statements", cls: "money-section-title" });

			const ccGrid = ccSection.createDiv({ cls: "money-cc-grid" });
			for (const [ccId, info] of ccEntries) {
				const card = ccGrid.createDiv({ cls: "money-cc-statement-card" });
				const cardHeader = card.createDiv({ cls: "money-cc-statement-header" });
				const iconEl = cardHeader.createDiv({ cls: "money-navitem-icon" });
				setIcon(iconEl, "credit-card");
				cardHeader.createSpan({ text: info.name, cls: "money-cc-statement-name" });
				if (info.statementDay) {
					cardHeader.createSpan({
						text: `Day ${info.statementDay}`,
						cls: "money-cc-statement-day",
					});
				}
				card.createDiv({
					cls: "money-cc-statement-total",
					text: this.formatCurrency(info.total),
				});
				card.addEventListener("click", () => {
					this.plugin.openMainView("account", ccId);
				});
			}
		}

		// Recent entries
		const ledger = store.getLedgerForMonth(this.currentMonth);
		if (ledger.length > 0) {
			const entriesSection = container.createDiv({ cls: "money-section" });
			entriesSection.createEl("h3", { text: "Entries", cls: "money-section-title" });
			this.renderLedgerTable(entriesSection, ledger, true);
		}
	}

	/* ── Charts ───────────────────────── */

	private renderCharts(container: HTMLElement): void {
		const store = this.plugin.store;
		if (!store) return;

		const header = container.createDiv({ cls: "money-view-header" });
		header.createEl("h2", { text: "Charts", cls: "money-view-title" });

		this.renderMonthNav(container);

		// Expenses by category (bar chart via CSS)
		const byCategory = store.getExpensesByCategory(this.currentMonth);
		const categories = store.getAllCategories();
		const catMap = new Map(categories.map((c) => [c.id, c]));

		if (byCategory.size > 0) {
			const section = container.createDiv({ cls: "money-section" });
			section.createEl("h3", { text: "Expenses by Category", cls: "money-section-title" });

			const maxAmount = Math.max(...byCategory.values());
			const chartEl = section.createDiv({ cls: "money-bar-chart" });

			for (const [catId, amount] of byCategory) {
				const cat = catMap.get(catId);
				const label = cat?.name ?? "Uncategorized";
				const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;

				const row = chartEl.createDiv({ cls: "money-bar-row" });
				const labelEl = row.createDiv({ cls: "money-bar-label" });

				if (cat) {
					const iconEl = labelEl.createDiv({ cls: "money-bar-icon" });
					setIcon(iconEl, cat.icon);
				}
				labelEl.createSpan({ text: label });

				const barContainer = row.createDiv({ cls: "money-bar-container" });
				const bar = barContainer.createDiv({ cls: "money-bar" });
				bar.style.width = `${pct}%`;

				row.createDiv({
					cls: "money-bar-value",
					text: this.formatCurrency(amount),
				});
			}
		} else {
			container.createDiv({
				cls: "money-empty",
				text: "No expenses this month.",
			});
		}

		// Income vs Expenses comparison
		const overall = store.getOverallMonthSummary(this.currentMonth);
		if (overall.totalIncome > 0 || overall.totalExpenses > 0) {
			const section = container.createDiv({ cls: "money-section" });
			section.createEl("h3", { text: "Income vs Expenses", cls: "money-section-title" });

			const compEl = section.createDiv({ cls: "money-comparison" });
			const maxVal = Math.max(overall.totalIncome, overall.totalExpenses);

			const incomeRow = compEl.createDiv({ cls: "money-bar-row" });
			incomeRow.createDiv({ cls: "money-bar-label", text: "Income" });
			const incomeBarContainer = incomeRow.createDiv({ cls: "money-bar-container" });
			const incomeBar = incomeBarContainer.createDiv({ cls: "money-bar money-bar-income" });
			incomeBar.style.width = `${maxVal > 0 ? (overall.totalIncome / maxVal) * 100 : 0}%`;
			incomeRow.createDiv({
				cls: "money-bar-value",
				text: this.formatCurrency(overall.totalIncome),
			});

			const expenseRow = compEl.createDiv({ cls: "money-bar-row" });
			expenseRow.createDiv({ cls: "money-bar-label", text: "Expenses" });
			const expenseBarContainer = expenseRow.createDiv({ cls: "money-bar-container" });
			const expenseBar = expenseBarContainer.createDiv({ cls: "money-bar money-bar-expense" });
			expenseBar.style.width = `${maxVal > 0 ? (overall.totalExpenses / maxVal) * 100 : 0}%`;
			expenseRow.createDiv({
				cls: "money-bar-value",
				text: this.formatCurrency(overall.totalExpenses),
			});
		}
	}

	/* ── Account detail ───────────────── */

	private renderAccount(container: HTMLElement): void {
		const store = this.plugin.store;
		if (!store) return;

		const account = store.getAccount(this.accountId);
		if (!account) {
			container.createDiv({ cls: "money-empty", text: "Account not found." });
			return;
		}

		// Header
		const header = container.createDiv({ cls: "money-view-header" });
		const titleGroup = header.createDiv({ cls: "money-title-group" });
		const iconEl = titleGroup.createDiv({ cls: "money-title-icon" });
		setIcon(iconEl, account.kind === "bank" ? "landmark" : "credit-card");
		titleGroup.createEl("h2", { text: account.name, cls: "money-view-title" });

		const btnGroup = header.createDiv({ cls: "money-btn-group" });
		const addBtn = btnGroup.createEl("button", {
			cls: "money-btn money-btn-primary",
			text: "+ Add Entry",
		});
		addBtn.addEventListener("click", () => {
			this.plugin.openAddEntryModal(this.accountId);
		});

		// Month navigation
		this.renderMonthNav(container);

		// Summary for this account
		const summary = store.getMonthSummary(this.accountId, this.currentMonth);
		this.renderSummaryCards(container, summary);

		// Ledger rows for this account
		const allRows = store.getLedgerForMonth(this.currentMonth);
		const accountRows = allRows.filter(
			(r) => r.accountId === this.accountId || r.toAccountId === this.accountId,
		);

		if (accountRows.length > 0) {
			const section = container.createDiv({ cls: "money-section" });
			section.createEl("h3", { text: "Transactions", cls: "money-section-title" });
			this.renderLedgerTable(section, accountRows, false);
		} else {
			container.createDiv({
				cls: "money-empty",
				text: "No transactions this month.",
			});
		}
	}

	/* ── Shared render helpers ────────── */

	private renderSummaryCards(parent: HTMLElement, summary: MonthSummary): void {
		const cards = parent.createDiv({ cls: "money-summary-cards" });

		const incomeCard = cards.createDiv({ cls: "money-summary-card money-summary-income" });
		incomeCard.createDiv({ cls: "money-summary-label", text: "Income" });
		incomeCard.createDiv({
			cls: "money-summary-value",
			text: this.formatCurrency(summary.totalIncome),
		});

		const expenseCard = cards.createDiv({ cls: "money-summary-card money-summary-expense" });
		expenseCard.createDiv({ cls: "money-summary-label", text: "Expenses" });
		expenseCard.createDiv({
			cls: "money-summary-value",
			text: this.formatCurrency(summary.totalExpenses),
		});

		const balanceCard = cards.createDiv({
			cls: `money-summary-card ${summary.balance >= 0 ? "money-summary-positive" : "money-summary-negative"}`,
		});
		balanceCard.createDiv({ cls: "money-summary-label", text: "Balance" });
		balanceCard.createDiv({
			cls: "money-summary-value",
			text: this.formatCurrency(summary.balance),
		});
	}

	private renderAccountCard(parent: HTMLElement, account: Account, summary: MonthSummary): void {
		const card = parent.createDiv({ cls: "money-account-card" });
		card.addEventListener("click", () => {
			this.plugin.openMainView("account", account.id);
		});

		const headerEl = card.createDiv({ cls: "money-account-card-header" });
		const iconEl = headerEl.createDiv({ cls: "money-navitem-icon" });
		setIcon(iconEl, account.kind === "bank" ? "landmark" : "credit-card");
		headerEl.createSpan({ text: account.name, cls: "money-account-card-name" });

		const balanceEl = card.createDiv({
			cls: `money-account-card-balance ${summary.balance >= 0 ? "money-positive" : "money-negative"}`,
			text: this.formatCurrency(summary.balance),
		});
	}

	private renderLedgerTable(parent: HTMLElement, rows: LedgerRow[], showAccount: boolean): void {
		const store = this.plugin.store;
		if (!store) return;

		const accounts = store.getAllAccounts();
		const accountMap = new Map(accounts.map((a) => [a.id, a]));
		const categories = store.getAllCategories();
		const catMap = new Map(categories.map((c) => [c.id, c]));

		const table = parent.createDiv({ cls: "money-table" });

		// Header
		const thead = table.createDiv({ cls: "money-table-header" });
		thead.createDiv({ cls: "money-table-cell money-cell-date", text: "Date" });
		thead.createDiv({ cls: "money-table-cell money-cell-desc", text: "Description" });
		if (showAccount) {
			thead.createDiv({ cls: "money-table-cell money-cell-account", text: "Account" });
		}
		thead.createDiv({ cls: "money-table-cell money-cell-category", text: "Category" });
		thead.createDiv({ cls: "money-table-cell money-cell-type", text: "Type" });
		thead.createDiv({ cls: "money-table-cell money-cell-amount", text: "Amount" });
		thead.createDiv({ cls: "money-table-cell money-cell-actions", text: "" });

		// Rows
		for (const row of rows) {
			const tr = table.createDiv({ cls: `money-table-row money-row-${row.type}` });

			tr.createDiv({ cls: "money-table-cell money-cell-date", text: this.formatDate(row.date) });
			const descCell = tr.createDiv({ cls: "money-table-cell money-cell-desc" });
			descCell.createSpan({ text: row.description });
			if (row.schedule !== "single") {
				descCell.createSpan({
					cls: "money-badge",
					text: row.schedule,
				});
			}

			if (showAccount) {
				const accName = accountMap.get(row.accountId)?.name ?? "Unknown";
				tr.createDiv({ cls: "money-table-cell money-cell-account", text: accName });
			}

			const cat = row.categoryId ? catMap.get(row.categoryId) : undefined;
			const catCell = tr.createDiv({ cls: "money-table-cell money-cell-category" });
			if (cat) {
				const catIcon = catCell.createDiv({ cls: "money-cat-icon" });
				setIcon(catIcon, cat.icon);
				catCell.createSpan({ text: cat.name });
			}

			const typeLabel = row.type === "transfer"
				? `→ ${accountMap.get(row.toAccountId ?? "")?.name ?? "?"}`
				: row.type;
			tr.createDiv({ cls: "money-table-cell money-cell-type", text: typeLabel });

			const amountText = row.type === "income"
				? `+${this.formatCurrency(row.amount)}`
				: `-${this.formatCurrency(row.amount)}`;
			tr.createDiv({
				cls: `money-table-cell money-cell-amount ${row.type === "income" ? "money-positive" : "money-negative"}`,
				text: amountText,
			});

			// Delete button
			const actionsCell = tr.createDiv({ cls: "money-table-cell money-cell-actions" });
			const deleteBtn = actionsCell.createEl("button", {
				cls: "money-icon-button money-icon-button-small",
				attr: { "aria-label": "Delete entry" },
			});
			setIcon(deleteBtn, "trash-2");
			deleteBtn.addEventListener("click", () => {
				store.deleteEntry(row.entryId);
				this.plugin.persistData();
				this.render();
				this.plugin.refreshSidebar();
			});
		}
	}

	/* ── Formatting ───────────────────── */

	private formatCurrency(cents: number): string {
		const abs = Math.abs(cents);
		const sign = cents < 0 ? "-" : "";
		return `${sign}$${(abs / 100).toFixed(2)}`;
	}

	private formatDate(dateStr: string): string {
		const d = new Date(dateStr + "T00:00:00Z");
		return d.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			timeZone: "UTC",
		});
	}
}
