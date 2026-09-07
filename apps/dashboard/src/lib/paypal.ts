import {
	isCreditPackUsd,
	paypalValueToUsd,
	usdToPaypalValue,
} from "./credit-packs.ts";

export type PaypalEnv = {
	PUBLIC_PAYPAL_CLIENT_ID?: string;
	PAYPAL_CLIENT_ID?: string;
	PAYPAL_CLIENT_SECRET?: string;
	PAYPAL_ENV?: string;
};

type FetchLike = typeof fetch;

type PaypalTokenResponse = {
	access_token?: string;
	error?: string;
	error_description?: string;
};

type PaypalAmount = {
	currency_code?: string;
	value?: string;
};

type PaypalCapture = {
	id?: string;
	status?: string;
	amount?: PaypalAmount;
};

type PaypalOrderResponse = {
	id?: string;
	status?: string;
	intent?: string;
	purchase_units?: Array<{
		custom_id?: string;
		amount?: PaypalAmount;
		payments?: {
			captures?: PaypalCapture[];
		};
	}>;
	message?: string;
	details?: Array<{ description?: string; issue?: string }>;
	error_description?: string;
};

export type PaypalOrder = {
	id: string;
	status: string;
	intent?: string;
	customId?: string;
	usd: number | null;
	captureId?: string;
	captured: boolean;
};

export function paypalSecret(env: PaypalEnv) {
	return env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || "";
}

export function paypalClientId(env: PaypalEnv) {
	return (
		env.PUBLIC_PAYPAL_CLIENT_ID ||
		env.PAYPAL_CLIENT_ID ||
		process.env.PUBLIC_PAYPAL_CLIENT_ID ||
		process.env.PAYPAL_CLIENT_ID ||
		""
	);
}

export function isPaypalConfigured(env: PaypalEnv) {
	return Boolean(paypalClientId(env) && paypalSecret(env));
}

export function isPaypalLive(env: PaypalEnv) {
	if (env.PAYPAL_ENV === "sandbox") {
		return false;
	}
	if (env.PAYPAL_ENV === "live") {
		return true;
	}
	return process.env.NODE_ENV === "production";
}

function paypalApiBase(env: PaypalEnv) {
	return isPaypalLive(env)
		? "https://api-m.paypal.com"
		: "https://api-m.sandbox.paypal.com";
}

function paypalErrorMessage(payload: PaypalOrderResponse, fallback: string) {
	return (
		payload.details?.[0]?.description ||
		payload.message ||
		payload.error_description ||
		fallback
	);
}

function parsePaypalOrder(payload: PaypalOrderResponse): PaypalOrder {
	const unit = payload.purchase_units?.[0];
	const capture = unit?.payments?.captures?.[0];
	const captured =
		capture?.status === "COMPLETED" || payload.status === "COMPLETED";
	return {
		id: payload.id ?? "",
		status: payload.status ?? "",
		intent: payload.intent,
		customId: unit?.custom_id,
		usd: paypalValueToUsd(capture?.amount?.value ?? unit?.amount?.value),
		captureId: capture?.id,
		captured,
	};
}

async function getPaypalAccessToken(env: PaypalEnv, fetchImpl: FetchLike) {
	const clientId = paypalClientId(env);
	const secret = paypalSecret(env);
	if (!clientId || !secret) {
		throw new Error("PayPal is not configured.");
	}
	const response = await fetchImpl(`${paypalApiBase(env)}/v1/oauth2/token`, {
		method: "POST",
		headers: {
			Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "grant_type=client_credentials",
	});
	const payload = (await response.json()) as PaypalTokenResponse;
	if (!response.ok || !payload.access_token) {
		throw new Error(
			payload.error_description ?? "PayPal authentication failed.",
		);
	}
	return payload.access_token;
}

async function paypalRequest(
	env: PaypalEnv,
	path: string,
	init: RequestInit,
	fetchImpl: FetchLike,
) {
	const token = await getPaypalAccessToken(env, fetchImpl);
	return fetchImpl(`${paypalApiBase(env)}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			...(init.headers ?? {}),
		},
	});
}

export async function createCreditsOrder(
	env: PaypalEnv,
	input: { usd: number; userId: string },
	fetchImpl: FetchLike = fetch,
): Promise<{ orderId: string }> {
	if (!isCreditPackUsd(input.usd)) {
		throw new Error("amount must be a credit pack");
	}
	if (!isPaypalConfigured(env)) {
		throw new Error("PayPal is not configured.");
	}
	const response = await paypalRequest(
		env,
		"/v2/checkout/orders",
		{
			method: "POST",
			body: JSON.stringify({
				intent: "CAPTURE",
				purchase_units: [
					{
						amount: {
							currency_code: "USD",
							value: usdToPaypalValue(input.usd),
						},
						description: `gpio-companion AI credits $${usdToPaypalValue(input.usd)}`,
						custom_id: input.userId.slice(0, 127),
					},
				],
				application_context: {
					brand_name: "gpio-companion",
					shipping_preference: "NO_SHIPPING",
					user_action: "PAY_NOW",
				},
			}),
		},
		fetchImpl,
	);
	const payload = (await response.json()) as PaypalOrderResponse;
	if (!response.ok || !payload.id) {
		throw new Error(
			paypalErrorMessage(payload, "Could not create PayPal order."),
		);
	}
	return { orderId: payload.id };
}

export async function readPaypalOrder(
	env: PaypalEnv,
	orderId: string,
	fetchImpl: FetchLike = fetch,
): Promise<PaypalOrder> {
	const trimmed = orderId.trim();
	if (!trimmed) {
		throw new Error("PayPal order is missing.");
	}
	const response = await paypalRequest(
		env,
		`/v2/checkout/orders/${trimmed}`,
		{ method: "GET" },
		fetchImpl,
	);
	const payload = (await response.json()) as PaypalOrderResponse;
	if (!response.ok || !payload.id) {
		throw new Error(
			paypalErrorMessage(payload, "Could not read PayPal order."),
		);
	}
	return parsePaypalOrder(payload);
}

export async function captureCreditsOrder(
	env: PaypalEnv,
	orderId: string,
	fetchImpl: FetchLike = fetch,
): Promise<PaypalOrder> {
	const existing = await readPaypalOrder(env, orderId, fetchImpl);
	if (existing.captured) {
		return existing;
	}
	if (existing.status !== "APPROVED") {
		throw new Error(
			"PayPal payment is not approved yet. Finish the PayPal window.",
		);
	}
	const response = await paypalRequest(
		env,
		`/v2/checkout/orders/${existing.id}/capture`,
		{ method: "POST", body: "{}" },
		fetchImpl,
	);
	const payload = (await response.json()) as PaypalOrderResponse;
	if (!response.ok || !payload.id) {
		throw new Error(
			paypalErrorMessage(payload, "Could not capture PayPal payment."),
		);
	}
	return parsePaypalOrder(payload);
}
