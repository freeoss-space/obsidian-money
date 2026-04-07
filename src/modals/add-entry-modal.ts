import { Modal, Setting, App, Notice } from "obsidian";
import type MoneyPlugin from "../main";
import type { EntryType, EntrySchedule, Category, Account, EntityId } from "../types";

export class AddEntryModal extends Modal {
	private plugin: MoneyPlugin;
	private presetAccountId: string;

	// Form state
	private accountId = "";
	private toAccountId = "";
	private entryType: EntryType = "expense";
	private amount = "";
	private description = "";
	private categoryId = "";
	private schedule: EntrySchedule = "single";
	private date = "";
	private fixedInterval: "monthly" | "weekly" | "yearly" = "monthly";
	private fixedEndDate = "";
	private splitMonths = "3";

	constructor(app: App, plugin: MoneyPlugin, presetAccountId?: string) {
		super(app);
		this.plugin = plugin;
		this.presetAccountId = presetAccountId ?? "";

		// Default date to today
		const today = new Date();
		this.date = today.toISOString().split("T")[0];
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("money-modal");

		contentEl.createEl("h2", { text: "Add Entry" });

		const store = this.plugin.store;
		if (!store) return;

		const accounts = store.getAllAccounts();
		const categories = store.getAllCategories();

		if (accounts.length === 0) {
			contentEl.createEl("p", {
				text: "Please create an account first.",
				cls: "money-modal-notice",
			});
			return;
		}

		// Set default account
		this.accountId = this.presetAccountId || accounts[0].id;

		// Entry type
		new Setting(contentEl).setName("Type").addDropdown((dropdown) => {
			dropdown
				.addOption("expense", "Expense")
				.addOption("income", "Income")
				.addOption("transfer", "Transfer")
				.setValue(this.entryType)
				.onChange((value) => {
					this.entryType = value as EntryType;
					this.updateFieldVisibility();
				});
		});

		// Account (from)
		new Setting(contentEl).setName("Account").addDropdown((dropdown) => {
			for (const acc of accounts) {
				dropdown.addOption(acc.id, acc.name);
			}
			dropdown.setValue(this.accountId).onChange((value) => {
				this.accountId = value;
			});
		});

		// To account (for transfers)
		this.toAccountSetting = new Setting(contentEl)
			.setName("To account")
			.addDropdown((dropdown) => {
				for (const acc of accounts) {
					dropdown.addOption(acc.id, acc.name);
				}
				if (accounts.length > 1) {
					const other = accounts.find((a) => a.id !== this.accountId);
					this.toAccountId = other?.id ?? accounts[0].id;
					dropdown.setValue(this.toAccountId);
				}
				dropdown.onChange((value) => {
					this.toAccountId = value;
				});
			});

		// Amount
		new Setting(contentEl).setName("Amount").addText((text) => {
			text.setPlaceholder("0.00").onChange((value) => {
				this.amount = value;
			});
		});

		// Description
		new Setting(contentEl).setName("Description").addText((text) => {
			text.setPlaceholder("What is this entry for?").onChange((value) => {
				this.description = value;
			});
		});

		// Category
		this.categorySetting = new Setting(contentEl)
			.setName("Category")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "-- None --");
				for (const cat of categories) {
					dropdown.addOption(cat.id, cat.name);
				}
				dropdown.onChange((value) => {
					this.categoryId = value;
				});
			});

		// Date
		new Setting(contentEl).setName("Date").addText((text) => {
			text.setValue(this.date).onChange((value) => {
				this.date = value;
			});
			text.inputEl.type = "date";
		});

		// Schedule
		new Setting(contentEl).setName("Schedule").addDropdown((dropdown) => {
			dropdown
				.addOption("single", "Single (one-time)")
				.addOption("fixed", "Fixed (recurring)")
				.addOption("split", "Split (installments)")
				.setValue(this.schedule)
				.onChange((value) => {
					this.schedule = value as EntrySchedule;
					this.updateFieldVisibility();
				});
		});

		// Fixed interval
		this.fixedIntervalSetting = new Setting(contentEl)
			.setName("Repeat every")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("monthly", "Month")
					.addOption("weekly", "Week")
					.addOption("yearly", "Year")
					.setValue(this.fixedInterval)
					.onChange((value) => {
						this.fixedInterval = value as "monthly" | "weekly" | "yearly";
					});
			});

		// Fixed end date
		this.fixedEndDateSetting = new Setting(contentEl)
			.setName("End date (optional)")
			.addText((text) => {
				text.setPlaceholder("YYYY-MM-DD").onChange((value) => {
					this.fixedEndDate = value;
				});
				text.inputEl.type = "date";
			});

		// Split months
		this.splitMonthsSetting = new Setting(contentEl)
			.setName("Number of installments")
			.addText((text) => {
				text.setValue(this.splitMonths).onChange((value) => {
					this.splitMonths = value;
				});
				text.inputEl.type = "number";
				text.inputEl.min = "2";
				text.inputEl.max = "60";
			});

		this.updateFieldVisibility();

		// Action buttons
		const btnContainer = contentEl.createDiv({ cls: "money-modal-buttons" });

		const cancelBtn = btnContainer.createEl("button", {
			cls: "money-btn",
			text: "Cancel",
		});
		cancelBtn.addEventListener("click", () => this.close());

		const saveBtn = btnContainer.createEl("button", {
			cls: "money-btn money-btn-primary",
			text: "Save",
		});
		saveBtn.addEventListener("click", () => this.save());
	}

	private toAccountSetting: Setting | null = null;
	private categorySetting: Setting | null = null;
	private fixedIntervalSetting: Setting | null = null;
	private fixedEndDateSetting: Setting | null = null;
	private splitMonthsSetting: Setting | null = null;

	private updateFieldVisibility(): void {
		// Transfer fields
		if (this.toAccountSetting) {
			this.toAccountSetting.settingEl.style.display =
				this.entryType === "transfer" ? "" : "none";
		}

		// Category (hide for transfers)
		if (this.categorySetting) {
			this.categorySetting.settingEl.style.display =
				this.entryType !== "transfer" ? "" : "none";
		}

		// Fixed fields
		const showFixed = this.schedule === "fixed";
		if (this.fixedIntervalSetting) {
			this.fixedIntervalSetting.settingEl.style.display = showFixed ? "" : "none";
		}
		if (this.fixedEndDateSetting) {
			this.fixedEndDateSetting.settingEl.style.display = showFixed ? "" : "none";
		}

		// Split fields
		if (this.splitMonthsSetting) {
			this.splitMonthsSetting.settingEl.style.display =
				this.schedule === "split" ? "" : "none";
		}
	}

	private save(): void {
		const store = this.plugin.store;
		if (!store) return;

		// Validate
		const amountNum = parseFloat(this.amount);
		if (isNaN(amountNum) || amountNum <= 0) {
			new Notice("Please enter a valid amount.");
			return;
		}

		if (!this.accountId) {
			new Notice("Please select an account.");
			return;
		}

		if (!this.date) {
			new Notice("Please select a date.");
			return;
		}

		if (this.entryType === "transfer" && !this.toAccountId) {
			new Notice("Please select a destination account.");
			return;
		}

		if (this.entryType === "transfer" && this.accountId === this.toAccountId) {
			new Notice("Source and destination accounts must be different.");
			return;
		}

		if (this.schedule === "split") {
			const months = parseInt(this.splitMonths, 10);
			if (isNaN(months) || months < 2) {
				new Notice("Split must be at least 2 months.");
				return;
			}
		}

		const amountCents = Math.round(amountNum * 100);

		store.createEntry({
			accountId: this.accountId,
			toAccountId: this.entryType === "transfer" ? this.toAccountId : undefined,
			type: this.entryType,
			amount: amountCents,
			description: this.description,
			categoryId: this.categoryId || undefined,
			schedule: this.schedule,
			date: this.date,
			fixedInterval: this.schedule === "fixed" ? this.fixedInterval : undefined,
			fixedEndDate:
				this.schedule === "fixed" && this.fixedEndDate ? this.fixedEndDate : undefined,
			splitMonths:
				this.schedule === "split" ? parseInt(this.splitMonths, 10) : undefined,
		});

		this.plugin.persistData();
		this.plugin.refreshSidebar();
		this.plugin.refreshMainView();
		this.close();
		new Notice("Entry added.");
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
