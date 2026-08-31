import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { wrapAction } from "../../lib/action.ts";
import { readDeviceJson, signedDeviceFetch } from "../../lib/device-api.ts";
import { saveGithubAccount } from "../../lib/github.ts";
import { requireIdentity } from "../../lib/session.ts";
import {
	parseStoredPairing,
	registerDeviceAiKey,
	type StoredPairing,
} from "./pair.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export type DeviceSecretsPatch = {
	githubUsername?: string;
	githubToken?: string;
};

async function loadPairing(
	env: PagesEnv,
	userId: string,
): Promise<StoredPairing | null> {
	const raw = await env.DYNAMIC_PAGE_KV.get(`device:${userId}`);
	if (!raw) {
		return null;
	}
	return parseStoredPairing(raw);
}

export const GET = wrapAction(async function GET() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const device = await loadPairing(ctx.env, identity.id);
	if (!device) {
		return { paired: false as const };
	}
	await registerDeviceAiKey(ctx.env, device.deviceUrl, identity.id);
	const status = await readDeviceJson<Record<string, unknown>>(
		await signedDeviceFetch(ctx.env, device.deviceUrl, "GET", "/v1/status"),
	);
	return { paired: true as const, device, status };
});

export const PUT = wrapAction(async function PUT(patch: DeviceSecretsPatch) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const device = await loadPairing(ctx.env, identity.id);
	if (!device) {
		throw new Error("pair a device first");
	}
	if (patch.githubUsername || patch.githubToken) {
		const username = patch.githubUsername?.trim() ?? "";
		const token = patch.githubToken?.trim() ?? "";
		if (!username || !token) {
			throw new Error("githubUsername and githubToken are required");
		}
		await saveGithubAccount(ctx.env.DYNAMIC_PAGE_KV, identity.id, {
			username,
			token,
		});
		await readDeviceJson(
			await signedDeviceFetch(
				ctx.env,
				device.deviceUrl,
				"PUT",
				"/v1/config/github",
				{
					githubUsername: username,
					githubToken: token,
				},
			),
		);
	}
	return { ok: true as const };
});
