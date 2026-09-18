"use dynamic";

import { DELETE as revalidate } from "@api/revalidate";
import { usePath } from "@next/hooks/path";
import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";

// Per-page cache configuration — cache each user page for 60 seconds.
// Remove or adjust ssr_configs to change TTL behaviour.
export const ssr_configs = createPageConfig({
	callback(_ctx) {
		return { ttl: 60 };
	},
});

// Server-side loader — reads the dynamic route parameter ":id" from the URL.
// The callback runs only on the server; it is never shipped to the browser.
export const loader_user = createLoader({
	name: "user",
	async callback(ctx) {
		// In a real app you would query a database or external API here.
		// ctx.env gives access to all Cloudflare bindings (KV, D1, R2, …).

		await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate some latency

		return {
			id: ctx.params.id,
			name: `User #${ctx.params.id}`,
			fetchedAt: new Date().toISOString(),
		};
	},
});

export default function UserPage() {
	const user = useLoader(loader_user);
	const path = usePath();

	if (!user) return null;

	return (
		<main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
			<h1>User — {user.name}</h1>
			<p>
				<strong>ID:</strong> {user.id}
			</p>
			<p>
				<strong>Server render time:</strong> {user.fetchedAt}
			</p>
			<p style={{ color: "#666", fontSize: "0.875rem" }}>
				This page was rendered server-side by{" "}
				<code>frame-master-plugin-cloudflare-pages-dynamic-ssr</code> and cached
				in Cloudflare KV for 60 seconds. On client-side navigation only the
				loader props are re-fetched — the full HTML is not re-rendered.
			</p>
			<button
				type="button"
				onClick={() => revalidate(path)}
				className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold text-sm transition-all shadow-lg shadow-blue-500/25"
			>
				Revalidate cache for this page
			</button>
			<p className="mt-4 text-sm text-gray-600">
				Clicking the button above will call a Server Action that revalidates the
				cache for this page, causing the next request to trigger a full
				server-side re-render and update the cached HTML and loader data.
			</p>
			<a
				href={path}
				className="mt-4 inline-block text-blue-600 hover:underline text-sm transition-all border border-blue-500/20 px-3 py-1 rounded-full bg-blue-500/10"
			>
				Reload
			</a>
			<p className="mt-2 text-sm text-gray-600">
				You can also manually reload the page to see the cache in action. If you
				reload within 60 seconds, you'll see the same server render time. After
				60 seconds, a new server render will occur, and you'll see an updated
				server render time.
			</p>
		</main>
	);
}
