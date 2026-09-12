import { describe, expect, test } from "bun:test";
import {
	capRunLog,
	isRunPath,
	parseRunPut,
	RUN_LOG_MAX,
	RunError,
} from "./run.ts";

describe("parseRunPut", () => {
	test("requires absolute dir", () => {
		expect(parseRunPut({ dir: "/home/gpio/blink" })).toEqual({
			dir: "/home/gpio/blink",
		});
	});

	test("rejects relative dir and traversal", () => {
		expect(() => parseRunPut({ dir: "blink" })).toThrow(RunError);
		expect(() => parseRunPut({ dir: "/tmp/../etc" })).toThrow("absolute");
	});

	test("rejects empty dir", () => {
		expect(() => parseRunPut({})).toThrow("dir");
	});
});

describe("run helpers", () => {
	test("path match", () => {
		expect(isRunPath("/v1/run")).toBe(true);
		expect(isRunPath("/v1/run/stop")).toBe(true);
		expect(isRunPath("/v1/run/sketches")).toBe(true);
		expect(isRunPath("/v1/flash")).toBe(false);
	});

	test("caps log", () => {
		expect(capRunLog("ok")).toBe("ok");
		const log = "x".repeat(RUN_LOG_MAX + 10);
		expect(capRunLog(log).length).toBe(RUN_LOG_MAX);
	});
});
