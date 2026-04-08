import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type MoneyPlugin from "../main";
import type { Account } from "../types";

export const MONEY_SIDEBAR_VIEW_TYPE = "money-sidebar-view";

export class MoneySidebarView extends ItemView {
	private plugin: MoneyPlugin;
	private contentEl_inner: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: MoneyPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return MONEY_SIDEBAR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Money";
	}

	getIcon(): string {
		return "banknote";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("money-sidebar");

		this.renderToolbar(container);
		this.contentEl_inner = container.createDiv({ cls: "money-sidebar-content" });
		this.renderContent();
	}

	async onClose(): Promise<void> {
		this.containerEl.empty();
	}

	public refresh(): void {
		if (this.contentEl_inner) {
			this.contentEl_inner.empty();
			this.renderContent();
		}
	}

	/* ── Toolbar ──────────────────────── */

	private renderToolbar(parent: HTMLElement): void {
		const toolbar = parent.createDiv({ cls: "money-sidebar-toolbar" });

		const leftGroup = toolbar.createDiv({ cls: "money-toolbar-group" });
		leftGroup.createEl("span", { cls: "money-toolbar-title", text: "Money" });

		const rightGroup = toolbar.createDiv({ cls: "money-toolbar-group" });

		// Add account button
		const addAccountBtn = rightGroup.createEl("button", {
			cls: "money-icon-button",
			attr: { "aria-label": "Add account" },
		});
		setIcon(addAccountBtn, "plus");
		addAccountBtn.addEventListener("click", () => {
			this.plugin.openAddAccountModal();
		});
	}

	/* ── Content ──────────────────────── */

	private renderContent(): void {
		const contentEl = this.contentEl_inner;
		if (!contentEl) return;

		const store = this.plugin.store;
		if (!store) return;

		// Overview nav item
		this.renderNavItem(contentEl, "Overview", "layout-dashboard", () => {
			this.plugin.openMainView("overview");
		});

		// Charts nav item
		this.renderNavItem(contentEl, "Charts", "bar-chart-3", () => {
			this.plugin.openMainView("charts");
		});

		// Checklist nav item
		this.renderNavItem(contentEl, "Checklist", "list-checks", () => {
			this.plugin.openMainView("checklist");
		});

		// Separator
		contentEl.createDiv({ cls: "money-sidebar-separator" });

		// Bank Accounts section
		const bankAccounts = store.getBankAccounts();
		this.renderSection(contentEl, "Bank Accounts", "landmark", bankAccounts, "bank");

		// Separator
		contentEl.createDiv({ cls: "money-sidebar-separator" });

		// Credit Cards section
		const creditCards = store.getCreditCards();
		this.renderSection(contentEl, "Credit Cards", "credit-card", creditCards, "credit_card");
	}

	/* ── Render helpers ───────────────── */

	private renderSection(
		parent: HTMLElement,
		title: string,
		sectionIcon: string,
		accounts: Account[],
		_kind: string,
	): void {
		const sectionEl = parent.createDiv({ cls: "money-sidebar-section" });

		const headerEl = sectionEl.createDiv({ cls: "money-section-header" });
		const headerContent = headerEl.createDiv({ cls: "money-navitem-content" });

		const chevron = headerContent.createDiv({ cls: "money-navitem-chevron" });
		setIcon(chevron, "chevron-down");

		const iconEl = headerContent.createDiv({ cls: "money-navitem-icon" });
		setIcon(iconEl, sectionIcon);

		headerContent.createDiv({ cls: "money-navitem-name", text: title });
		headerContent.createDiv({
			cls: "money-navitem-count",
			text: String(accounts.length),
		});

		const childrenEl = sectionEl.createDiv({ cls: "money-section-children" });

		let expanded = true;
		headerContent.addEventListener("click", () => {
			expanded = !expanded;
			childrenEl.toggleClass("money-collapsed", !expanded);
			chevron.toggleClass("is-collapsed", !expanded);
		});

		for (const account of accounts) {
			this.renderAccountItem(childrenEl, account);
		}
	}

	private renderAccountItem(parent: HTMLElement, account: Account): void {
		const itemEl = parent.createDiv({ cls: "money-navitem" });
		itemEl.setAttribute("style", "--level: 1");

		const contentRow = itemEl.createDiv({ cls: "money-navitem-content" });

		const iconEl = contentRow.createDiv({ cls: "money-navitem-icon" });
		setIcon(iconEl, account.kind === "bank" ? "landmark" : "credit-card");

		contentRow.createDiv({ cls: "money-navitem-name", text: account.name });

		contentRow.addEventListener("click", () => {
			this.plugin.openMainView("account", account.id);
		});

		// Context menu for delete
		contentRow.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			const menu = contentRow.createDiv({ cls: "money-context-menu" });
			const deleteBtn = menu.createEl("button", {
				cls: "money-context-item money-context-danger",
				text: "Delete",
			});
			deleteBtn.addEventListener("click", () => {
				this.plugin.store?.deleteAccount(account.id);
				this.plugin.persistData();
				this.refresh();
				menu.remove();
			});
			// Close menu on outside click
			const closeHandler = (ev: MouseEvent) => {
				if (!menu.contains(ev.target as Node)) {
					menu.remove();
					document.removeEventListener("click", closeHandler);
				}
			};
			setTimeout(() => document.addEventListener("click", closeHandler), 0);
		});
	}

	private renderNavItem(
		parent: HTMLElement,
		label: string,
		icon: string,
		onClick: () => void,
	): void {
		const navItem = parent.createDiv({ cls: "money-navitem" });
		navItem.setAttribute("style", "--level: 0");

		const contentRow = navItem.createDiv({ cls: "money-navitem-content" });

		const iconEl = contentRow.createDiv({ cls: "money-navitem-icon" });
		setIcon(iconEl, icon);

		contentRow.createDiv({ cls: "money-navitem-name", text: label });

		contentRow.addEventListener("click", onClick);
	}
}
