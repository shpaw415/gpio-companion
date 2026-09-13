"no action";

import {
	CONSOLE_PATH,
	CONSOLE_USB_PATH,
	CONSOLE_USB_STOP_PATH,
	parseConsoleUsbPut,
} from "gpio-companion";
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
				return signDeviceEnvelope(ctx.env, "POST", CONSOLE_USB_STOP_PATH, {});
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
					CONSOLE_USB_STOP_PATH,
					{},
				),
			);
		}
		if (typeof body.port === "string" && body.port.trim()) {
			await requireOwnedDevice(ctx.env.DYNAMIC_PAGE_KV, identity.id, uuid);
			const put = parseConsoleUsbPut(body);
			if (sign) {
				return signDeviceEnvelope(ctx.env, "POST", CONSOLE_USB_PATH, put);
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
					CONSOLE_USB_PATH,
					put,
				),
			);
		}
		await requireAccessibleDevice(ctx.env.DYNAMIC_PAGE_KV, identity, uuid);
		return signDeviceEnvelope(ctx.env, "GET", CONSOLE_PATH);
	});
}
