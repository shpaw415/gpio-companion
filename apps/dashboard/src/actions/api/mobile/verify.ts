"no action";

import {
	type CircuitVerifyState,
	parseVerifyPut,
	VERIFY_PATH,
	VERIFY_STOP_PATH,
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
		return readDeviceJson<CircuitVerifyState>(
			await signedDeviceFetch(ctx.env, deviceUrl, "GET", VERIFY_PATH),
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
		if (body.stop === true) {
			await requireOwnedDevice(ctx.env.DYNAMIC_PAGE_KV, identity.id, uuid);
			if (sign) {
				return signDeviceEnvelope(ctx.env, "POST", VERIFY_STOP_PATH, {});
			}
			const device = await requireOwnedDevice(
				ctx.env.DYNAMIC_PAGE_KV,
				identity.id,
				uuid,
			);
			if (!device.deviceUrl) {
				throw new Error("device URL is missing");
			}
			return readDeviceJson<{ stopped: boolean }>(
				await signedDeviceFetch(
					ctx.env,
					device.deviceUrl,
					"POST",
					VERIFY_STOP_PATH,
					{},
				),
			);
		}
		if (typeof body.repo === "string" && body.repo.trim()) {
			await requireOwnedDevice(ctx.env.DYNAMIC_PAGE_KV, identity.id, uuid);
			const put = parseVerifyPut(body);
			if (sign) {
				return signDeviceEnvelope(ctx.env, "POST", VERIFY_PATH, put);
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
					VERIFY_PATH,
					put,
				),
			);
		}
		await requireAccessibleDevice(ctx.env.DYNAMIC_PAGE_KV, identity, uuid);
		return signDeviceEnvelope(ctx.env, "GET", VERIFY_PATH);
	});
}
