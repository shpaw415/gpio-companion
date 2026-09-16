import {
	catalogFor,
	createTranslator,
	detectLocale,
	LOCALE_STORAGE_KEY,
	type LocaleCode,
	type Messages,
	parseLocale,
	type Translate,
	translateError,
} from "gpio-companion-i18n";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { storageGet, storageSet } from "./storage.ts";

type LocaleContextValue = {
	locale: LocaleCode;
	setLocale: (locale: LocaleCode) => void;
	t: Translate<Messages>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState<LocaleCode>(() => detectLocale());

	useEffect(() => {
		void storageGet(LOCALE_STORAGE_KEY).then((stored) => {
			setLocaleState(detectLocale({ stored }));
		});
	}, []);

	const setLocale = useCallback((next: LocaleCode) => {
		setLocaleState(next);
		void storageSet(LOCALE_STORAGE_KEY, next);
	}, []);

	const t = useMemo(
		() => createTranslator(catalogFor(locale), catalogFor("en")),
		[locale],
	);

	const value = useMemo(
		() => ({ locale, setLocale, t }),
		[locale, setLocale, t],
	);

	return (
		<LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
	);
}

export function useLocale(): LocaleContextValue {
	const ctx = useContext(LocaleContext);
	if (!ctx) {
		throw new Error("useLocale must be used within LocaleProvider");
	}
	return ctx;
}

export function useT(): Translate<Messages> {
	return useLocale().t;
}

export function asLocale(value: string): LocaleCode {
	return parseLocale(value) ?? "en";
}

export type { MessageKey, Messages, Translate } from "gpio-companion-i18n";
export { translateError };
