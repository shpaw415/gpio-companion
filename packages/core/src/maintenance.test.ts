import { describe, expect, test } from "bun:test";
import {
	capLogText,
	filterJournalByAge,
	formatDiskFree,
	journalWindowMs,
	parseDiskStats,
	parseJournalTimestamp,
	parseMaintenanceReport,
	redactLogText,
} from "./maintenance.ts";

describe("maintenance helpers", () => {
	test("parses disk stats", () => {
		expect(parseDiskStats({ totalMb: 7456.2, availMb: 1800.8 })).toEqual({
			totalMb: 7456,
			availMb: 1801,
		});
		expect(parseDiskStats({ totalMb: 0, availMb: 10 })).toBeNull();
		expect(parseDiskStats(null)).toBeNull();
	});

	test("parses and caps a maintenance report", () => {
		expect(() => parseMaintenanceReport({ uuid: "  abc  " })).toThrow(
			"at is required",
		);
		expect(
			parseMaintenanceReport({
				uuid: " abc-def ",
				at: 1_700_000_000_000,
				diskTotalMb: 7456,
				diskAvailMb: 1800,
				reclaimedBytes: 4096,
				actions: ["journal-vacuum", "  apt-clean  ", 1, ""],
			}),
		).toEqual({
			uuid: "abc-def",
			at: 1_700_000_000_000,
			diskTotalMb: 7456,
			diskAvailMb: 1800,
			reclaimedBytes: 4096,
			actions: ["journal-vacuum", "apt-clean"],
		});
	});

	test("redacts and caps log text", () => {
		expect(redactLogText("token ghs_abcDEF123")).toBe("token [redacted]");
		const lines = Array.from({ length: 12 }, (_, i) => `line-${i}`);
		expect(capLogText(lines.join("\n"), 10_000, 5)).toBe(
			"line-7\nline-8\nline-9\nline-10\nline-11",
		);
		expect(
			new TextEncoder().encode(capLogText("x".repeat(200), 16)).byteLength,
		).toBe(16);
	});

	test("formats disk free", () => {
		expect(formatDiskFree({ totalMb: 1000, availMb: 250 })).toBe(
			"250 MB free (25%)",
		);
	});

	test("parses journalctl short-iso timestamps", () => {
		expect(
			parseJournalTimestamp("2026-09-04T12:00:00+0000 host gpio[1]: ok"),
		).toBe(Date.parse("2026-09-04T12:00:00+00:00"));
		expect(parseJournalTimestamp("not a log line")).toBeNull();
	});

	test("filters journal lines by age window", () => {
		const now = Date.parse("2026-09-04T12:00:00+00:00");
		const text = [
			"2026-09-04T01:00:00+0000 host gpio[1]: old",
			"  continuation of old",
			"2026-09-04T11:50:00+0000 host gpio[1]: recent",
			"  continuation of recent",
		].join("\n");
		expect(filterJournalByAge(text, journalWindowMs("1h"), now)).toBe(
			"2026-09-04T11:50:00+0000 host gpio[1]: recent\n  continuation of recent",
		);
		expect(filterJournalByAge(text, journalWindowMs("24h"), now)).toContain(
			"old",
		);
	});
});
