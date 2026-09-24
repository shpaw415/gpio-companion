type PayPalEnv = {
	PUBLIC_PAYPAL_CLIENT_ID?: string;
	PAYPAL_CLIENT_SECRET?: string;
	PAYPAL_ENV?: string;
};

export type PayPalOrder = {
	id: string;
	status: string;
	purchase_units?: Array<{
		amount?: { currency_code?: string; value?: string };
		payments?: {
			captures?: Array<{
				id?: string;
				status?: string;
				amount?: { currency_code?: string; value?: string };
			}>;
		};
	}>;
};

function asPayPalEnv(env: object): PayPalEnv {
	return env as PayPalEnv;
}

export function paypalConfigured(env: object): boolean {
	const paypal = asPayPalEnv(env);
	return Boolean(paypal.PUBLIC_PAYPAL_CLIENT_ID && paypal.PAYPAL_CLIENT_SECRET);
}

export function paypalClientId(env: object): string | null {
	return asPayPalEnv(env).PUBLIC_PAYPAL_CLIENT_ID ?? null;
}

function paypalBase(env: PayPalEnv): string {
	return asPayPalEnv(env).PAYPAL_ENV === "live"
		? "https://api-m.paypal.com"
		: "https://api-m.sandbox.paypal.com";
}

async function paypalToken(env: PayPalEnv): Promise<string> {
	if (!paypalConfigured(env)) throw new Error("PayPal is not configured");
	const credentials = btoa(
		`${env.PUBLIC_PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`,
	);
	const response = await fetch(`${paypalBase(env)}/v1/oauth2/token`, {
		method: "POST",
		headers: {
			authorization: `Basic ${credentials}`,
			"content-type": "application/x-www-form-urlencoded",
		},
		body: "grant_type=client_credentials",
	});
	if (!response.ok) throw new Error("PayPal authentication failed");
	const body = (await response.json()) as { access_token?: string };
	if (!body.access_token) throw new Error("PayPal authentication failed");
	return body.access_token;
}

function centsToValue(cents: number): string {
	return (cents / 100).toFixed(2);
}

export async function createPayPalOrder(
	env: object,
	input: {
		orderId: string;
		orderNumber: string;
		totalCents: number;
		requestId: string;
		shipping: {
			name: string;
			line1: string;
			line2?: string | null;
			city: string;
			region?: string | null;
			postalCode: string;
			country: string;
		};
	},
): Promise<PayPalOrder> {
	const token = await paypalToken(asPayPalEnv(env));
	const response = await fetch(`${paypalBase(env)}/v2/checkout/orders`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
			"paypal-request-id": input.requestId,
		},
		body: JSON.stringify({
			intent: "CAPTURE",
			purchase_units: [
				{
					custom_id: input.orderId,
					invoice_id: input.orderNumber,
					amount: {
						currency_code: "USD",
						value: centsToValue(input.totalCents),
					},
					shipping: {
						name: { full_name: input.shipping.name },
						address: {
							address_line_1: input.shipping.line1,
							address_line_2: input.shipping.line2 || undefined,
							admin_area_2: input.shipping.city,
							admin_area_1: input.shipping.region || undefined,
							postal_code: input.shipping.postalCode,
							country_code: input.shipping.country,
						},
					},
				},
			],
		}),
	});
	if (!response.ok) throw new Error("PayPal order creation failed");
	return (await response.json()) as PayPalOrder;
}

export async function capturePayPalOrder(
	env: object,
	paypalOrderId: string,
	requestId: string,
): Promise<PayPalOrder> {
	const token = await paypalToken(asPayPalEnv(env));
	const response = await fetch(
		`${paypalBase(env)}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
		{
			method: "POST",
			headers: {
				authorization: `Bearer ${token}`,
				"content-type": "application/json",
				"paypal-request-id": requestId,
			},
		},
	);
	if (!response.ok) throw new Error("PayPal capture failed");
	return (await response.json()) as PayPalOrder;
}

export function captureMatches(
	order: PayPalOrder,
	expectedCents: number,
): { captureId: string } | null {
	const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
	if (!capture?.id || capture.status !== "COMPLETED") return null;
	if (capture.amount?.currency_code !== "USD") return null;
	if (capture.amount.value !== centsToValue(expectedCents)) return null;
	if (order.status !== "COMPLETED") return null;
	return { captureId: capture.id };
}
