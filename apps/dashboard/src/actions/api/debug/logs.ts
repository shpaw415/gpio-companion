import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { LOGS_PATH } from "gpio-companion";
import { wrapAction } from "../../../lib/action.ts";
import { isAdmin } from "../../../lib/auth/role.ts";
import { getLiveBoard } from "../../../lib/debug-live.ts";
import { signedDeviceFetch } from "../../../lib/device-api.ts";
import { requireAccessibleDevice } from "../../../lib/pairing-store.ts";
import { requireIdentity } from "../../../lib/session.ts";

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
	const deviceUrl = await resolveDebugDeviceUrl(
		ctx.env.DYNAMIC_PAGE_KV,
		identity,
		trimmed,
	);
	const response = await signedDeviceFetch(
		ctx.env,
		deviceUrl,
		"GET",
		LOGS_PATH,
	);
	if (!response.ok) {
		let detail = `device ${response.status}`;
		try {
			const errorBody = (await response.json()) as { error?: string };
			if (errorBody.error) {
				detail = errorBody.error;
			}
		} catch {
			// keep status
		}
		throw new Error(detail);
	}
	const body = (await response.json()) as { text?: unknown };
	return {
		text: typeof body.text === "string" ? body.text : "",
	};
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
