"no action";

import {
	asString,
	errorStatus,
	jsonFail,
	jsonOk,
	type MobileContext,
	readJsonBody,
	requireMobileIdentity,
} from "../../../lib/mobile-http.ts";
import { updateDeviceLabel } from "../../../lib/pairing-store.ts";
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

export async function onRequestPatch(ctx: MobileContext) {
	try {
		const identity = await requireMobileIdentity(ctx);
		if (!identity.id) {
			throw new Error("sign in first");
		}
		const body = await readJsonBody(ctx.request);
		const device = await updateDeviceLabel(
			ctx.env.DYNAMIC_PAGE_KV,
			identity.id,
			asString(body.uuid),
			asString(body.label),
		);
		return jsonOk({ ok: true as const, device });
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
