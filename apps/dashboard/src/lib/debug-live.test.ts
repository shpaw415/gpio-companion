import { describe, expect, test } from "bun:test";
import { DEBUG_LIVE_TTL_SEC } from "gpio-companion";
import {
	getLiveBoard,
	listLiveBoards,
	mergeDebugBoards,
	putLiveBoard,
} from "./debug-live.ts";
import type { PublicPairing } from "./pairing-store.ts";

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
		list: async ({ prefix }: { prefix: string; cursor?: string }) => {
			const keys = [...data.keys()]
				.filter((name) => name.startsWith(prefix))
				.sort()
				.map((name) => ({ name }));
			return { keys, list_complete: true as const };
		},
	};
}

function pairing(uuid: string): PublicPairing {
	return {
		userId: "owner",
		uuid,
		deviceUrl: `https://api-${uuid.replaceAll("-", "")}.gpio-companion.com`,
		login: "ada",
		email: "ada@gpio-companion.com",
		claimedAt: "2026-09-02T00:00:00.000Z",
		label: "bench",
	};
}

describe("debug live presence", () => {
	test("stores a live ping derived from the pairing uuid", async () => {
		const kv = memoryKv();
		const board = await putLiveBoard(kv, { uuid: "abc-def" }, 1_000);
		expect(board.deviceUrl).toBe("https://api-abcdef.gpio-companion.com");
		expect(await getLiveBoard(kv, "abc-def", 1_000)).toEqual(board);
		expect(
			await getLiveBoard(
				kv,
				"abc-def",
				1_000 + (DEBUG_LIVE_TTL_SEC + 1) * 1000,
			),
		).toBeNull();
	});

	test("merges unpaired live boards only for admin", async () => {
		const paired = [pairing("owned")];
		const live = [
			{
				uuid: "owned",
				deviceUrl: "https://api-owned.gpio-companion.com",
				seenAt: 2,
			},
			{
				uuid: "fresh",
				deviceUrl: "https://api-fresh.gpio-companion.com",
				seenAt: 3,
			},
		];
		const ownerView = mergeDebugBoards(paired, live, false);
		expect(ownerView).toHaveLength(1);
		expect(ownerView[0]?.live).toBe(true);
		expect(ownerView[0]?.paired).toBe(true);
		const adminView = mergeDebugBoards(paired, live, true);
		expect(adminView.map((board) => board.uuid)).toEqual(["owned", "fresh"]);
		expect(adminView[1]).toMatchObject({
			uuid: "fresh",
			paired: false,
			live: true,
		});
	});

	test("lists live boards from kv", async () => {
		const kv = memoryKv();
		await putLiveBoard(kv, { uuid: "one" }, 5);
		expect((await listLiveBoards(kv, 5)).map((board) => board.uuid)).toEqual([
			"one",
		]);
	});
});
