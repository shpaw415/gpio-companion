import { describe, expect, test } from "bun:test";
import { greet, VERSION } from "gpio-companion";

describe("gpio-companion-bin", () => {
	test("uses the shared package", () => {
		expect(VERSION).toBe("0.0.0");
		expect(greet("binary")).toBe("hello from binary");
	});
});
