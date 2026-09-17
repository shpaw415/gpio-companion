"no action";

import { VOICE_PATH } from "gpio-companion";
import { requireOwnedDevice } from "../../../lib/pairing-store.ts";
import { requireIdentity } from "../../../lib/session.ts";
import { verifyVoiceAccessTicket } from "../../../lib/voice-credentials.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	VOICE_HUB: DurableObjectNamespace;
};

type VoiceContext = {
	env: PagesEnv;
	request: Request;
};

export async function onRequest(ctx: VoiceContext) {
	if (ctx.request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
		return upgradeVoice(ctx);
	}
	return Response.json({ error: "expected websocket" }, { status: 426 });
}

async function upgradeVoice(ctx: VoiceContext) {
	const url = new URL(ctx.request.url);
	const uuid = url.searchParams.get("uuid")?.trim() ?? "";
	const ticket = url.searchParams.get("ticket")?.trim() ?? "";
	if (!uuid) {
		return Response.json({ error: "uuid is required" }, { status: 400 });
	}
	if (!ctx.env.VOICE_HUB) {
		return Response.json({ error: "voice is not bound" }, { status: 503 });
	}
	try {
		if (ticket) {
			const claims = await verifyVoiceAccessTicket(ctx.env, ticket, uuid);
			const device = await requireOwnedDevice(
				ctx.env.DYNAMIC_PAGE_KV,
				claims.userId,
				uuid,
			);
			return forwardVoice(ctx, claims.userId, device.uuid, device.deviceUrl);
		}
		const identity = await requireIdentity(ctx);
		if (!identity.id) {
			throw new Error("sign in first");
		}
		const device = await requireOwnedDevice(
			ctx.env.DYNAMIC_PAGE_KV,
			identity.id,
			uuid,
		);
		return forwardVoice(ctx, identity.id, device.uuid, device.deviceUrl);
	} catch (caught) {
		const message = caught instanceof Error ? caught.message : "request failed";
		const status =
			message === "sign in first" || message.includes("invalid voice token")
				? 401
				: message === "device is not paired with this account" ||
						message === "pair a device first"
					? 403
					: 400;
		return Response.json({ error: message }, { status });
	}
}

function forwardVoice(
	ctx: VoiceContext,
	userId: string,
	uuid: string,
	deviceUrl: string,
) {
	const id = ctx.env.VOICE_HUB.idFromName(`voice:${userId}:${uuid}`);
	const stub = ctx.env.VOICE_HUB.get(id);
	const forward = new URL(ctx.request.url);
	forward.pathname = VOICE_PATH;
	forward.search = "";
	forward.searchParams.set("uuid", uuid);
	forward.searchParams.set("userId", userId);
	forward.searchParams.set("deviceUrl", deviceUrl);
	return stub.fetch(new Request(forward, ctx.request));
}
