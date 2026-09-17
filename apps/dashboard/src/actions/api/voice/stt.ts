"no action";

import { requireIdentity } from "../../../lib/session.ts";

type PagesEnv = {
	VOICE_HUB: DurableObjectNamespace;
};

type VoiceContext = {
	env: PagesEnv;
	request: Request;
};

export async function onRequestPost(ctx: VoiceContext) {
	try {
		const identity = await requireIdentity(ctx);
		if (!identity.id) {
			throw new Error("sign in first");
		}
		if (!ctx.env.VOICE_HUB) {
			return Response.json({ error: "voice is not bound" }, { status: 503 });
		}
		const stub = ctx.env.VOICE_HUB.get(ctx.env.VOICE_HUB.idFromName("stt"));
		const forward = new Request("https://voice.local/?op=stt", {
			method: "POST",
			headers: ctx.request.headers,
			body: ctx.request.body,
		});
		return stub.fetch(forward);
	} catch (caught) {
		const message = caught instanceof Error ? caught.message : "request failed";
		const status = message === "sign in first" ? 401 : 400;
		return Response.json({ error: message }, { status });
	}
}
