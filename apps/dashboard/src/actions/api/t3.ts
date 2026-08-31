import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { wrapAction } from "../../lib/action.ts";
import { readDeviceJson, signedDeviceFetch } from "../../lib/device-api.ts";
import { requireIdentity } from "../../lib/session.ts";
import { parseStoredPairing, type StoredPairing } from "./pair.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export type T3Action = "start" | "persist";

async function loadPairing(
	env: PagesEnv,
	userId: string,
): Promise<StoredPairing> {
	const raw = await env.DYNAMIC_PAGE_KV.get(`device:${userId}`);
	if (!raw) {
		throw new Error("pair a device first");
	}
	const device = parseStoredPairing(raw);
	if (!device.deviceUrl) {
		throw new Error("device URL is missing");
	}
	return device;
}

export const GET = wrapAction(async function GET() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const device = await loadPairing(ctx.env, identity.id);
	return readDeviceJson<{
		running: boolean;
		pairingUrl: string;
		paired: boolean;
		serviceInstalled: boolean;
	}>(
		await signedDeviceFetch(ctx.env, device.deviceUrl, "GET", "/v1/t3/status"),
	);
});

export const POST = wrapAction(async function POST(action: T3Action) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const device = await loadPairing(ctx.env, identity.id);
	if (action === "start") {
		return readDeviceJson<{ pairingUrl: string }>(
			await signedDeviceFetch(
				ctx.env,
				device.deviceUrl,
				"POST",
				"/v1/t3/start",
			),
		);
	}
	if (action === "persist") {
		return readDeviceJson<{
			running: boolean;
			pairingUrl: string;
			paired: boolean;
			serviceInstalled: boolean;
		}>(
			await signedDeviceFetch(
				ctx.env,
				device.deviceUrl,
				"POST",
				"/v1/t3/service-install",
			),
		);
	}
	throw new Error("unknown t3 action");
});
