import { describe, expect, test } from "bun:test";
import {
	consumeMicrodollars,
	creditsBalance,
	grantUsd,
	parseCreditsRecord,
} from "./credits.ts";

class MemoryKv {
	store = new Map<string, string>();
	async get(key: string) {
		return this.store.get(key) ?? null;
	}
	async put(key: string, value: string) {
		this.store.set(key, value);
	}
}

describe("credits", () => {
	test("migrates legacy request credits to $0.01 each", () => {
		expect(parseCreditsRecord("100")).toEqual({
			micros: 1_000_000,
			dirty: true,
		});
	});

	test("reads v2 micros", () => {
		expect(parseCreditsRecord(JSON.stringify({ v: 2, micros: 23000 }))).toEqual(
			{
				micros: 23_000,
				dirty: false,
			},
		);
	});

	test("grants and consumes microdollars", async () => {
		const kv = new MemoryKv() as unknown as KVNamespace;
		expect(await grantUsd(kv, "user-1", 1)).toBe(1_000_000);
		expect(await creditsBalance(kv, "user-1")).toBe(1_000_000);
		expect(await consumeMicrodollars(kv, "user-1", 23_000)).toBe(977_000);
		expect(await consumeMicrodollars(kv, "user-1", 2_000_000)).toBe(0);
		expect(await consumeMicrodollars(kv, "user-1", 1)).toBeNull();
	});
});
