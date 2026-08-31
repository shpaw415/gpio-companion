import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { parseWifiConfig } from "gpio-companion";
import { wrapAction } from "../../lib/action.ts";
import { signDeviceEnvelope } from "../../lib/device-api.ts";
import { requireOwnedDevice } from "../../lib/pairing-store.ts";
import { requireIdentity } from "../../lib/session.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export const POST = wrapAction(async function POST(input: {
	uuid: string;
	ssid: string;
	psk: string;
}) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	const wifi = parseWifiConfig(input);
	await requireOwnedDevice(ctx.env.DYNAMIC_PAGE_KV, identity.id, wifi.uuid);
	return signDeviceEnvelope(ctx.env, "PUT", "/v1/config/wifi", wifi);
});
