"no action";

import { loginFromEmail } from "gpio-companion";
import {
	readDeviceJson,
	signedDeviceFetch,
} from "../../../../lib/device-api.ts";
import {
	asString,
	type MobileContext,
	readJsonBody,
	runMobile,
} from "../../../../lib/mobile-http.ts";
import {
	clearPendingForUuid,
	findDeviceByUuid,
	listAllDevices,
	publicPairing,
	transferDeviceRecord,
	updateDeviceLabelByUuid,
} from "../../../../lib/pairing-store.ts";
import { requireAdmin } from "../../../../lib/session.ts";
import { unpairDevice } from "../../pair.ts";

export async function onRequestGet(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		requireAdmin(identity);
		const paired = await listAllDevices(ctx.env.DYNAMIC_PAGE_KV);
		const devices = await Promise.all(
			paired.map(async (device) => {
				let status: Record<string, unknown> | null = null;
				if (device.deviceUrl) {
					try {
						status = await readDeviceJson<Record<string, unknown>>(
							await signedDeviceFetch(
								ctx.env,
								device.deviceUrl,
								"GET",
								"/v1/status",
							),
						);
					} catch {
						status = null;
					}
				}
				return { device: publicPairing(device), status };
			}),
		);
		return { devices };
	});
}

export async function onRequestPatch(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		requireAdmin(identity);
		const body = await readJsonBody(ctx.request);
		const device = await updateDeviceLabelByUuid(
			ctx.env.DYNAMIC_PAGE_KV,
			asString(body.uuid),
			asString(body.label),
		);
		return { ok: true as const, device: publicPairing(device) };
	});
}

export async function onRequestDelete(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		requireAdmin(identity);
		const url = new URL(ctx.request.url);
		const uuid = asString(url.searchParams.get("uuid"));
		const device = await findDeviceByUuid(ctx.env.DYNAMIC_PAGE_KV, uuid);
		await clearPendingForUuid(
			ctx.env.DYNAMIC_PAGE_KV,
			device.uuid,
			device.userId,
		);
		return unpairDevice(ctx.env, device.userId, device.uuid);
	});
}

export async function onRequestPost(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		requireAdmin(identity);
		const body = await readJsonBody(ctx.request);
		const uuid = asString(body.uuid);
		const device = await findDeviceByUuid(ctx.env.DYNAMIC_PAGE_KV, uuid);
		const toUserId = asString(body.toUserId).trim() || identity.id;
		if (!toUserId) {
			throw new Error("toUserId is required");
		}
		if (device.userId === toUserId) {
			return { ok: true as const, device: publicPairing(device) };
		}
		const login =
			toUserId === identity.id
				? loginFromEmail(identity.email ?? "") || identity.id
				: toUserId;
		const email = toUserId === identity.id ? (identity.email ?? "") : "";
		if (device.deviceUrl) {
			await readDeviceJson(
				await signedDeviceFetch(
					ctx.env,
					device.deviceUrl,
					"POST",
					"/v1/pairing/transfer",
					{
						uuid: device.uuid,
						key: device.key,
						userId: toUserId,
						email,
						login,
					},
				),
			).catch(() => undefined);
		}
		const next = await transferDeviceRecord(ctx.env.DYNAMIC_PAGE_KV, device, {
			userId: toUserId,
			email,
			login,
		});
		return { ok: true as const, device: publicPairing(next) };
	});
}
