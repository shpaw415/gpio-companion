import { describe, expect, test } from "bun:test";
import { QueryCache } from "./query-cache";

describe("QueryCache", () => {
	test("stores a fetch and serves later gets from cache", async () => {
		let calls = 0;
		const cache = new QueryCache();
		const fetcher = async () => {
			calls += 1;
			return { n: calls };
		};
		expect(await cache.get("k", fetcher)).toEqual({ n: 1 });
		expect(await cache.get("k", fetcher)).toEqual({ n: 1 });
		expect(calls).toBe(1);
	});

	test("expires after ttl", async () => {
		let now = 0;
		let calls = 0;
		const cache = new QueryCache({ ttlMs: 100, now: () => now });
		const fetcher = async () => {
			calls += 1;
			return calls;
		};
		expect(await cache.get("k", fetcher)).toBe(1);
		now = 99;
		expect(await cache.get("k", fetcher)).toBe(1);
		now = 100;
		expect(await cache.get("k", fetcher)).toBe(2);
		expect(calls).toBe(2);
	});

	test("invalidate drops the entry", async () => {
		let calls = 0;
		const cache = new QueryCache();
		const fetcher = async () => {
			calls += 1;
			return calls;
		};
		await cache.get("k", fetcher);
		cache.invalidate("k");
		expect(cache.peek("k")).toEqual({ hit: false });
		expect(await cache.get("k", fetcher)).toBe(2);
	});

	test("single-flights parallel misses", async () => {
		let calls = 0;
		let release: (value: number) => void = () => undefined;
		const cache = new QueryCache();
		const fetcher = () =>
			new Promise<number>((resolve) => {
				calls += 1;
				release = resolve;
			});
		const a = cache.get("k", fetcher);
		const b = cache.get("k", fetcher);
		release(7);
		expect(await Promise.all([a, b])).toEqual([7, 7]);
		expect(calls).toBe(1);
	});

	test("force bypasses a fresh hit", async () => {
		let calls = 0;
		const cache = new QueryCache();
		const fetcher = async () => {
			calls += 1;
			return calls;
		};
		expect(await cache.get("k", fetcher)).toBe(1);
		expect(await cache.get("k", fetcher, true)).toBe(2);
		expect(await cache.get("k", fetcher)).toBe(2);
	});

	test("clear drops entries and notifies", async () => {
		const cache = new QueryCache();
		let ticks = 0;
		cache.subscribe(() => {
			ticks += 1;
		});
		cache.set("k", 1);
		expect(cache.peek<number>("k")).toEqual({ hit: true, value: 1 });
		cache.clear();
		expect(cache.peek("k")).toEqual({ hit: false });
		expect(ticks).toBe(2);
	});
});
