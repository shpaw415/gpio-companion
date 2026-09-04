import { describe, expect, test } from "bun:test";
import { DEBUG_MAINTENANCE_TTL_SEC } from "gpio-companion";
import {
	attachMaintenance,
	getMaintenance,
	putMaintenance,
} from "./debug-maintenance.ts";

function memoryKv() {
	const data = new Map<string, string>();
	return {
		get: async (key: string) => data.get(key) ?? null,
		put: async (key: string, value: string) => {
			data.set(key, value);
		},
		delete: async (key: string) => {
			data.delete(key);
		},
	};
}

describe("debug maintenance kv", () => {
	test("stores a snapshot from the Pi", async () => {
		const kv = memoryKv();
		const report = await putMaintenance(kv, {
			uuid: " abc-def ",
			at: 1_700_000_000_000,
			diskTotalMb: 7456,
			diskAvailMb: 1800,
			reclaimedBytes: 4096,
			actions: ["journal-vacuum"],
		});
		expect(report.uuid).toBe("abc-def");
		expect(await getMaintenance(kv, "abc-def")).toEqual(report);
		expect(DEBUG_MAINTENANCE_TTL_SEC).toBe(24 * 60 * 60);
	});

	test("attaches snapshots onto debug boards", async () => {
		const kv = memoryKv();
		await putMaintenance(kv, {
			uuid: "owned",
			at: 2,
			diskTotalMb: 1000,
			diskAvailMb: 200,
			reclaimedBytes: 1,
			actions: [],
		});
		const boards = await attachMaintenance(kv, [
			{ uuid: "owned" },
			{ uuid: "missing" },
		]);
		expect(boards[0]?.maintenance?.diskAvailMb).toBe(200);
		expect(boards[1]?.maintenance).toBeNull();
	});
});
