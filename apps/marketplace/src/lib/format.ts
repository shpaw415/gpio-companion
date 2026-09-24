import type { Locale } from "../i18n/index.ts";

export function formatPrice(
	amount: number,
	currency = "USD",
	locale: Locale = "en",
): string {
	return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
		style: "currency",
		currency,
	}).format(amount);
}

export function formatCents(
	cents: number,
	currency = "USD",
	locale: Locale = "en",
): string {
	return formatPrice(cents / 100, currency, locale);
}

export function formatDate(
	value: string | number | Date,
	locale: Locale = "en",
) {
	return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
		dateStyle: "medium",
	}).format(new Date(value));
}
