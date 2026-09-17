"no action";

import {
	jsonFail,
	jsonOk,
	type MobileContext,
	requireMobileIdentity,
} from "../../../../lib/mobile-http.ts";

type Env = MobileContext["env"] & {
	VOICE_HUB?: DurableObjectNamespace;
};

export async function onRequestPost(ctx: MobileContext) {
	try {
		const identity = await requireMobileIdentity(ctx);
		if (!identity.id) {
			throw new Error("sign in first");
		}
		const env = ctx.env as Env;
		if (!env.VOICE_HUB) {
			return jsonFail("voice is not bound", 503);
		}
		const stub = env.VOICE_HUB.get(env.VOICE_HUB.idFromName("stt"));
		const forward = new Request("https://voice.local/?op=stt", {
			method: "POST",
			headers: ctx.request.headers,
			body: ctx.request.body,
		});
		const response = await stub.fetch(forward);
		const payload = (await response.json().catch(() => null)) as {
			text?: unknown;
			error?: unknown;
		} | null;
		if (!response.ok) {
			const error =
				typeof payload?.error === "string" ? payload.error : "stt failed";
			return jsonFail(error, response.status);
		}
		return jsonOk({
			text: typeof payload?.text === "string" ? payload.text : "",
		});
	} catch (caught) {
		const message = caught instanceof Error ? caught.message : "request failed";
		return jsonFail(message, message === "sign in first" ? 401 : 400);
	}
}
