import {
	parseT3EmbedPath,
	rewriteT3EmbedUrl,
	T3_EMBED_PREFIX,
	t3AppUrl,
} from "./t3-url.ts";

export const STRIP_RESPONSE_HEADERS = [
	"x-frame-options",
	"content-security-policy",
	"content-security-policy-report-only",
	"cross-origin-opener-policy",
	"cross-origin-embedder-policy",
	"cross-origin-resource-policy",
];

const STRIP_REQUEST_HEADERS = [
	"accept-encoding",
	"cf-connecting-ip",
	"cf-ipcountry",
	"cf-ray",
	"cf-visitor",
	"connection",
	"cookie",
	"host",
	"keep-alive",
	"te",
	"trailer",
	"transfer-encoding",
	"x-forwarded-for",
	"x-forwarded-host",
	"x-forwarded-proto",
	"x-real-ip",
];

const HTML_ATTRS = [
	"href",
	"src",
	"action",
	"poster",
	"data-href",
	"formaction",
] as const;

export function embedPrefixFor(uuid: string): string {
	return `${T3_EMBED_PREFIX}/${encodeURIComponent(uuid)}`;
}

export function filterUpstreamRequestHeaders(
	source: Headers,
	t3Origin: string,
): Headers {
	const headers = new Headers();
	const websocket = source.get("upgrade")?.toLowerCase() === "websocket";
	source.forEach((value, key) => {
		const name = key.toLowerCase();
		if (
			STRIP_REQUEST_HEADERS.includes(name) &&
			!(websocket && (name === "connection" || name === "upgrade"))
		) {
			return;
		}
		headers.set(key, value);
	});
	headers.set("host", new URL(t3Origin).host);
	headers.set("origin", t3Origin);
	headers.set("referer", `${t3Origin}/`);
	return headers;
}

export function filterDownstreamHeaders(
	source: Headers,
	t3Origin: string,
	embedOrigin: string,
	embedPrefix: string,
): Headers {
	const headers = new Headers();
	source.forEach((value, key) => {
		const name = key.toLowerCase();
		if (STRIP_RESPONSE_HEADERS.includes(name)) {
			return;
		}
		if (name === "location") {
			headers.set(
				key,
				rewriteT3EmbedUrl(value, t3Origin, embedOrigin, embedPrefix),
			);
			return;
		}
		if (name === "set-cookie") {
			headers.append(
				key,
				value
					.replace(/;\s*domain=[^;]*/i, "")
					.replace(/;\s*path=[^;]*/i, `; Path=${embedPrefix}/`),
			);
			return;
		}
		headers.set(key, value);
	});
	headers.set("content-security-policy", "frame-ancestors 'self'");
	headers.set("x-frame-options", "SAMEORIGIN");
	return headers;
}

function rewriteHtml(
	body: ReadableStream<Uint8Array>,
	t3Origin: string,
	embedOrigin: string,
	embedPrefix: string,
): ReadableStream<Uint8Array> {
	const rewriter = new HTMLRewriter();
	rewriter.on("head", {
		element(el) {
			el.prepend(`<base href="${embedOrigin}${embedPrefix}/">`, { html: true });
		},
	});
	for (const attr of HTML_ATTRS) {
		rewriter.on(`[${attr}]`, {
			element(el) {
				const current = el.getAttribute(attr);
				if (!current) {
					return;
				}
				el.setAttribute(
					attr,
					rewriteT3EmbedUrl(current, t3Origin, embedOrigin, embedPrefix),
				);
			},
		});
	}
	return rewriter.transform(new Response(body))
		.body as ReadableStream<Uint8Array>;
}

function isHtml(headers: Headers): boolean {
	return (headers.get("content-type") ?? "")
		.toLowerCase()
		.includes("text/html");
}

function isRewritableScript(headers: Headers): boolean {
	const type = (headers.get("content-type") ?? "").toLowerCase();
	return (
		type.includes("javascript") ||
		type.includes("ecmascript") ||
		type.includes("application/json")
	);
}

export async function proxyT3Embed(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const parsed = parseT3EmbedPath(url.pathname);
	if (!parsed) {
		return Response.json({ error: "not found" }, { status: 404 });
	}
	const t3Origin = t3AppUrl(parsed.uuid);
	if (!t3Origin) {
		return Response.json({ error: "uuid is required" }, { status: 400 });
	}
	const embedPrefix = embedPrefixFor(parsed.uuid);
	const target = new URL(`${t3Origin}${parsed.rest}`);
	target.search = url.search;
	const method = request.method.toUpperCase();
	const hasBody = method !== "GET" && method !== "HEAD";
	const upstream = await fetch(target, {
		method,
		headers: filterUpstreamRequestHeaders(request.headers, t3Origin),
		body: hasBody ? request.body : undefined,
		redirect: "manual",
	});
	const headers = filterDownstreamHeaders(
		upstream.headers,
		t3Origin,
		url.origin,
		embedPrefix,
	);
	if (upstream.status === 101) {
		return upstream;
	}
	if (!upstream.body) {
		return new Response(null, { status: upstream.status, headers });
	}
	if (isHtml(upstream.headers)) {
		headers.delete("content-length");
		headers.delete("content-encoding");
		return new Response(
			rewriteHtml(upstream.body, t3Origin, url.origin, embedPrefix),
			{ status: upstream.status, headers },
		);
	}
	if (isRewritableScript(upstream.headers)) {
		headers.delete("content-length");
		headers.delete("content-encoding");
		const text = await upstream.text();
		const origin = t3Origin.replace(/\/+$/, "");
		const rewritten = text.split(origin).join(`${url.origin}${embedPrefix}`);
		return new Response(rewritten, { status: upstream.status, headers });
	}
	return new Response(upstream.body, { status: upstream.status, headers });
}
