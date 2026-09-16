import { en, type Messages } from "./en.ts";
import { fr } from "./fr.ts";

export const LOCALES = [
	{ code: "en", nativeLabel: "English", catalog: en },
	{ code: "fr", nativeLabel: "Français", catalog: fr },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];
export type LocaleEntry = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: LocaleCode = "en";
export const LOCALE_STORAGE_KEY = "gpio-companion-locale";

const byCode = new Map<string, LocaleEntry>(
	LOCALES.map((entry) => [entry.code, entry]),
);

export function catalogFor(locale: LocaleCode): Messages {
	return byCode.get(locale)?.catalog ?? en;
}

export function parseLocale(
	value: string | null | undefined,
): LocaleCode | null {
	if (!value) {
		return null;
	}
	const lower = value.trim().toLowerCase().replaceAll("_", "-");
	if (byCode.has(lower)) {
		return lower as LocaleCode;
	}
	const prefix = lower.split("-")[0];
	if (prefix && byCode.has(prefix)) {
		return prefix as LocaleCode;
	}
	return null;
}
