"no action";

import {
	PROJECTS_PUSH_PATH,
	type ProjectPushResult,
	parseProjectPushPut,
} from "gpio-companion";
import {
	readDeviceJson,
	signedDeviceFetch,
} from "../../../../lib/device-api.ts";
import {
	githubAccountForUser,
	githubConfigured,
	loadProjectBundle,
} from "../../../../lib/github.ts";
import type { GithubAppEnv } from "../../../../lib/github-app.ts";
import {
	asString,
	type MobileContext,
	readJsonBody,
	runMobile,
} from "../../../../lib/mobile-http.ts";
import { requireOwnedDevice } from "../../../../lib/pairing-store.ts";

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
		const uuid = asString(body.uuid).trim();
		if (!uuid) {
			throw new Error("uuid is required");
		}
		const device = await requireOwnedDevice(
			ctx.env.DYNAMIC_PAGE_KV,
			identity.id,
			uuid,
		);
		if (!device.deviceUrl) {
			throw new Error("device URL is missing");
		}
		const put = parseProjectPushPut(body);
		const board = await readDeviceJson<ProjectPushResult>(
			await signedDeviceFetch(
				env(ctx),
				device.deviceUrl,
				"POST",
				PROJECTS_PUSH_PATH,
				put,
			),
		);
		const account = await githubAccountForUser(env(ctx), identity.id);
		if (!githubConfigured(account)) {
			throw new Error("github is not configured");
		}
		return {
			board,
			bundle: await loadProjectBundle(account, put.owner, put.name),
		};
	});
}
