import { getContext } from "@next/action/context";
import { commerceDb, requireAdmin } from "../../../lib/admin-auth.ts";
import {
	createShippingRate,
	deleteShippingRate,
	listShippingRates,
	type ShippingRateInput,
	updateShippingRate,
} from "../../../lib/commerce/admin-repository.ts";

export async function GET() {
	const ctx = getContext<Env, never, never>(arguments);
	return listShippingRates(commerceDb(ctx));
}

export async function POST(input: ShippingRateInput) {
	const ctx = getContext<Env, never, never>(arguments);
	return createShippingRate(commerceDb(ctx), input);
}

export async function PUT(id: string, input: ShippingRateInput) {
	const ctx = getContext<Env, never, never>(arguments);
	return updateShippingRate(commerceDb(ctx), id, input);
}

export async function DELETE(id: string) {
	const ctx = getContext<Env, never, never>(arguments);
	return deleteShippingRate(commerceDb(ctx), id);
}
