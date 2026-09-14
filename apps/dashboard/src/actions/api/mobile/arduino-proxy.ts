"no action";

import {
	ARDUINO_PROXY_PATH,
	type ArduinoProxyStatus,
	FLASH_PROXY_PATH,
	parseFlashProxyPut,
} from "gpio-companion";
import { resolveAccessibleDeviceUrl } from "../../../lib/debug-live.ts";
import { readDeviceJson, signedDeviceFetch } from "../../../lib/device-api.ts";
import {
	asString,
	type MobileContext,
	readJsonBody,
	runMobile,
} from "../../../lib/mobile-http.ts";
import { requireOwnedDevice } from "../../../lib/pairing-store.ts";

export async function onRequestGet(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const uuid = asString(
			new URL(ctx.request.url).searchParams.get("uuid"),
		).trim();
		if (!uuid) {
			throw new Error("uuid is required");
		}
		const deviceUrl = await resolveAccessibleDeviceUrl(
			ctx.env.DYNAMIC_PAGE_KV,
			identity,
			uuid,
		);
		return readDeviceJson<ArduinoProxyStatus>(
			await signedDeviceFetch(ctx.env, deviceUrl, "GET", ARDUINO_PROXY_PATH),
		);
	});
}

export async function onRequestPost(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const body = await readJsonBody(ctx.request);
		const uuid = asString(body.uuid).trim();
		if (!uuid) {
			throw new Error("uuid is required");
		}
		const device = await requireOwnedDevice(
			ctx.env.DYNAMIC_PAGE_KV,
			identity.id,
			uuid,
		);
		if (!device.deviceUrl) {
			throw new Error("device URL is missing");
		}
		const put = parseFlashProxyPut(body);
		return readDeviceJson<{ started: boolean }>(
			await signedDeviceFetch(
				ctx.env,
				device.deviceUrl,
				"POST",
				FLASH_PROXY_PATH,
				put,
			),
		);
	});
}
