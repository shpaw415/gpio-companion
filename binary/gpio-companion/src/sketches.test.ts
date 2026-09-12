import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listBoardSketches } from "./sketches.ts";

describe("listBoardSketches", () => {
	test("lists host and firmware dirs and skips visual folders", async () => {
		const root = await mkdtemp(join(tmpdir(), "sketches-"));
		writeSketch(join(root, "blink-led", "host", "blink"), "blink.c");
		writeSketch(join(root, "blink-led", "firmware", "uno"), "uno.ino");
		writeSketch(join(root, "blink-led", "pcb"), "oops.c");
		writeSketch(join(root, "legacy"), "root.c");
		mkdirSync(join(root, "empty", "host"), { recursive: true });

		const host = listBoardSketches(root, "host");
		expect(host.map((item) => `${item.project}/${item.name}`).sort()).toEqual([
			"blink-led/blink",
			"legacy/legacy",
		]);
		expect(host.find((item) => item.name === "blink")?.files).toEqual([
			"blink.c",
		]);

		const firmware = listBoardSketches(root, "firmware");
		expect(firmware).toEqual([
			{
				project: "blink-led",
				name: "uno",
				dir: join(root, "blink-led", "firmware", "uno"),
				files: ["uno.ino"],
			},
		]);
	});

	test("lists host/ itself when it contains a sketch", async () => {
		const root = await mkdtemp(join(tmpdir(), "sketches-host-"));
		writeSketch(join(root, "pwm", "host"), "pwm.c");
		expect(listBoardSketches(root, "host")).toEqual([
			{
				project: "pwm",
				name: "host",
				dir: join(root, "pwm", "host"),
				files: ["pwm.c"],
			},
		]);
	});

	test("refuses relative roots", () => {
		expect(listBoardSketches("projects", "host")).toEqual([]);
		expect(listBoardSketches("/tmp/../etc", "host")).toEqual([]);
	});
});

function writeSketch(dir: string, file: string): void {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, file), "void setup() {}\nvoid loop() {}\n");
}
