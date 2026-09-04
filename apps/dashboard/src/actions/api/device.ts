import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { wrapAction } from "../../lib/action.ts";
import { readDeviceJson, signedDeviceFetch } from "../../lib/device-api.ts";
import { saveGithubAccount } from "../../lib/github.ts";
import {
	loadDevices,
	requireOwnedDevice,
	type StoredPairing,
} from "../../lib/pairing-store.ts";
import { requireIdentity } from "../../lib/session.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export type DeviceSecretsPatch = {
	uuid?: string;
	githubUsername?: string;
	githubToken?: string;
};

export type DeviceStatusItem = {
	device: StoredPairing;
	status: Record<string, unknown> | null;
};

export async function listDevicesWithStatus(
	env: PagesEnv,
	userId: string,
): Promise<{ paired: boolean; devices: DeviceStatusItem[] }> {
	const paired = await loadDevices(env.DYNAMIC_PAGE_KV, userId);
	const devices: DeviceStatusItem[] = [];
	for (const device of paired) {
		let status: Record<string, unknown> | null = null;
		if (device.deviceUrl) {
			try {
				status = await readDeviceJson<Record<string, unknown>>(
					await signedDeviceFetch(env, device.deviceUrl, "GET", "/v1/status"),
				);
			} catch {
				status = null;
			}
		}
		devices.push({ device, status });
	}
	return { paired: devices.length > 0, devices };
}

export const GET = wrapAction(async function GET() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	return listDevicesWithStatus(ctx.env, identity.id);
});

export const PUT = wrapAction(async function PUT(patch: DeviceSecretsPatch) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const device = await requireOwnedDevice(
		ctx.env.DYNAMIC_PAGE_KV,
		identity.id,
		patch.uuid,
	);
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
