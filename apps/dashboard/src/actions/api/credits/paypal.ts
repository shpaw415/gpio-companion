import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { wrapAction } from "../../../lib/action.ts";
import {
	CREDIT_PACKS_USD,
	isCreditPackUsd,
} from "../../../lib/credit-packs.ts";
import {
	applyPaypalCapture,
	creditsView,
	savePaypalOrderCreated,
} from "../../../lib/credits.ts";
import {
	captureCreditsOrder,
	createCreditsOrder,
	isPaypalConfigured,
	isPaypalLive,
	type PaypalEnv,
	paypalClientId,
} from "../../../lib/paypal.ts";
import { requireIdentity } from "../../../lib/session.ts";

type PagesEnv = PaypalEnv & {
	DYNAMIC_PAGE_KV: KVNamespace;
};

export const GET = wrapAction(async function GET() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	await requireIdentity(ctx);
	return {
		configured: isPaypalConfigured(ctx.env),
		liveMode: isPaypalLive(ctx.env),
		clientId: paypalClientId(ctx.env),
		packs: [...CREDIT_PACKS_USD],
	};
});

export const POST = wrapAction(async function POST(usd: number) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!isCreditPackUsd(usd)) {
		throw new Error("amount must be a credit pack");
	}
	const created = await createCreditsOrder(ctx.env, {
		usd,
		userId: identity.id,
	});
	await savePaypalOrderCreated(
		ctx.env.DYNAMIC_PAGE_KV,
		created.orderId,
		identity.id,
		usd,
	);
	return created;
});

export const PUT = wrapAction(async function PUT(orderId: string) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	const order = await captureCreditsOrder(ctx.env, orderId);
	if (order.customId && order.customId !== identity.id) {
		throw new Error("PayPal order does not belong to this account.");
	}
	if (!isCreditPackUsd(order.usd)) {
		throw new Error("PayPal amount is not a credit pack.");
	}
	const granted = await applyPaypalCapture(ctx.env.DYNAMIC_PAGE_KV, {
		orderId: order.id,
		userId: identity.id,
		usd: order.usd,
		captureId: order.captureId,
	});
	return creditsView(granted.micros);
});
