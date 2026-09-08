"no action";

import { issueDashboardHubTicket } from "../../../lib/hub-credentials.ts";
import {
	asString,
	type MobileContext,
	readJsonBody,
	runMobile,
} from "../../../lib/mobile-http.ts";

export async function onRequestPost(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const body = await readJsonBody(ctx.request);
		const uuid = asString(body.uuid).trim();
		if (!uuid) {
			throw new Error("uuid is required");
		}
		return issueDashboardHubTicket(
			ctx.env,
			identity,
			uuid,
			new URL(ctx.request.url).origin,
		);
	});
}
