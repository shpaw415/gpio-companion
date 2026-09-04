"no action";

import { LOGS_PATH } from "gpio-companion";
import { isAdmin } from "../../../lib/auth/role.ts";
import { getLiveBoard } from "../../../lib/debug-live.ts";
import { signedDeviceFetch } from "../../../lib/device-api.ts";
import {
	asString,
	type MobileContext,
	runMobile,
} from "../../../lib/mobile-http.ts";
import { requireAccessibleDevice } from "../../../lib/pairing-store.ts";

export async function onRequestGet(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const uuid = asString(
			new URL(ctx.request.url).searchParams.get("uuid"),
		).trim();
		if (!uuid) {
			throw new Error("uuid is required");
		}
		const deviceUrl = await resolveDebugDeviceUrl(
			ctx.env.DYNAMIC_PAGE_KV,
			identity,
			uuid,
		);
		const response = await signedDeviceFetch(
			ctx.env,
			deviceUrl,
			"GET",
			LOGS_PATH,
		);
		if (!response.ok) {
			let detail = `device ${response.status}`;
			try {
				const errorBody = (await response.json()) as { error?: string };
				if (errorBody.error) {
					detail = errorBody.error;
				}
			} catch {
				// keep status
			}
			throw new Error(detail);
		}
		const body = (await response.json()) as { text?: unknown };
		return {
			text: typeof body.text === "string" ? body.text : "",
		};
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
