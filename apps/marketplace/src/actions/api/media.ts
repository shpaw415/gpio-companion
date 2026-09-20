"no action";

function isSafeKey(key: string): boolean {
	return (
		key.startsWith("products/") &&
		!key.includes("..") &&
		!key.includes("\\") &&
		key.length <= 256
	);
}

export async function onRequestGet(
	ctx: EventContext<Env, never, never>,
): Promise<Response> {
	const key = new URL(ctx.request.url).searchParams.get("key") ?? "";
	if (!isSafeKey(key)) {
		return new Response("Not found", { status: 404 });
	}
	const object = await ctx.env.MARKETPLACE_MEDIA.get(key);
	if (!object) {
		return new Response("Not found", { status: 404 });
	}
	return new Response(object.body, {
		headers: {
			"content-type":
				object.httpMetadata?.contentType ?? "application/octet-stream",
			etag: object.etag,
			"cache-control": "public, max-age=31536000, immutable",
		},
	});
}
