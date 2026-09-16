export { en, type Messages } from "./en.ts";
export { fr } from "./fr.ts";
export {
	catalogFor,
	DEFAULT_LOCALE,
	type LocaleCode,
	type LocaleEntry,
	LOCALES,
	LOCALE_STORAGE_KEY,
	parseLocale,
} from "./locales.ts";
export { detectDeviceLocale, detectLocale } from "./detect.ts";
export { createTranslator, interpolate, lookup } from "./t.ts";
export { translateError } from "./errors.ts";
export type { MessageKey, Translate, TranslateVars } from "./types.ts";
