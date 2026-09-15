import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { parseVerifyPut, VERIFY_PATH, VERIFY_STOP_PATH } from "gpio-companion";
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
	repo?: string;
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
	if (input.stop) {
		await requireOwnedDevice(ctx.env.DYNAMIC_PAGE_KV, identity.id, uuid);
		return signDeviceEnvelope(ctx.env, "POST", VERIFY_STOP_PATH, {});
	}
	if (input.repo) {
		await requireOwnedDevice(ctx.env.DYNAMIC_PAGE_KV, identity.id, uuid);
		return signDeviceEnvelope(
			ctx.env,
			"POST",
			VERIFY_PATH,
			parseVerifyPut(input),
		);
	}
	await requireAccessibleDevice(ctx.env.DYNAMIC_PAGE_KV, identity, uuid);
	return signDeviceEnvelope(ctx.env, "GET", VERIFY_PATH);
});
