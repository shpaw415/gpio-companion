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
import { claimDevice, signPairingCredentials } from "../pair.ts";

export async function onRequestPut(ctx: MobileContext) {
	try {
		await requireMobileIdentity(ctx);
		return jsonOk(await signPairingCredentials(ctx.env));
	} catch (caught) {
		return jsonFail(
			caught instanceof Error ? caught.message : "request failed",
			errorStatus(caught),
		);
	}
}

export async function onRequestPost(ctx: MobileContext) {
	try {
		const identity = await requireMobileIdentity(ctx);
		if (!identity.id) {
			throw new Error("sign in first");
		}
		const body = await readJsonBody(ctx.request);
		return jsonOk(
			await claimDevice(
				ctx.env,
				{ id: identity.id, email: identity.email },
				{
					uuid: asString(body.uuid),
					key: asString(body.key),
					deviceUrl: asString(body.deviceUrl) || undefined,
				},
			),
		);
	} catch (caught) {
		return jsonFail(
			caught instanceof Error ? caught.message : "request failed",
			errorStatus(caught),
		);
	}
}
