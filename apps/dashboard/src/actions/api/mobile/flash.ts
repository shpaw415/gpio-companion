"no action";

import {
	FLASH_PATH,
	FLASH_PORTS_PATH,
	type FlashPort,
	type FlashStatus,
	parseFlashPut,
} from "gpio-companion";
import { resolveAccessibleDeviceUrl } from "../../../lib/debug-live.ts";
import {
	readDeviceJson,
	signDeviceEnvelope,
	signedDeviceFetch,
} from "../../../lib/device-api.ts";
import {
	asString,
	type MobileContext,
	readJsonBody,
	runMobile,
} from "../../../lib/mobile-http.ts";
import {
	requireAccessibleDevice,
	requireOwnedDevice,
} from "../../../lib/pairing-store.ts";

export async function onRequestGet(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const url = new URL(ctx.request.url);
		const uuid = asString(url.searchParams.get("uuid")).trim();
		if (!uuid) {
			throw new Error("uuid is required");
		}
		const deviceUrl = await resolveAccessibleDeviceUrl(
			ctx.env.DYNAMIC_PAGE_KV,
			identity,
			uuid,
		);
		if (url.searchParams.get("ports")) {
			return readDeviceJson<{ ports: FlashPort[] }>(
				await signedDeviceFetch(ctx.env, deviceUrl, "GET", FLASH_PORTS_PATH),
			);
		}
		return readDeviceJson<FlashStatus>(
			await signedDeviceFetch(ctx.env, deviceUrl, "GET", FLASH_PATH),
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
		const sign = body.sign === true;
		if (typeof body.fqbn === "string" && body.fqbn.trim()) {
			await requireOwnedDevice(ctx.env.DYNAMIC_PAGE_KV, identity.id, uuid);
			const put = parseFlashPut(body);
			if (sign) {
				return signDeviceEnvelope(ctx.env, "POST", FLASH_PATH, put);
			}
			const device = await requireOwnedDevice(
				ctx.env.DYNAMIC_PAGE_KV,
				identity.id,
				uuid,
			);
			if (!device.deviceUrl) {
				throw new Error("device URL is missing");
			}
			return readDeviceJson<{ started: boolean }>(
				await signedDeviceFetch(
					ctx.env,
					device.deviceUrl,
					"POST",
					FLASH_PATH,
					put,
				),
			);
		}
		await requireAccessibleDevice(ctx.env.DYNAMIC_PAGE_KV, identity, uuid);
		if (body.ports === true) {
			return signDeviceEnvelope(ctx.env, "GET", FLASH_PORTS_PATH);
		}
		return signDeviceEnvelope(ctx.env, "GET", FLASH_PATH);
	});
}
