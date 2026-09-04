import { describe, expect, test } from "bun:test";
import { parseDfPm } from "./disk.ts";

describe("disk stats", () => {
	test("parses df -Pm output", () => {
		expect(
			parseDfPm(
				"Filesystem     1024-blocks  Used Available Capacity Mounted on\n/dev/mmcblk0p1     7456  5400      1800      75% /\n",
			),
		).toEqual({ totalMb: 7456, availMb: 1800 });
		expect(parseDfPm("Filesystem\n")).toBeNull();
	});
});
