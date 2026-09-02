import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { DEBUG_TICKET_PATH, debugWsUrl } from "gpio-companion";
import { wrapAction } from "../../lib/action.ts";
import { isAdmin } from "../../lib/auth/role.ts";
import { readDeviceJson, signedDeviceFetch } from "../../lib/device-api.ts";
import {
	listAllDevices,
	loadDevices,
	publicPairing,
	requireAccessibleDevice,
} from "../../lib/pairing-store.ts";
import { requireIdentity } from "../../lib/session.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export type DebugTicketResponse = {
	wsUrl: string;
	ticket: string;
	expiresAt: number;
};

export const GET = wrapAction(async function GET() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const devices = isAdmin(identity.role)
		? await listAllDevices(ctx.env.DYNAMIC_PAGE_KV)
		: await loadDevices(ctx.env.DYNAMIC_PAGE_KV, identity.id);
	return { devices: devices.map(publicPairing) };
});

export const POST = wrapAction(async function POST(uuid: string) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const device = await requireAccessibleDevice(
		ctx.env.DYNAMIC_PAGE_KV,
		identity,
		uuid,
	);
	if (!device.deviceUrl) {
		throw new Error("device URL is missing");
	}
	const minted = await readDeviceJson<{ ticket: string; expiresAt: number }>(
		await signedDeviceFetch(
			ctx.env,
			device.deviceUrl,
			"POST",
			DEBUG_TICKET_PATH,
		),
	);
	return {
		wsUrl: debugWsUrl(device.deviceUrl),
		ticket: minted.ticket,
		expiresAt: minted.expiresAt,
	} satisfies DebugTicketResponse;
});
