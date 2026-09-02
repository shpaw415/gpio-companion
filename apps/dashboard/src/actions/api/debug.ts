import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { DEBUG_PATH, debugWsConnectUrl, parseDebugProbe } from "gpio-companion";
import { wrapAction } from "../../lib/action.ts";
import { isAdmin } from "../../lib/auth/role.ts";
import {
	type DebugBoard,
	getLiveBoard,
	listLiveBoards,
	mergeDebugBoards,
} from "../../lib/debug-live.ts";
import { signDeviceHeaders, signedDeviceFetch } from "../../lib/device-api.ts";
import {
	listAllDevices,
	loadDevices,
	requireAccessibleDevice,
} from "../../lib/pairing-store.ts";
import { requireIdentity } from "../../lib/session.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export type DebugConnectResponse = {
	wsUrl: string;
	probe: {
		status: number;
		error: string;
		ready: boolean;
	};
};

export const GET = wrapAction(async function GET() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const admin = isAdmin(identity.role);
	const paired = admin
		? await listAllDevices(ctx.env.DYNAMIC_PAGE_KV)
		: await loadDevices(ctx.env.DYNAMIC_PAGE_KV, identity.id);
	const live = await listLiveBoards(ctx.env.DYNAMIC_PAGE_KV);
	return { devices: mergeDebugBoards(paired, live, admin) };
});

export const POST = wrapAction(async function POST(uuid: string) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const deviceUrl = await resolveDebugDeviceUrl(
		ctx.env.DYNAMIC_PAGE_KV,
		identity,
		uuid,
	);
	const headers = await signDeviceHeaders(ctx.env, "GET", DEBUG_PATH);
	let probe = {
		status: 0,
		error: "companion unreachable",
		ready: false,
	};
	try {
		const response = await signedDeviceFetch(
			ctx.env,
			deviceUrl,
			"GET",
			DEBUG_PATH,
		);
		probe = parseDebugProbe(response.status, await response.text());
	} catch (caught) {
		probe = {
			status: 0,
			error: caught instanceof Error ? caught.message : "companion unreachable",
			ready: false,
		};
	}
	return {
		wsUrl: debugWsConnectUrl(deviceUrl, headers),
		probe,
	} satisfies DebugConnectResponse;
});

async function resolveDebugDeviceUrl(
	kv: PagesEnv["DYNAMIC_PAGE_KV"],
	identity: { id: string; role: "user" | "admin" },
	uuid: string,
): Promise<string> {
	const live = await getLiveBoard(kv, uuid);
	try {
		const device = await requireAccessibleDevice(kv, identity, uuid);
		const deviceUrl = device.deviceUrl || live?.deviceUrl || "";
		if (!deviceUrl) {
			throw new Error("device URL is missing");
		}
		return deviceUrl;
	} catch (caught) {
		if (isAdmin(identity.role) && live) {
			return live.deviceUrl;
		}
		if (isAdmin(identity.role)) {
			throw new Error("device is not live");
		}
		throw caught;
	}
}

export type { DebugBoard };
