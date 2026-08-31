"no action";

import {
	asString,
	errorStatus,
	jsonFail,
	jsonOk,
	type MobileContext,
	requireMobileIdentity,
} from "../../../lib/mobile-http.ts";
import { listPairing, unpairDevice } from "../pair.ts";

export async function onRequestGet(ctx: MobileContext) {
	try {
		const identity = await requireMobileIdentity(ctx);
		if (!identity.id) {
			throw new Error("sign in first");
		}
		return jsonOk(await listPairing(ctx.env, identity.id));
	} catch (caught) {
		return jsonFail(
			caught instanceof Error ? caught.message : "request failed",
			errorStatus(caught),
		);
	}
}

export async function onRequestDelete(ctx: MobileContext) {
	try {
		const identity = await requireMobileIdentity(ctx);
		if (!identity.id) {
			throw new Error("sign in first");
		}
		const url = new URL(ctx.request.url);
		const uuid = asString(url.searchParams.get("uuid"));
		return jsonOk(await unpairDevice(ctx.env, identity.id, uuid));
	} catch (caught) {
		return jsonFail(
			caught instanceof Error ? caught.message : "request failed",
			errorStatus(caught),
		);
	}
}
