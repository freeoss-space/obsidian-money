import { Modal, Setting, App, Notice } from "obsidian";
import type MoneyPlugin from "../main";
import type { AccountKind } from "../types";

export class AddAccountModal extends Modal {
	private plugin: MoneyPlugin;
	private name = "";
	private kind: AccountKind = "bank";
	private currency = "USD";
	private statementDay = 15;

	constructor(app: App, plugin: MoneyPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("money-modal");

		contentEl.createEl("h2", { text: "Add Account" });

		new Setting(contentEl).setName("Account name").addText((text) => {
			text.setPlaceholder("e.g. My Checking Account").onChange((value) => {
				this.name = value;
			});
		});

		new Setting(contentEl).setName("Type").addDropdown((dropdown) => {
			dropdown
				.addOption("bank", "Bank Account")
				.addOption("credit_card", "Credit Card")
				.setValue(this.kind)
				.onChange((value) => {
					this.kind = value as AccountKind;
					this.updateStatementDayVisibility();
				});
		});

		new Setting(contentEl).setName("Currency").addDropdown((dropdown) => {
			dropdown
				.addOption("USD", "USD")
				.addOption("EUR", "EUR")
				.addOption("GBP", "GBP")
				.addOption("BRL", "BRL")
				.addOption("JPY", "JPY")
				.addOption("CAD", "CAD")
				.addOption("AUD", "AUD")
				.setValue(this.currency)
				.onChange((value) => {
					this.currency = value;
				});
		});

		this.statementDaySetting = new Setting(contentEl)
			.setName("Statement day")
			.setDesc("Day of month the credit card statement closes (1-28)")
			.addText((text) => {
				text.setValue(String(this.statementDay)).onChange((value) => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num >= 1 && num <= 28) {
						this.statementDay = num;
					}
				});
			});
		this.updateStatementDayVisibility();

		// Action buttons
		const btnContainer = contentEl.createDiv({ cls: "money-modal-buttons" });

		const cancelBtn = btnContainer.createEl("button", {
			cls: "money-btn",
			text: "Cancel",
		});
		cancelBtn.addEventListener("click", () => this.close());

		const saveBtn = btnContainer.createEl("button", {
			cls: "money-btn money-btn-primary",
			text: "Create",
		});
		saveBtn.addEventListener("click", () => this.save());
	}

	private statementDaySetting: Setting | null = null;

	private updateStatementDayVisibility(): void {
		if (this.statementDaySetting) {
			this.statementDaySetting.settingEl.style.display =
				this.kind === "credit_card" ? "" : "none";
		}
	}

	private save(): void {
		if (!this.name.trim()) {
			new Notice("Please enter an account name.");
			return;
		}

		const store = this.plugin.store;
		if (!store) return;

		store.createAccount(
			this.name.trim(),
			this.kind,
			this.currency,
			this.kind === "credit_card" ? this.statementDay : undefined,
		);

		this.plugin.persistData();
		this.plugin.refreshSidebar();
		this.plugin.refreshMainView();
		this.close();
		new Notice(`Account "${this.name}" created.`);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
