"no action";

import { UPDATE_PATH } from "gpio-companion";
import { resolveAccessibleDeviceUrl } from "../../../lib/debug-live.ts";
import { readDeviceJson, signedDeviceFetch } from "../../../lib/device-api.ts";
import {
	asString,
	type MobileContext,
	readJsonBody,
	runMobile,
} from "../../../lib/mobile-http.ts";

export async function onRequestPost(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const body = await readJsonBody(ctx.request);
		const uuid = asString(body.uuid).trim();
		if (!uuid) {
			throw new Error("uuid is required");
		}
		const deviceUrl = await resolveAccessibleDeviceUrl(
			ctx.env.DYNAMIC_PAGE_KV,
			identity,
			uuid,
		);
		return readDeviceJson<{ started: boolean }>(
			await signedDeviceFetch(ctx.env, deviceUrl, "POST", UPDATE_PATH),
		);
	});
}
