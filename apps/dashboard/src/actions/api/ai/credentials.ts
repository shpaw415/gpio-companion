"no action";

import { issueAiCredentials } from "../../../lib/ai-credentials.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
};

export async function onRequestPost(ctx: { env: PagesEnv; request: Request }) {
	let body: { uuid?: string; key?: string } = {};
	try {
		body = (await ctx.request.json()) as { uuid?: string; key?: string };
	} catch {
		return Response.json({ error: "invalid json" }, { status: 400 });
	}
	try {
		const creds = await issueAiCredentials(
			ctx.env,
			body.uuid ?? "",
			body.key ?? "",
		);
		return Response.json(creds);
	} catch (caught) {
		const message = caught instanceof Error ? caught.message : "request failed";
		const status =
			message === "unknown pairing" || message === "pairing key mismatch"
				? 403
				: 400;
		return Response.json({ error: message }, { status });
	}
}
