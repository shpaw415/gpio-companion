import { describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { parseBoardModel, readBoardModel } from "./board-model.ts";

describe("parseBoardModel", () => {
	test("strips trailing NUL bytes from device-tree output", () => {
		expect(parseBoardModel("Orange Pi 3 LTS\0")).toBe("Orange Pi 3 LTS");
	});

	test("collapses inner NULs and whitespace runs", () => {
		expect(parseBoardModel("Raspberry Pi 4 Model B\0 Rev 1.2")).toBe(
			"Raspberry Pi 4 Model B Rev 1.2",
		);
	});

	test("trims and returns empty for blank input", () => {
		expect(parseBoardModel("  \0 \0")).toBe("");
	});

	test("caps overly long model strings", () => {
		expect(parseBoardModel("x".repeat(200)).length).toBe(80);
	});
});

describe("readBoardModel", () => {
	test("returns undefined when the file is missing", () => {
		expect(readBoardModel("/nonexistent/device-tree-model")).toBeUndefined();
	});

	test("reads a model file with trailing NUL", async () => {
		const path = `${import.meta.dir}/.board-model.test.tmp`;
		await Bun.write(path, "Orange Pi 3 LTS\0");
		try {
			expect(readBoardModel(path)).toBe("Orange Pi 3 LTS");
		} finally {
			rmSync(path, { force: true });
		}
	});
});
