import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import {
	CONSOLE_USB_PATH,
	CONSOLE_USB_STOP_PATH,
	parseConsoleUsbPut,
} from "gpio-companion";
import { wrapAction } from "../../lib/action.ts";
import { readDeviceJson, signedDeviceFetch } from "../../lib/device-api.ts";
import { requireOwnedDevice } from "../../lib/pairing-store.ts";
import { requireIdentity } from "../../lib/session.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export const POST = wrapAction(async function POST(input: {
	uuid: string;
	port?: string;
	baud?: number;
	stop?: boolean;
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
	if (input.stop) {
		return readDeviceJson<{ stopped: boolean }>(
			await signedDeviceFetch(
				ctx.env,
				device.deviceUrl,
				"POST",
				CONSOLE_USB_STOP_PATH,
				{},
			),
		);
	}
	const put = parseConsoleUsbPut(input);
	return readDeviceJson<{ started: boolean }>(
		await signedDeviceFetch(
			ctx.env,
			device.deviceUrl,
			"POST",
			CONSOLE_USB_PATH,
			put,
		),
	);
});
