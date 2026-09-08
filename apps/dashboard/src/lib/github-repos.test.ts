import { describe, expect, test } from "bun:test";
import { parseRepoName } from "./github.ts";

describe("parseRepoName", () => {
	test("accepts github names", () => {
		expect(parseRepoName("blink-led")).toBe("blink-led");
		expect(parseRepoName(" Blink.git ")).toBe("Blink");
	});

	test("rejects junk", () => {
		expect(() => parseRepoName("has space")).toThrow();
		expect(() => parseRepoName("../etc")).toThrow();
		expect(() => parseRepoName("")).toThrow();
	});
});
