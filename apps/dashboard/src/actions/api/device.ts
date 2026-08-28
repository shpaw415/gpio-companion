import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { readDeviceJson, signedDeviceFetch } from "../../lib/device-api.ts";
import { requireIdentity } from "../../lib/session.ts";
import type { StoredPairing } from "./pair.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export type DeviceSecretsPatch = {
	opencodeApiKey?: string;
	giteaUrl?: string;
	giteaUsername?: string;
	giteaToken?: string;
};

async function loadPairing(
	env: PagesEnv,
	userId: string,
): Promise<StoredPairing | null> {
	const raw = await env.DYNAMIC_PAGE_KV.get(`device:${userId}`);
	if (!raw) {
		return null;
	}
	return JSON.parse(raw) as StoredPairing;
}

export async function GET() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const device = await loadPairing(ctx.env, identity.id);
	if (!device) {
		return { paired: false as const };
	}
	const status = await readDeviceJson<Record<string, unknown>>(
		await signedDeviceFetch(ctx.env, device.deviceUrl, "GET", "/v1/status"),
	);
	return { paired: true as const, device, status };
}

export async function PUT(patch: DeviceSecretsPatch) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const device = await loadPairing(ctx.env, identity.id);
	if (!device) {
		throw new Error("pair a device first");
	}
	if (patch.opencodeApiKey) {
		await readDeviceJson(
			await signedDeviceFetch(
				ctx.env,
				device.deviceUrl,
				"PUT",
				"/v1/config/secrets",
				{ opencodeApiKey: patch.opencodeApiKey },
			),
		);
	}
	if (patch.giteaUrl || patch.giteaUsername || patch.giteaToken) {
		await readDeviceJson(
			await signedDeviceFetch(
				ctx.env,
				device.deviceUrl,
				"PUT",
				"/v1/config/gitea",
				{
					giteaUrl: patch.giteaUrl ?? "",
					giteaUsername: patch.giteaUsername ?? "",
					giteaToken: patch.giteaToken ?? "",
				},
			),
		);
	}
	return { ok: true as const };
}
