import { DEFAULT_LOCALE, type LocaleCode, parseLocale } from "./locales.ts";

export function detectDeviceLocale(tag?: string | null): string | null {
	if (tag) {
		return tag;
	}
	try {
		const language = (globalThis as { navigator?: { language?: string } })
			.navigator?.language;
		if (language) {
			return language;
		}
	} catch {
		return null;
	}
	try {
		return Intl.DateTimeFormat().resolvedOptions().locale;
	} catch {
		return null;
	}
}

export function detectLocale(options?: {
	stored?: string | null;
	device?: string | null;
}): LocaleCode {
	return (
		parseLocale(options?.stored) ??
		parseLocale(detectDeviceLocale(options?.device)) ??
		DEFAULT_LOCALE
	);
}
