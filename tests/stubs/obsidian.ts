// Obsidian API stubs for testing
export class Plugin {
	app: App = new App();
	manifest: PluginManifest = { dir: "/test-vault/.obsidian/plugins/obsidian-money" } as PluginManifest;
	async loadData(): Promise<unknown> {
		return null;
	}
	async saveData(_data: unknown): Promise<void> {}
	registerView(_type: string, _viewCreator: (leaf: WorkspaceLeaf) => ItemView): void {}
	addRibbonIcon(_icon: string, _title: string, _callback: () => void): HTMLElement {
		return document.createElement("div");
	}
	addCommand(_command: Command): Command {
		return _command;
	}
	addSettingTab(_settingTab: PluginSettingTab): void {}
	registerInterval(_id: number): number {
		return _id;
	}
}

export interface PluginManifest {
	dir: string;
}

export class App {
	workspace: Workspace = new Workspace();
	vault: Vault = new Vault();
}

export class Workspace {
	getLeavesOfType(_type: string): WorkspaceLeaf[] {
		return [];
	}
	getRightLeaf(_split: boolean): WorkspaceLeaf {
		return new WorkspaceLeaf();
	}
	getLeftLeaf(_split: boolean): WorkspaceLeaf {
		return new WorkspaceLeaf();
	}
	revealLeaf(_leaf: WorkspaceLeaf): void {}
	detachLeavesOfType(_type: string): void {}
	getLeaf(_newLeaf?: boolean | string): WorkspaceLeaf {
		return new WorkspaceLeaf();
	}
}

export class Vault {
	adapter: DataAdapter = new DataAdapter();
}

export class DataAdapter {
	async readBinary(_path: string): Promise<ArrayBuffer> {
		return new ArrayBuffer(0);
	}
	async writeBinary(_path: string, _data: ArrayBuffer): Promise<void> {}
	async exists(_path: string): Promise<boolean> {
		return false;
	}
	async mkdir(_path: string): Promise<void> {}
	getBasePath(): string {
		return "/test-vault";
	}
}

export class WorkspaceLeaf {
	view: ItemView = null as unknown as ItemView;
	async setViewState(_state: { type: string; active: boolean }): Promise<void> {}
}

/**
 * Augment HTMLElement with Obsidian's convenience helpers so that views
 * written against the Obsidian API work in a test environment.
 */
function augmentElement(el: HTMLElement): HTMLElement {
	const anyEl = el as Record<string, unknown>;

	if (typeof anyEl.empty !== "function") {
		anyEl.empty = function (this: HTMLElement) {
			this.innerHTML = "";
		};
	}
	if (typeof anyEl.addClass !== "function") {
		anyEl.addClass = function (this: HTMLElement, ...classes: string[]) {
			this.classList.add(...classes);
		};
	}
	if (typeof anyEl.toggleClass !== "function") {
		anyEl.toggleClass = function (this: HTMLElement, cls: string, force: boolean) {
			this.classList.toggle(cls, force);
		};
	}
	if (typeof anyEl.createDiv !== "function") {
		anyEl.createDiv = function (
			this: HTMLElement,
			opts?: { cls?: string; text?: string; attr?: Record<string, string> },
		): HTMLElement {
			const div = document.createElement("div");
			augmentElement(div);
			if (opts?.cls) div.className = opts.cls;
			if (opts?.text) div.textContent = opts.text;
			if (opts?.attr) {
				for (const [k, v] of Object.entries(opts.attr)) div.setAttribute(k, v);
			}
			this.appendChild(div);
			return div;
		};
	}
	if (typeof anyEl.createEl !== "function") {
		anyEl.createEl = function (
			this: HTMLElement,
			tag: string,
			opts?: { cls?: string; text?: string; attr?: Record<string, string> },
		): HTMLElement {
			const child = document.createElement(tag);
			augmentElement(child);
			if (opts?.cls) child.className = opts.cls;
			if (opts?.text) child.textContent = opts.text;
			if (opts?.attr) {
				for (const [k, v] of Object.entries(opts.attr)) child.setAttribute(k, v);
			}
			this.appendChild(child);
			return child;
		};
	}
	if (typeof anyEl.createSpan !== "function") {
		anyEl.createSpan = function (
			this: HTMLElement,
			opts?: { cls?: string; text?: string },
		): HTMLElement {
			const span = document.createElement("span");
			augmentElement(span);
			if (opts?.cls) span.className = opts.cls;
			if (opts?.text) span.textContent = opts.text;
			this.appendChild(span);
			return span;
		};
	}

	return el;
}

export class ItemView {
	containerEl: HTMLElement;
	leaf: WorkspaceLeaf;
	constructor(leaf: WorkspaceLeaf) {
		this.leaf = leaf;
		this.containerEl = augmentElement(document.createElement("div"));
		// Obsidian layout: children[0] = header bar, children[1] = content area
		const header = augmentElement(document.createElement("div"));
		const content = augmentElement(document.createElement("div"));
		this.containerEl.appendChild(header);
		this.containerEl.appendChild(content);
	}
	getViewType(): string {
		return "";
	}
	getDisplayText(): string {
		return "";
	}
	getIcon(): string {
		return "";
	}
	async onOpen(): Promise<void> {}
	async onClose(): Promise<void> {}
}

export class Modal {
	app: App;
	contentEl: HTMLElement = document.createElement("div");
	modalEl: HTMLElement = document.createElement("div");
	constructor(app: App) {
		this.app = app;
	}
	open(): void {}
	close(): void {}
	onOpen(): void {}
	onClose(): void {}
}

export class Setting {
	settingEl: HTMLElement = document.createElement("div");
	constructor(_containerEl: HTMLElement) {}
	setName(_name: string): this {
		return this;
	}
	setDesc(_desc: string): this {
		return this;
	}
	addText(_cb: (text: TextComponent) => void): this {
		return this;
	}
	addDropdown(_cb: (dropdown: DropdownComponent) => void): this {
		return this;
	}
	addButton(_cb: (button: ButtonComponent) => void): this {
		return this;
	}
	addToggle(_cb: (toggle: ToggleComponent) => void): this {
		return this;
	}
}

export class TextComponent {
	inputEl: HTMLInputElement = document.createElement("input");
	setPlaceholder(_ph: string): this {
		return this;
	}
	setValue(_val: string): this {
		return this;
	}
	onChange(_cb: (value: string) => void): this {
		return this;
	}
	getValue(): string {
		return "";
	}
}

export class DropdownComponent {
	addOption(_value: string, _display: string): this {
		return this;
	}
	setValue(_val: string): this {
		return this;
	}
	onChange(_cb: (value: string) => void): this {
		return this;
	}
	getValue(): string {
		return "";
	}
}

export class ButtonComponent {
	setButtonText(_text: string): this {
		return this;
	}
	setCta(): this {
		return this;
	}
	onClick(_cb: () => void): this {
		return this;
	}
	setWarning(): this {
		return this;
	}
}

export class ToggleComponent {
	setValue(_val: boolean): this {
		return this;
	}
	onChange(_cb: (value: boolean) => void): this {
		return this;
	}
}

export class PluginSettingTab {
	app: App;
	containerEl: HTMLElement = document.createElement("div");
	constructor(app: App, _plugin: Plugin) {
		this.app = app;
	}
	display(): void {}
}

export class Notice {
	constructor(_message: string, _timeout?: number) {}
}

export interface Command {
	id: string;
	name: string;
	callback?: () => void;
}

export function setIcon(el: HTMLElement, icon: string): void {
	el.dataset.icon = icon;
}
