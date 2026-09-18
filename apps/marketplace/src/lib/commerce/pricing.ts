import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { CommerceDatabase } from "../db/client";
import {
	inventory,
	inventoryReservations,
	products,
	shippingRates,
} from "../db/schema";
import {
	availableInventory,
	calculateCartTotals,
	selectShippingRate,
} from "./totals";
import {
	assertCountryCode,
	type CartInputItem,
	normalizeRegion,
	validateCartInput,
} from "./validation";

export interface PricedCartLine {
	productId: string;
	sku: string;
	nameEn: string;
	nameFr: string;
	unitPriceCents: number;
	quantity: number;
	lineTotalCents: number;
}

export async function priceCart(
	db: CommerceDatabase,
	items: readonly CartInputItem[],
	destination: { country: string; region?: string | null },
) {
	const validatedItems = validateCartInput(items);
	const ids = validatedItems.map((item) => item.productId);
	const now = Math.floor(Date.now() / 1000);
	const productRows = await db
		.select({
			id: products.id,
			sku: products.sku,
			nameEn: products.nameEn,
			nameFr: products.nameFr,
			priceCents: products.priceCents,
			onHand: inventory.onHand,
			reserved: sql<number>`coalesce((select sum(${inventoryReservations.quantity}) from ${inventoryReservations} where ${inventoryReservations.productId} = ${products.id} and ${inventoryReservations.status} = 'active' and ${inventoryReservations.expiresAt} > ${now}), 0)`,
		})
		.from(products)
		.innerJoin(inventory, eq(inventory.productId, products.id))
		.where(and(eq(products.status, "published"), inArray(products.id, ids)));

	const byId = new Map(productRows.map((row) => [row.id, row]));
	const lines: PricedCartLine[] = validatedItems.map((item) => {
		const product = byId.get(item.productId);
		if (!product || product.priceCents === null) {
			throw new Error(`Product is not available: ${item.productId}`);
		}
		if (availableInventory(product.onHand, product.reserved) < item.quantity) {
			throw new Error(`Insufficient inventory: ${item.productId}`);
		}
		return {
			productId: product.id,
			sku: product.sku,
			nameEn: product.nameEn,
			nameFr: product.nameFr,
			unitPriceCents: product.priceCents,
			quantity: item.quantity,
			lineTotalCents: product.priceCents * item.quantity,
		};
	});

	const country = assertCountryCode(destination.country);
	const region = normalizeRegion(destination.region);
	const rates = await db
		.select({
			id: shippingRates.id,
			country: shippingRates.country,
			region: shippingRates.region,
			flatCents: shippingRates.flatCents,
		})
		.from(shippingRates)
		.where(
			and(
				eq(shippingRates.active, true),
				eq(shippingRates.country, country),
				region === null
					? isNull(shippingRates.region)
					: or(eq(shippingRates.region, region), isNull(shippingRates.region)),
			),
		);
	const shippingRate = selectShippingRate(rates, country, region);
	if (!shippingRate) throw new Error(`Shipping is unavailable for ${country}`);

	return {
		currency: "USD" as const,
		lines,
		shippingRateId: shippingRate.id,
		...calculateCartTotals(lines, shippingRate.flatCents),
	};
}
