"no action";

import { readDeviceJson, signedDeviceFetch } from "../../../lib/device-api.ts";
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

export async function onRequestGet(ctx: MobileContext) {
	try {
		const identity = await requireMobileIdentity(ctx);
		if (!identity.id) {
			throw new Error("sign in first");
		}
		const uuid = asString(new URL(ctx.request.url).searchParams.get("uuid"));
		const device = await requireAccessibleDevice(
			ctx.env.DYNAMIC_PAGE_KV,
			identity,
			uuid || undefined,
		);
		if (!device.deviceUrl) {
			throw new Error("device URL is missing");
		}
		return jsonOk(
			await readDeviceJson(
				await signedDeviceFetch(
					ctx.env,
					device.deviceUrl,
					"GET",
					"/v1/t3/status",
				),
			),
		);
	} catch (caught) {
		return jsonFail(
			caught instanceof Error ? caught.message : "request failed",
			errorStatus(caught),
		);
	}
}

export async function onRequestPost(ctx: MobileContext) {
	try {
		const identity = await requireMobileIdentity(ctx);
		if (!identity.id) {
			throw new Error("sign in first");
		}
		const body = await readJsonBody(ctx.request);
		const action = asString(body.action);
		const uuid = asString(body.uuid);
		const device = await requireAccessibleDevice(
			ctx.env.DYNAMIC_PAGE_KV,
			identity,
			uuid || undefined,
		);
		if (!device.deviceUrl) {
			throw new Error("device URL is missing");
		}
		if (action === "pair") {
			return jsonOk(
				await readDeviceJson(
					await signedDeviceFetch(
						ctx.env,
						device.deviceUrl,
						"POST",
						"/v1/t3/pair",
					),
				),
			);
		}
		throw new Error("unknown t3 action");
	} catch (caught) {
		return jsonFail(
			caught instanceof Error ? caught.message : "request failed",
			errorStatus(caught),
		);
	}
}
