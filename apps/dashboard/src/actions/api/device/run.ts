import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import {
	parseRunPut,
	RUN_PATH,
	RUN_SKETCHES_PATH,
	RUN_STOP_PATH,
} from "gpio-companion";
import { wrapAction } from "../../../lib/action.ts";
import { signDeviceEnvelope } from "../../../lib/device-api.ts";
import {
	requireAccessibleDevice,
	requireOwnedDevice,
} from "../../../lib/pairing-store.ts";
import { requireIdentity } from "../../../lib/session.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export const POST = wrapAction(async function POST(input: {
	uuid: string;
	dir?: string;
	stop?: boolean;
	sketches?: boolean;
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
	if (input.stop) {
		await requireOwnedDevice(ctx.env.DYNAMIC_PAGE_KV, identity.id, uuid);
		return signDeviceEnvelope(ctx.env, "POST", RUN_STOP_PATH, {});
	}
	if (input.dir) {
		await requireOwnedDevice(ctx.env.DYNAMIC_PAGE_KV, identity.id, uuid);
		return signDeviceEnvelope(ctx.env, "POST", RUN_PATH, parseRunPut(input));
	}
	await requireAccessibleDevice(ctx.env.DYNAMIC_PAGE_KV, identity, uuid);
	if (input.sketches) {
		return signDeviceEnvelope(ctx.env, "GET", RUN_SKETCHES_PATH);
	}
	return signDeviceEnvelope(ctx.env, "GET", RUN_PATH);
});
