import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import {
	PROJECTS_PUSH_PATH,
	type ProjectPushResult,
	parseProjectPushPut,
} from "gpio-companion";
import { wrapAction } from "../../../lib/action.ts";
import { readDeviceJson, signedDeviceFetch } from "../../../lib/device-api.ts";
import {
	githubAccountForUser,
	githubConfigured,
	loadProjectBundle,
} from "../../../lib/github.ts";
import type { GithubAppEnv } from "../../../lib/github-app.ts";
import { requireOwnedDevice } from "../../../lib/pairing-store.ts";
import { requireIdentity } from "../../../lib/session.ts";

type PagesEnv = GithubAppEnv & {
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export const POST = wrapAction(async function POST(input: {
	uuid: string;
	owner: string;
	name: string;
	message?: string;
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
	const device = await requireOwnedDevice(
		ctx.env.DYNAMIC_PAGE_KV,
		identity.id,
		uuid,
	);
	if (!device.deviceUrl) {
		throw new Error("device URL is missing");
	}
	const put = parseProjectPushPut(input);
	const board = await readDeviceJson<ProjectPushResult>(
		await signedDeviceFetch(
			ctx.env,
			device.deviceUrl,
			"POST",
			PROJECTS_PUSH_PATH,
			put,
		),
	);
	const account = await githubAccountForUser(ctx.env, identity.id);
	if (!githubConfigured(account)) {
		throw new Error("github is not configured");
	}
	return {
		board,
		bundle: await loadProjectBundle(account, put.owner, put.name),
	};
});
