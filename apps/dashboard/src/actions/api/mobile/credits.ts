"no action";

import { creditsBalance, creditsView, grantUsd } from "../../../lib/credits.ts";
import {
	type MobileContext,
	readJsonBody,
	runMobile,
} from "../../../lib/mobile-http.ts";

export async function onRequestGet(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const micros = await creditsBalance(ctx.env.DYNAMIC_PAGE_KV, identity.id);
		return creditsView(micros);
	});
}

export async function onRequestPost(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const body = await readJsonBody(ctx.request);
		const grant = Number(body.usd ?? 1);
		if (!Number.isFinite(grant) || grant <= 0) {
			throw new Error("amount must be positive");
		}
		const micros = await grantUsd(
			ctx.env.DYNAMIC_PAGE_KV,
			identity.id,
			grant,
		);
		return creditsView(micros);
	});
}
