import { describe, expect, test } from "bun:test";
import { detectLocale } from "./detect.ts";
import { en, type Messages } from "./en.ts";
import { translateError } from "./errors.ts";
import { fr } from "./fr.ts";
import { catalogFor, DEFAULT_LOCALE, LOCALES, parseLocale } from "./locales.ts";
import { createTranslator, interpolate, lookup } from "./t.ts";

function keysOf(value: unknown, prefix = ""): string[] {
	if (typeof value === "string") {
		return prefix ? [prefix] : [];
	}
	if (!value || typeof value !== "object") {
		return [];
	}
	return Object.entries(value as Record<string, unknown>).flatMap(
		([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key),
	);
}

describe("locale registry", () => {
	test("ships english and french", () => {
		expect(LOCALES.map((entry) => entry.code)).toEqual(["en", "fr"]);
		expect(LOCALES[0]?.nativeLabel).toBe("English");
		expect(LOCALES[1]?.nativeLabel).toBe("Français");
		expect(DEFAULT_LOCALE).toBe("en");
	});

	test("french catalog covers every english key", () => {
		expect(keysOf(fr).sort()).toEqual(keysOf(en).sort());
	});

	test("parseLocale matches prefixes and rejects unknown codes", () => {
		expect(parseLocale("fr-CA")).toBe("fr");
		expect(parseLocale("fr_FR")).toBe("fr");
		expect(parseLocale("en-US")).toBe("en");
		expect(parseLocale("es")).toBeNull();
		expect(parseLocale("")).toBeNull();
	});

	test("detectLocale prefers stored then device then english", () => {
		expect(detectLocale({ stored: "fr", device: "en-US" })).toBe("fr");
		expect(detectLocale({ stored: "nope", device: "fr-CA" })).toBe("fr");
		expect(detectLocale({ stored: null, device: "de-DE" })).toBe("en");
	});

	test("catalogFor falls back to english", () => {
		expect(catalogFor("fr")).toBe(fr);
		expect(catalogFor("en")).toBe(en);
	});
});

describe("translator", () => {
	test("interpolates placeholders", () => {
		expect(interpolate("Pin {n} {name}", { n: 7, name: "GPIO" })).toBe(
			"Pin 7 GPIO",
		);
		expect(interpolate("keep {missing}", {})).toBe("keep {missing}");
	});

	test("looks up nested keys and falls back", () => {
		expect(lookup(en, "nav.project")).toBe("Project");
		expect(lookup(fr, "nav.project")).toBe("Projet");
		expect(lookup(en, "nav.missing")).toBeUndefined();
		const t = createTranslator<Messages>(fr, en);
		expect(t("nav.profile")).toBe("Profil");
		expect(t("docs.resultsFor", { n: 2, query: "wifi" })).toBe(
			"2 résultat(s) pour « wifi »",
		);
	});

	test("translateError maps known english wire copy", () => {
		const t = createTranslator<Messages>(fr, en);
		expect(translateError(t, "sign in first")).toBe("Connectez-vous d’abord");
		expect(translateError(t, "pair failed")).toBe("association échouée");
		expect(translateError(t, "unknown boom")).toBe("unknown boom");
	});
});
