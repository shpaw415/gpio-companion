import { describe, expect, test } from "bun:test";
import {
	CREDIT_PACKS_USD,
	isCreditPackUsd,
	paypalValueToUsd,
	usdToPaypalValue,
} from "./credit-packs.ts";

describe("credit packs", () => {
	test("allows the locked USD packs", () => {
		expect(CREDIT_PACKS_USD).toEqual([5, 10, 25, 50]);
		expect(isCreditPackUsd(5)).toBe(true);
		expect(isCreditPackUsd(10)).toBe(true);
		expect(isCreditPackUsd(25)).toBe(true);
		expect(isCreditPackUsd(50)).toBe(true);
	});

	test("rejects non-pack amounts", () => {
		expect(isCreditPackUsd(1)).toBe(false);
		expect(isCreditPackUsd(7)).toBe(false);
		expect(isCreditPackUsd("10")).toBe(true);
		expect(isCreditPackUsd("9.99")).toBe(false);
	});

	test("formats PayPal USD values", () => {
		expect(usdToPaypalValue(10)).toBe("10.00");
		expect(paypalValueToUsd("10.00")).toBe(10);
		expect(paypalValueToUsd("nope")).toBeNull();
	});
});
