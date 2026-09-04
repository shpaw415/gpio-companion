import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { INFO_PATH } from "gpio-companion";
import { wrapAction } from "../../../lib/action.ts";
import { resolveAccessibleDeviceUrl } from "../../../lib/debug-live.ts";
import {
	signDeviceEnvelope,
	signedDeviceFetch,
} from "../../../lib/device-api.ts";
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
	const deviceUrl = await resolveAccessibleDeviceUrl(
		ctx.env.DYNAMIC_PAGE_KV,
		identity,
		trimmed,
	);
	const response = await signedDeviceFetch(
		ctx.env,
		deviceUrl,
		"GET",
		INFO_PATH,
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
	const body = (await response.json()) as unknown;
	return { info: body };
});

export const POST = wrapAction(async function POST(uuid: string) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const trimmed = uuid.trim();
	if (!trimmed) {
		throw new Error("uuid is required");
	}
	await requireAccessibleDevice(ctx.env.DYNAMIC_PAGE_KV, identity, trimmed);
	return signDeviceEnvelope(ctx.env, "GET", INFO_PATH);
});
