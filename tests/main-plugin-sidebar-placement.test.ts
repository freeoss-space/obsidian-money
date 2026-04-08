import { describe, it, expect, vi } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import MoneyPlugin from "../src/main";
import { MONEY_SIDEBAR_VIEW_TYPE } from "../src/views/sidebar-view";

vi.mock("../node_modules/sql.js/dist/sql-wasm.wasm", () => ({
	default: new Uint8Array(),
}));

describe("MoneyPlugin.activateSidebar", () => {
	it("opens the money sidebar in the left sidebar leaf", async () => {
		const plugin = new MoneyPlugin();
		const leftLeaf = new WorkspaceLeaf();

		const getLeftLeaf = vi.fn().mockReturnValue(leftLeaf);
		(plugin.app.workspace as unknown as { getLeftLeaf: (split: boolean) => WorkspaceLeaf }).getLeftLeaf = getLeftLeaf;
		const getRightLeafSpy = vi.spyOn(plugin.app.workspace, "getRightLeaf");
		vi.spyOn(plugin.app.workspace, "getLeavesOfType").mockReturnValue([]);
		const revealLeafSpy = vi.spyOn(plugin.app.workspace, "revealLeaf");
		leftLeaf.setViewState = vi.fn().mockResolvedValue(undefined);

		await plugin.activateSidebar();

		expect(getLeftLeaf).toHaveBeenCalledWith(false);
		expect(getRightLeafSpy).not.toHaveBeenCalled();
		expect(leftLeaf.setViewState).toHaveBeenCalledWith({
			type: MONEY_SIDEBAR_VIEW_TYPE,
			active: true,
		});
		expect(revealLeafSpy).toHaveBeenCalledWith(leftLeaf);
	});
});
