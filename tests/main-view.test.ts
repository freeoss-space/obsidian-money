// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { MoneyMainView } from "../src/views/main-view";

/** Minimal plugin stub */
function createPluginStub() {
	return {
		store: null,
		openMainView: () => {},
		openAddEntryModal: () => {},
	} as unknown as import("../src/main").default;
}

/* ───────────────────────────────────────
   MainViewMode includes checklist
   ─────────────────────────────────────── */

describe("MainViewMode", () => {
	it("renders checklist heading when mode is set to 'checklist'", async () => {
		const leaf = new WorkspaceLeaf();
		const plugin = createPluginStub();
		const view = new MoneyMainView(leaf, plugin);

		await view.onOpen();
		view.setMode("checklist");

		const container = view.containerEl.children[1] as HTMLElement;
		const heading = container.querySelector(".money-view-title");
		expect(heading).not.toBeNull();
		expect(heading!.textContent?.trim()).toBe("Checklist");
	});
});
