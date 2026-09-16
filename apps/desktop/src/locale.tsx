import {
	catalogFor,
	createTranslator,
	detectLocale,
	LOCALE_STORAGE_KEY,
	type LocaleCode,
	type Messages,
	parseLocale,
	type Translate,
} from "gpio-companion-i18n";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useLayoutEffect,
	useMemo,
	useState,
} from "react";

type LocaleContextValue = {
	locale: LocaleCode;
	setLocale: (locale: LocaleCode) => void;
	t: Translate<Messages>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): LocaleCode {
	try {
		return detectLocale({
			stored: window.localStorage.getItem(LOCALE_STORAGE_KEY),
		});
	} catch {
		return detectLocale();
	}
}

export function LocaleProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState<LocaleCode>(readStoredLocale);

	useLayoutEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	const setLocale = useCallback((next: LocaleCode) => {
		setLocaleState(next);
		document.documentElement.lang = next;
		try {
			window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
		} catch {
			return;
		}
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
