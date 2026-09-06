"no action";

import { mintDeviceOfflineGrant } from "../../../lib/device-api.ts";
import {
	asString,
	type MobileContext,
	readJsonBody,
	runMobile,
} from "../../../lib/mobile-http.ts";
import { requireAccessibleDevice } from "../../../lib/pairing-store.ts";

export async function onRequestPost(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const uuid = asString((await readJsonBody(ctx.request)).uuid).trim();
		if (!uuid) {
			throw new Error("uuid is required");
		}
		await requireAccessibleDevice(ctx.env.DYNAMIC_PAGE_KV, identity, uuid);
		return mintDeviceOfflineGrant(ctx.env, uuid, identity.id);
	});
}
