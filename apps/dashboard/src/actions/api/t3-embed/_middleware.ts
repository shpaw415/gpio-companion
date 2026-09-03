import { proxyT3Embed } from "../../../lib/t3-embed-proxy.ts";

export async function onRequest(ctx: { request: Request }) {
	return proxyT3Embed(ctx.request);
}
