import { en, type Messages } from "./en.ts";
import { fr } from "./fr.ts";

export const LOCALE_STORAGE_KEY = "gpio-companion-locale";
export const LOCALES = [
	{ code: "en", nativeLabel: "English", catalog: en },
	{ code: "fr", nativeLabel: "Français", catalog: fr },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];
export type TranslationKey = LeafKeys<Messages>;
export type TranslationVars = Record<string, string | number>;

type LeafKeys<T, Prefix extends string = ""> = {
	[K in keyof T & string]: T[K] extends string
		? `${Prefix}${K}`
		: T[K] extends Record<string, unknown>
			? LeafKeys<T[K], `${Prefix}${K}.`>
			: never;
}[keyof T & string];

export function parseLocale(value: string | null | undefined): Locale | null {
	if (!value) return null;
	const normalized = value.trim().toLowerCase().replaceAll("_", "-");
	const base = normalized.split("-")[0];
	return base === "fr" || base === "en" ? base : null;
}

export function detectLocale(options?: {
	stored?: string | null;
	browser?: string | null;
}): Locale {
	let browser = options?.browser;
	if (browser === undefined && typeof navigator !== "undefined") {
		browser = navigator.language;
	}
	return parseLocale(options?.stored) ?? parseLocale(browser) ?? "en";
}

export function catalogFor(locale: Locale): Messages {
	return locale === "fr" ? fr : en;
}

function lookup(messages: unknown, key: string): string | undefined {
	let value = messages;
	for (const part of key.split(".")) {
		if (!value || typeof value !== "object") return undefined;
		value = (value as Record<string, unknown>)[part];
	}
	return typeof value === "string" ? value : undefined;
}

export function translate(
	locale: Locale,
	key: TranslationKey,
	vars?: TranslationVars,
): string {
	const template = lookup(catalogFor(locale), key) ?? lookup(en, key) ?? key;
	return template.replace(/\{(\w+)\}/g, (match, name: string) => {
		const value = vars?.[name];
		return value === undefined ? match : String(value);
	});
}

export type Translate = (key: TranslationKey, vars?: TranslationVars) => string;

export { en, fr };
