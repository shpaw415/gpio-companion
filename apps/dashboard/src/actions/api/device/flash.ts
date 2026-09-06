import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { FLASH_PATH, FLASH_PORTS_PATH, parseFlashPut } from "gpio-companion";
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
	fqbn?: string;
	dir?: string;
	port?: string;
	ports?: boolean;
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
	if (input.fqbn) {
		await requireOwnedDevice(ctx.env.DYNAMIC_PAGE_KV, identity.id, uuid);
		return signDeviceEnvelope(
			ctx.env,
			"POST",
			FLASH_PATH,
			parseFlashPut(input),
		);
	}
	await requireAccessibleDevice(ctx.env.DYNAMIC_PAGE_KV, identity, uuid);
	if (input.ports) {
		return signDeviceEnvelope(ctx.env, "GET", FLASH_PORTS_PATH);
	}
	return signDeviceEnvelope(ctx.env, "GET", FLASH_PATH);
});
