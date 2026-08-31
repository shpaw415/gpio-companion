import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { wrapAction } from "../../../lib/action.ts";
import { readDeviceJson, signedDeviceFetch } from "../../../lib/device-api.ts";
import {
	listAllDevices,
	type PublicPairing,
	publicPairing,
} from "../../../lib/pairing-store.ts";
import { requireAdmin, requireIdentity } from "../../../lib/session.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export type AdminDeviceItem = {
	device: PublicPairing;
	status: Record<string, unknown> | null;
};

export const GET = wrapAction(async function GET() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	requireAdmin(await requireIdentity(ctx));
	const paired = await listAllDevices(ctx.env.DYNAMIC_PAGE_KV);
	const devices: AdminDeviceItem[] = await Promise.all(
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
