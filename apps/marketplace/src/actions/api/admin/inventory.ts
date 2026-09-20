import { getContext } from "@next/action/context";
import { commerceDb, requireAdmin } from "../../../lib/admin-auth.ts";
import {
	adjustInventory,
	configureInventory,
	listInventoryAdjustments,
} from "../../../lib/commerce/admin-repository.ts";

export async function GET(productId?: string) {
	const ctx = getContext<Env, never, never>(arguments);
	return listInventoryAdjustments(commerceDb(ctx), productId || undefined);
}

export async function POST(productId: string, onHand: number) {
	const ctx = getContext<Env, never, never>(arguments);
	return configureInventory(commerceDb(ctx), productId, onHand);
}

export async function PUT(productId: string, delta: number, reason: string) {
	const ctx = getContext<Env, never, never>(arguments);
	return adjustInventory(commerceDb(ctx), {
		productId,
		delta,
		reason,
		actorId: "admin",
	});
}
