"no action";

import {
	asString,
	type MobileContext,
	readJsonBody,
	runMobile,
} from "../../../../lib/mobile-http.ts";
import { issueVoiceTicket } from "../../../../lib/voice-credentials.ts";

export async function onRequestPost(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		if (!identity.id) {
			throw new Error("sign in first");
		}
		const body = await readJsonBody(ctx.request);
		const uuid = asString(body.uuid).trim();
		if (!uuid) {
			throw new Error("uuid is required");
		}
		return issueVoiceTicket(
			ctx.env,
			identity.id,
			uuid,
			new URL(ctx.request.url).origin,
		);
	});
}
