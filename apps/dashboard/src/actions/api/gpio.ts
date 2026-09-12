import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import {
	GPIO_PATH,
	type GpioSnapshot,
	isGpioWsRefresh,
	parseGpioWsCommand,
} from "gpio-companion";
import { wrapAction } from "../../lib/action.ts";
import { resolveAccessibleDeviceUrl } from "../../lib/debug-live.ts";
import { readDeviceJson, signedDeviceFetch } from "../../lib/device-api.ts";
import { requireOwnedDevice } from "../../lib/pairing-store.ts";
import { requireIdentity } from "../../lib/session.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export const GET = wrapAction(async function GET(uuid: string) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const trimmed = uuid.trim();
	if (!trimmed) {
		throw new Error("uuid is required");
	}
	const deviceUrl = await resolveAccessibleDeviceUrl(
		ctx.env.DYNAMIC_PAGE_KV,
		identity,
		trimmed,
	);
	return readDeviceJson<GpioSnapshot>(
		await signedDeviceFetch(ctx.env, deviceUrl, "GET", GPIO_PATH),
	);
});

export const PUT = wrapAction(async function PUT(input: {
	uuid: string;
	physical: number;
	dir?: string;
	value?: number;
	analog?: number;
	op?: string;
	hz?: number;
}) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const uuid = input.uuid?.trim() ?? "";
	if (!uuid) {
		throw new Error("uuid is required");
	}
	const device = await requireOwnedDevice(
		ctx.env.DYNAMIC_PAGE_KV,
		identity.id,
		uuid,
	);
	if (!device.deviceUrl) {
		throw new Error("device URL is missing");
	}
	const command = parseGpioWsCommand(input);
	if (isGpioWsRefresh(command)) {
		throw new Error("refresh is websocket-only");
	}
	return readDeviceJson<GpioSnapshot>(
		await signedDeviceFetch(
			ctx.env,
			device.deviceUrl,
			"PUT",
			GPIO_PATH,
			command,
		),
	);
});
