import { describe, expect, it } from "bun:test";
import { DEVICE_GATEWAY_ERROR, readDeviceJson } from "./device-api.ts";

describe("readDeviceJson", () => {
	it("uses JSON error bodies", async () => {
		await expect(
			readDeviceJson(
				new Response(JSON.stringify({ error: "t3 pair failed" }), {
					status: 400,
				}),
			),
		).rejects.toThrow("t3 pair failed");
	});

	it("maps Cloudflare gateway HTML to a board timeout", async () => {
		await expect(
			readDeviceJson(new Response("<html>Bad Gateway</html>", { status: 502 })),
		).rejects.toThrow(DEVICE_GATEWAY_ERROR);
	});
});
