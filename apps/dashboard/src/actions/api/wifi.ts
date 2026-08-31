import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { parseWifiConfig } from "gpio-companion";
import { wrapAction } from "../../lib/action.ts";
import { signDeviceEnvelope } from "../../lib/device-api.ts";
import { requireIdentity } from "../../lib/session.ts";

type PagesEnv = {
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export const POST = wrapAction(async function POST(input: {
	uuid: string;
	ssid: string;
	psk: string;
}) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	await requireIdentity(ctx);
	const wifi = parseWifiConfig(input);
	return signDeviceEnvelope(ctx.env, "PUT", "/v1/config/wifi", wifi);
});
