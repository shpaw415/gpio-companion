import { describe, expect, mock, test } from "bun:test";
import {
	captureCreditsOrder,
	createCreditsOrder,
	isPaypalConfigured,
	isPaypalLive,
	type PaypalEnv,
} from "./paypal.ts";

const paypalEnv: PaypalEnv = {
	PUBLIC_PAYPAL_CLIENT_ID: "client",
	PAYPAL_CLIENT_SECRET: "secret",
	PAYPAL_ENV: "sandbox",
};

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status });
}

function paypalFetchMock(
	handlers: Record<string, (init?: RequestInit) => Response>,
) {
	return mock(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		for (const [fragment, handler] of Object.entries(handlers)) {
			if (url.includes(fragment)) {
				return handler(init);
			}
		}
		throw new Error(`Unexpected PayPal URL: ${url}`);
	}) as unknown as typeof fetch;
}

describe("paypal credits", () => {
	test("sandbox env is not live", () => {
		expect(isPaypalLive({ PAYPAL_ENV: "sandbox" })).toBe(false);
		expect(isPaypalLive({ PAYPAL_ENV: "live" })).toBe(true);
		expect(isPaypalConfigured({})).toBe(false);
		expect(isPaypalConfigured(paypalEnv)).toBe(true);
	});

	test("creates a CAPTURE order for a pack", async () => {
		const fetchMock = paypalFetchMock({
			"/v1/oauth2/token": () => jsonResponse({ access_token: "tok" }),
			"/v2/checkout/orders": (init) => {
				expect(init?.method).toBe("POST");
				const body = JSON.parse(String(init?.body)) as {
					intent: string;
					purchase_units: Array<{
						amount: { currency_code: string; value: string };
						custom_id: string;
					}>;
				};
				expect(body.intent).toBe("CAPTURE");
				expect(body.purchase_units[0]?.amount.currency_code).toBe("USD");
				expect(body.purchase_units[0]?.amount.value).toBe("10.00");
				expect(body.purchase_units[0]?.custom_id).toBe("user-1");
				return jsonResponse({ id: "ORDER-10", status: "CREATED" });
			},
		});
		await expect(
			createCreditsOrder(paypalEnv, { usd: 10, userId: "user-1" }, fetchMock),
		).resolves.toEqual({ orderId: "ORDER-10" });
	});

	test("rejects amounts that are not packs", async () => {
		await expect(
			createCreditsOrder(paypalEnv, { usd: 1, userId: "user-1" }),
		).rejects.toThrow("amount must be a credit pack");
	});

	test("refuses capture before approval", async () => {
		const fetchMock = paypalFetchMock({
			"/v1/oauth2/token": () => jsonResponse({ access_token: "tok" }),
			"/v2/checkout/orders/ORDER-1": () =>
				jsonResponse({
					id: "ORDER-1",
					status: "CREATED",
					intent: "CAPTURE",
					purchase_units: [{ custom_id: "user-1", amount: { value: "10.00" } }],
				}),
		});
		await expect(
			captureCreditsOrder(paypalEnv, "ORDER-1", fetchMock),
		).rejects.toThrow("not approved yet");
	});

	test("captures an approved order", async () => {
		const fetchMock = paypalFetchMock({
			"/v1/oauth2/token": () => jsonResponse({ access_token: "tok" }),
			"/v2/checkout/orders/ORDER-1/capture": () =>
				jsonResponse({
					id: "ORDER-1",
					status: "COMPLETED",
					intent: "CAPTURE",
					purchase_units: [
						{
							custom_id: "user-1",
							amount: { value: "10.00" },
							payments: {
								captures: [
									{
										id: "CAP-1",
										status: "COMPLETED",
										amount: { value: "10.00" },
									},
								],
							},
						},
					],
				}),
			"/v2/checkout/orders/ORDER-1": () =>
				jsonResponse({
					id: "ORDER-1",
					status: "APPROVED",
					intent: "CAPTURE",
					purchase_units: [{ custom_id: "user-1", amount: { value: "10.00" } }],
				}),
		});
		await expect(
			captureCreditsOrder(paypalEnv, "ORDER-1", fetchMock),
		).resolves.toEqual({
			id: "ORDER-1",
			status: "COMPLETED",
			intent: "CAPTURE",
			customId: "user-1",
			usd: 10,
			captureId: "CAP-1",
			captured: true,
		});
	});

	test("treats an already captured order as success", async () => {
		const fetchMock = paypalFetchMock({
			"/v1/oauth2/token": () => jsonResponse({ access_token: "tok" }),
			"/v2/checkout/orders/ORDER-1": () =>
				jsonResponse({
					id: "ORDER-1",
					status: "COMPLETED",
					purchase_units: [
						{
							custom_id: "user-1",
							payments: {
								captures: [
									{
										id: "CAP-1",
										status: "COMPLETED",
										amount: { value: "25.00" },
									},
								],
							},
						},
					],
				}),
		});
		const order = await captureCreditsOrder(paypalEnv, "ORDER-1", fetchMock);
		expect(order.captured).toBe(true);
		expect(order.usd).toBe(25);
	});
});
