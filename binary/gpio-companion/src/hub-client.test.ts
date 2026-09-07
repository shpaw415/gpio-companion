import { describe, expect, test } from "bun:test";
import { HUB_PATH } from "gpio-companion";
import { fetchHubTicket, hubCredentialsUrl } from "./hub-client.ts";

describe("hub client", () => {
	test("posts uuid and key to the dashboard hub path", async () => {
		const calls: Array<{ url: string; body: string }> = [];
		const ticket = await fetchHubTicket({
			uuid: "abc-def",
			key: "pair-key",
			dashboardUrl: "https://gpio-companion.com/",
			fetchImpl: async (url, init) => {
				calls.push({ url: String(url), body: String(init?.body ?? "") });
				return new Response(
					JSON.stringify({
						token: "gpiohub.v1.tok",
						wsUrl: "wss://gpio-companion.com/api/hub?uuid=abc-def",
						expiresAt: "2099-01-01T00:00:00.000Z",
						exp: 1,
					}),
					{ status: 200 },
				);
			},
		});
		expect(ticket.token).toBe("gpiohub.v1.tok");
		expect(calls).toEqual([
			{
				url: `https://gpio-companion.com${HUB_PATH}`,
				body: JSON.stringify({ uuid: "abc-def", key: "pair-key" }),
			},
		]);
	});

	test("rejects empty pairing and builds the credentials url", async () => {
		await expect(fetchHubTicket({ uuid: "  ", key: "x" })).rejects.toThrow(
			"pairing uuid and key are required",
		);
		expect(hubCredentialsUrl("https://preview.example/")).toBe(
			`https://preview.example${HUB_PATH}`,
		);
	});
});
