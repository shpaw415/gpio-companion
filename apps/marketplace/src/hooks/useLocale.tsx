import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import {
	detectLocale,
	LOCALE_STORAGE_KEY,
	type Locale,
	type Translate,
	translate,
} from "../i18n/index.ts";

type LocaleContextValue = {
	locale: Locale;
	setLocale: (locale: Locale) => void;
	t: Translate;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState<Locale>("en");

	useEffect(() => {
		let stored: string | null = null;
		try {
			stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
		} catch {
			// Storage can be unavailable in private or embedded contexts.
		}
		setLocaleState(detectLocale({ stored, browser: navigator.language }));
	}, []);

	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	function setLocale(next: Locale) {
		setLocaleState(next);
		if (typeof window === "undefined") return;
		try {
			window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
		} catch {
			// The in-memory choice remains valid for this session.
		}
	}

	return (
		<LocaleContext.Provider
			value={{
				locale,
				setLocale,
				t: (key, vars) => translate(locale, key, vars),
			}}
		>
			{children}
		</LocaleContext.Provider>
	);
}

export function useLocale(): LocaleContextValue {
	const value = useContext(LocaleContext);
	if (!value) throw new Error("useLocale must be used within LocaleProvider");
	return value;
}

export function useT(): Translate {
	return useLocale().t;
}
