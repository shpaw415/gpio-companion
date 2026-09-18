import { assertCountryCode, normalizeRegion } from "./validation";

export interface ShippingRateCandidate {
	id: string;
	country: string;
	region: string | null;
	flatCents: number;
}

function safeMoney(value: number, label: string): number {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new Error(`${label} is outside the supported integer-cent range`);
	}
	return value;
}

export function availableInventory(onHand: number, reserved: number): number {
	if (!Number.isSafeInteger(onHand) || !Number.isSafeInteger(reserved)) {
		throw new Error("Inventory values must be safe integers");
	}
	return Math.max(0, onHand - reserved);
}

export function selectShippingRate(
	rates: readonly ShippingRateCandidate[],
	country: string,
	region?: string | null,
): ShippingRateCandidate | null {
	const normalizedCountry = assertCountryCode(country);
	const normalizedRegion = normalizeRegion(region);
	return (
		rates.find(
			(rate) =>
				rate.country.toUpperCase() === normalizedCountry &&
				rate.region?.toUpperCase() === normalizedRegion,
		) ??
		rates.find(
			(rate) =>
				rate.country.toUpperCase() === normalizedCountry &&
				rate.region === null,
		) ??
		null
	);
}

export function calculateCartTotals(
	lines: readonly { unitPriceCents: number; quantity: number }[],
	shippingCents: number,
	taxCents = 0,
): {
	subtotalCents: number;
	shippingCents: number;
	taxCents: number;
	totalCents: number;
} {
	const subtotalCents = lines.reduce((total, line) => {
		if (!Number.isInteger(line.quantity) || line.quantity < 1) {
			throw new Error("Line quantity must be a positive integer");
		}
		return safeMoney(
			total + safeMoney(line.unitPriceCents * line.quantity, "Line total"),
			"Subtotal",
		);
	}, 0);
	const safeShipping = safeMoney(shippingCents, "Shipping");
	const safeTax = safeMoney(taxCents, "Tax");
	return {
		subtotalCents,
		shippingCents: safeShipping,
		taxCents: safeTax,
		totalCents: safeMoney(subtotalCents + safeShipping + safeTax, "Total"),
	};
}
