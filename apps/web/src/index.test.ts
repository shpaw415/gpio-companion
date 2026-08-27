import { describe, expect, test } from "bun:test";
import { greet } from "gpio-companion";

describe("gpio-companion-web", () => {
	test("uses the shared package", () => {
		expect(greet("web")).toBe("hello from web");
	});
});
