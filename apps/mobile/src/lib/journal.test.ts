import { describe, expect, test } from "bun:test";
import {
	filterJournalByAge,
	journalWindowMs,
	parseJournalTimestamp,
} from "./journal.ts";

describe("journal windows", () => {
	test("parses journalctl short-iso timestamps", () => {
		expect(
			parseJournalTimestamp("2026-09-04T12:00:00+0000 host gpio[1]: ok"),
		).toBe(Date.parse("2026-09-04T12:00:00+00:00"));
	});

	test("filters by 1h window", () => {
		const now = Date.parse("2026-09-04T12:00:00+00:00");
		const text = [
			"2026-09-04T01:00:00+0000 host gpio[1]: old",
			"2026-09-04T11:50:00+0000 host gpio[1]: recent",
		].join("\n");
		expect(filterJournalByAge(text, journalWindowMs("1h"), now)).toBe(
			"2026-09-04T11:50:00+0000 host gpio[1]: recent",
		);
	});
});
