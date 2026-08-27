import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";

export async function GET() {
	const ctx = getContext<Env, never, never>(arguments);
	console.log("Hello from Server at", ctx.request.url);
	return "Hello from Server";
}
