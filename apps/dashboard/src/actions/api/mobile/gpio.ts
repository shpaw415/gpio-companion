"no action";

import {
	GPIO_PATH,
	type GpioSnapshot,
	isGpioWsRefresh,
	parseGpioWsCommand,
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
		return readDeviceJson<GpioSnapshot>(
			await signedDeviceFetch(ctx.env, deviceUrl, "GET", GPIO_PATH),
		);
	});
}

export async function onRequestPut(ctx: MobileContext) {
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
		const command = parseGpioWsCommand(body);
		if (isGpioWsRefresh(command)) {
			throw new Error("refresh is websocket-only");
		}
		return readDeviceJson<GpioSnapshot>(
			await signedDeviceFetch(
				ctx.env,
				device.deviceUrl,
				"PUT",
				GPIO_PATH,
				command,
			),
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
		if (body.physical !== undefined) {
			await requireOwnedDevice(ctx.env.DYNAMIC_PAGE_KV, identity.id, uuid);
			const command = parseGpioWsCommand(body);
			if (isGpioWsRefresh(command)) {
				throw new Error("refresh is websocket-only");
			}
			return signDeviceEnvelope(ctx.env, "PUT", GPIO_PATH, command);
		}
		await requireAccessibleDevice(ctx.env.DYNAMIC_PAGE_KV, identity, uuid);
		return signDeviceEnvelope(ctx.env, "GET", GPIO_PATH);
	});
}
