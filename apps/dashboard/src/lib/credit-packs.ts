export const CREDIT_PACKS_USD = [5, 10, 25, 50] as const;

export type CreditPackUsd = (typeof CREDIT_PACKS_USD)[number];

export function isCreditPackUsd(value: unknown): value is CreditPackUsd {
	return CREDIT_PACKS_USD.some((pack) => pack === Number(value));
}

export function usdToPaypalValue(usd: number): string {
	return usd.toFixed(2);
}

export function paypalValueToUsd(value: string | undefined): number | null {
	const parsed = Number.parseFloat(value ?? "");
	if (!Number.isFinite(parsed)) {
		return null;
	}
	return parsed;
}
