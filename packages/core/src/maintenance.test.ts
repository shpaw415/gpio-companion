import { describe, expect, test } from "bun:test";
import {
	capLogText,
	formatDiskFree,
	parseDiskStats,
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
			"disk stats are required",
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
		expect(Buffer.byteLength(capLogText("x".repeat(200), 16), "utf8")).toBe(16);
	});

	test("formats disk free", () => {
		expect(formatDiskFree({ totalMb: 1000, availMb: 250 })).toBe(
			"250 MB free (25%)",
		);
	});
});
