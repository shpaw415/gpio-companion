"no action";

import { INFO_PATH } from "gpio-companion";
import { resolveAccessibleDeviceUrl } from "../../../lib/debug-live.ts";
import {
	signDeviceEnvelope,
	signedDeviceFetch,
} from "../../../lib/device-api.ts";
import {
	asString,
	type MobileContext,
	readJsonBody,
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
		const deviceUrl = await resolveAccessibleDeviceUrl(
			ctx.env.DYNAMIC_PAGE_KV,
			identity,
			uuid,
		);
		const response = await signedDeviceFetch(
			ctx.env,
			deviceUrl,
			"GET",
			INFO_PATH,
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
		const body = (await response.json()) as unknown;
		return { info: body };
	});
}

export async function onRequestPost(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const uuid = asString((await readJsonBody(ctx.request)).uuid).trim();
		if (!uuid) {
			throw new Error("uuid is required");
		}
		await requireAccessibleDevice(ctx.env.DYNAMIC_PAGE_KV, identity, uuid);
		return signDeviceEnvelope(ctx.env, "GET", INFO_PATH);
	});
}
