import { describe, expect, test } from "bun:test";
import { detectLocale, parseLocale, translate } from "./index.ts";

describe("marketplace i18n", () => {
	test("normalizes supported locale tags", () => {
		expect(parseLocale("fr_CA")).toBe("fr");
		expect(parseLocale("EN-gb")).toBe("en");
		expect(parseLocale("de-DE")).toBeNull();
	});

	test("prefers a stored locale over the browser locale", () => {
		expect(detectLocale({ stored: "en", browser: "fr-FR" })).toBe("en");
	});

	test("provides complete French translations and interpolation", () => {
		expect(translate("fr", "nav.orders")).toBe("Commandes");
		expect(translate("fr", "cart.count", { count: 4 })).toBe(
			"4 articles dans le panier",
		);
	});
});
