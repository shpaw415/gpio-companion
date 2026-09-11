import { describe, expect, test } from "bun:test";
import { headerPinsForBoard } from "./gpio.ts";
import { skuPinout } from "./gpio-sku.ts";

describe("sku pinout", () => {
	test("matches orange pi 3 lts models", () => {
		expect(skuPinout("Orange Pi 3 LTS")?.slug).toBe("orangepi-3-lts");
		expect(skuPinout("OrangePi 3 LTS")?.pinCount).toBe(26);
		expect(skuPinout("orangepi3-lts")?.lines).toHaveLength(17);
	});

	test("unknown orange pi stays live-resolve", () => {
		expect(skuPinout("Orange Pi 5 Plus")).toBeNull();
		expect(skuPinout("Raspberry Pi 4")).toBeNull();
	});

	test("3 lts header stops at pin 26", () => {
		const pins = headerPinsForBoard("orangepi", "Orange Pi 3 LTS");
		expect(pins).toHaveLength(26);
		expect(pins.at(-1)?.physical).toBe(26);
	});
});
