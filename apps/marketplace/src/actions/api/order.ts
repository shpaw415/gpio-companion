import { getContext } from "@next/action/context";
import { commerceDb, requireUser } from "../../lib/admin-auth.ts";
import { getOrder } from "../../lib/commerce/order-repository.ts";

export async function GET(id: string) {
	const ctx = getContext<Env, never, never>(arguments);
	const session = await requireUser(ctx);
	const order = await getOrder(commerceDb(ctx), id);
	if (!order || order.userId !== session.id) return null;
	return order;
}
