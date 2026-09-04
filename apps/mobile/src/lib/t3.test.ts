import { describe, expect, test } from "bun:test";
import { t3AppUrl, t3IframeSrc, tokenFromPairing } from "./t3.ts";

describe("t3 urls", () => {
	test("builds the public t3 origin from a uuid", () => {
		expect(t3AppUrl("a1b2-c3d4")).toBe("https://t3-a1b2c3d4.gpio-companion.com");
	});

	test("empty uuid is empty", () => {
		expect(t3AppUrl("")).toBe("");
		expect(t3IframeSrc("")).toBe("");
	});

	test("pair token is merged into path and hash", () => {
		expect(t3IframeSrc("abc", "tok")).toBe(
			"https://t3-abc.gpio-companion.com/pair?token=tok#token=tok",
		);
	});

	test("reads a pairing token from the url", () => {
		expect(
			tokenFromPairing({
				pairingUrl: "https://t3-abc.gpio-companion.com/pair#token=hello",
			}),
		).toBe("hello");
		expect(tokenFromPairing({ pairingToken: "direct" })).toBe("direct");
	});
});
