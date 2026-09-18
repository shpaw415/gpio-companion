import { describe, expect, test } from "bun:test";
import { cartCount, normalizeCart, parseCart, updateCartItem } from "./cart.ts";

describe("marketplace cart", () => {
	test("parses, trims, merges, and clamps persisted items", () => {
		expect(
			parseCart(
				JSON.stringify([
					{ id: " kit-a ", quantity: 2.8, ignored: true },
					{ id: "kit-a", quantity: 9 },
					{ id: "kit-b", quantity: 0 },
					{ id: "kit-c", quantity: "2" },
				]),
			),
		).toEqual([
			{ id: "kit-a", quantity: 10 },
			{ id: "kit-b", quantity: 1 },
		]);
	});

	test("rejects malformed cart data", () => {
		expect(parseCart("not json")).toEqual([]);
		expect(normalizeCart({ id: "kit-a", quantity: 1 })).toEqual([]);
	});

	test("updates, removes, and counts quantities", () => {
		const items = updateCartItem([{ id: "kit-a", quantity: 2 }], "kit-a", 20);
		expect(items).toEqual([{ id: "kit-a", quantity: 10 }]);
		expect(cartCount(items)).toBe(10);
		expect(updateCartItem(items, "kit-a", 0)).toEqual([]);
	});
});
