"no action";

import { parseWifiConfig } from "gpio-companion";
import { signDeviceEnvelope } from "../../../lib/device-api.ts";
import {
	asString,
	errorStatus,
	jsonFail,
	jsonOk,
	type MobileContext,
	readJsonBody,
	requireMobileIdentity,
} from "../../../lib/mobile-http.ts";
import { requireAccessibleDevice } from "../../../lib/pairing-store.ts";

export async function onRequestPost(ctx: MobileContext) {
	try {
		const identity = await requireMobileIdentity(ctx);
		if (!identity.id) {
			throw new Error("sign in first");
		}
		const body = await readJsonBody(ctx.request);
		const wifi = parseWifiConfig({
			uuid: asString(body.uuid),
			ssid: asString(body.ssid),
			psk: asString(body.psk),
		});
		await requireAccessibleDevice(ctx.env.DYNAMIC_PAGE_KV, identity, wifi.uuid);
		return jsonOk(
			await signDeviceEnvelope(ctx.env, "PUT", "/v1/config/wifi", wifi),
		);
	} catch (caught) {
		return jsonFail(
			caught instanceof Error ? caught.message : "request failed",
			errorStatus(caught),
		);
	}
}
