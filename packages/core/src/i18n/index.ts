export { detectDeviceLocale, detectLocale } from "./detect.ts";
export { en, type Messages } from "./en.ts";
export { translateError } from "./errors.ts";
export { fr } from "./fr.ts";
export {
	catalogFor,
	DEFAULT_LOCALE,
	LOCALE_STORAGE_KEY,
	LOCALES,
	type LocaleCode,
	type LocaleEntry,
	parseLocale,
} from "./locales.ts";
export { createTranslator, interpolate, lookup } from "./t.ts";
export type { MessageKey, Translate, TranslateVars } from "./types.ts";
