"no action";

import { DEBUG_PATH, debugWsConnectUrl, parseDebugProbe } from "gpio-companion";
import { isAdmin } from "../../../lib/auth/role.ts";
import {
	getLiveBoard,
	listLiveBoards,
	mergeDebugBoards,
} from "../../../lib/debug-live.ts";
import { signDeviceHeaders, signedDeviceFetch } from "../../../lib/device-api.ts";
import {
	listAllDevices,
	loadDevices,
	requireAccessibleDevice,
} from "../../../lib/pairing-store.ts";
import {
	asString,
	type MobileContext,
	readJsonBody,
	runMobile,
} from "../../../lib/mobile-http.ts";

export async function onRequestGet(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const admin = isAdmin(identity.role);
		const paired = admin
			? await listAllDevices(ctx.env.DYNAMIC_PAGE_KV)
			: await loadDevices(ctx.env.DYNAMIC_PAGE_KV, identity.id);
		const live = await listLiveBoards(ctx.env.DYNAMIC_PAGE_KV);
		return { devices: mergeDebugBoards(paired, live, admin) };
	});
}

export async function onRequestPost(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const body = await readJsonBody(ctx.request);
		const uuid = asString(body.uuid).trim();
		if (!uuid) {
			throw new Error("uuid is required");
		}
		const deviceUrl = await resolveDebugDeviceUrl(
			ctx.env.DYNAMIC_PAGE_KV,
			identity,
			uuid,
		);
		const headers = await signDeviceHeaders(ctx.env, "GET", DEBUG_PATH);
		let probe = {
			status: 0,
			error: "companion unreachable",
			ready: false,
		};
		try {
			const response = await signedDeviceFetch(
				ctx.env,
				deviceUrl,
				"GET",
				DEBUG_PATH,
			);
			probe = parseDebugProbe(response.status, await response.text());
		} catch (caught) {
			probe = {
				status: 0,
				error: caught instanceof Error ? caught.message : "companion unreachable",
				ready: false,
			};
		}
		return { wsUrl: debugWsConnectUrl(deviceUrl, headers), probe };
	});
}

async function resolveDebugDeviceUrl(
	kv: MobileContext["env"]["DYNAMIC_PAGE_KV"],
	identity: { id: string; role: "user" | "admin" },
	uuid: string,
): Promise<string> {
	const live = await getLiveBoard(kv, uuid);
	try {
		const device = await requireAccessibleDevice(kv, identity, uuid);
		const deviceUrl = device.deviceUrl || live?.deviceUrl || "";
		if (!deviceUrl) {
			throw new Error("device URL is missing");
		}
		return deviceUrl;
	} catch (caught) {
		if (isAdmin(identity.role) && live) {
			return live.deviceUrl;
		}
		if (isAdmin(identity.role)) {
			throw new Error("device is not live");
		}
		throw caught;
	}
}
