"no action";

import {
	errorStatus,
	jsonFail,
	jsonOk,
	type MobileContext,
	requireMobileIdentity,
} from "../../../lib/mobile-http.ts";

export async function onRequestGet(ctx: MobileContext) {
	try {
		const identity = await requireMobileIdentity(ctx);
		return jsonOk({
			id: identity.id,
			email: identity.email,
			name: identity.name,
			role: identity.role,
		});
	} catch (caught) {
		return jsonFail(
			caught instanceof Error ? caught.message : "request failed",
			errorStatus(caught),
		);
	}
}
