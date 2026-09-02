import { describe, expect, test } from "bun:test";
import { livePingUrl, pingDashboardLive } from "./live-ping.ts";

describe("live ping", () => {
	test("posts uuid to the dashboard live path", async () => {
		const calls: Array<{ url: string; body: string }> = [];
		const ok = await pingDashboardLive({
			uuid: "abc-def",
			dashboardUrl: "https://gpio-companion.com/",
			fetchImpl: async (url, init) => {
				calls.push({ url: String(url), body: String(init?.body ?? "") });
				return new Response(JSON.stringify({ ok: true }), { status: 200 });
			},
		});
		expect(ok).toBe(true);
		expect(calls).toEqual([
			{
				url: "https://gpio-companion.com/api/debug/live",
				body: JSON.stringify({ uuid: "abc-def" }),
			},
		]);
	});

	test("skips empty uuid", async () => {
		expect(await pingDashboardLive({ uuid: "  " })).toBe(false);
		expect(livePingUrl("https://preview.example/")).toBe(
			"https://preview.example/api/debug/live",
		);
	});
});
