"no action";

import { putMaintenance } from "../../../lib/debug-maintenance.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
};

export async function onRequestPost(ctx: { env: PagesEnv; request: Request }) {
	let body: unknown = null;
	try {
		body = await ctx.request.json();
	} catch {
		return Response.json({ error: "invalid json" }, { status: 400 });
	}
	try {
		const report = await putMaintenance(ctx.env.DYNAMIC_PAGE_KV, body);
		return Response.json({ ok: true, uuid: report.uuid });
	} catch (caught) {
		const message = caught instanceof Error ? caught.message : "request failed";
		return Response.json({ error: message }, { status: 400 });
	}
}
