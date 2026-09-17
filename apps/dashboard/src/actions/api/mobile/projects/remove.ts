"no action";

import type { GithubAppEnv } from "../../../../lib/github-app.ts";
import {
	asString,
	type MobileContext,
	readJsonBody,
	runMobile,
} from "../../../../lib/mobile-http.ts";
import { deleteProjectForUser } from "../../../../lib/projects-push.ts";

function env(ctx: MobileContext): GithubAppEnv & {
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
} {
	return ctx.env as GithubAppEnv & {
		GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
		GPIO_COMPANION_DEVICE_KEY_ID?: string;
	};
}

export async function onRequestPost(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const body = await readJsonBody(ctx.request);
		const owner = asString(body.owner).trim();
		const name = asString(body.name).trim() || asString(body.repo).trim();
		if (!owner || !name) {
			throw new Error("owner and name are required");
		}
		return deleteProjectForUser(env(ctx), identity.id, owner, name);
	});
}
