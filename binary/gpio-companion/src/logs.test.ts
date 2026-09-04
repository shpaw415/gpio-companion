import { describe, expect, test } from "bun:test";
import { journalctlArgs } from "./logs.ts";

describe("journal logs", () => {
	test("asks journalctl for gpio-companion units over 24h", () => {
		expect(journalctlArgs()).toContain("gpio-companion-cleanup");
		expect(journalctlArgs()).toContain("24 hours ago");
		expect(journalctlArgs()).toContain("200");
	});
});
