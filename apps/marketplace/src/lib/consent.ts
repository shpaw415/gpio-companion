export const CONSENT_STORAGE_KEY = "gpio-companion-marketplace-consent";
export const CONSENT_VERSION = 1;

export type CookieConsent = {
	version: number;
	thirdParty: boolean;
	decidedAt: number;
};

export function readConsent(): CookieConsent | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CookieConsent;
		if (parsed.version !== CONSENT_VERSION) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function writeConsent(thirdParty: boolean): CookieConsent {
	const value = { version: CONSENT_VERSION, thirdParty, decidedAt: Date.now() };
	window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(value));
	return value;
}
