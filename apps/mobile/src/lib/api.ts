import { dashboardUrl } from "./config.ts";

export type ActionResult<T> =
	| { ok: true; data: T }
	| { ok: false; error: string };

async function request<T>(
	token: string,
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const response = await fetch(`${dashboardUrl}${path}`, {
		...init,
		headers: {
			accept: "application/json",
			"content-type": "application/json",
			authorization: `Bearer ${token}`,
			...init.headers,
		},
	});
	const body = (await response.json()) as ActionResult<T>;
	if (!body.ok) {
		throw new Error(body.error);
	}
	return body.data;
}

export function getSession(token: string) {
	return request<{
		id: string | null;
		email: string | null;
		name: string | null;
	}>(token, "/api/mobile/session");
}

export function listDevices(token: string) {
	return request<{
		paired: boolean;
		devices: Array<{ uuid: string; deviceUrl: string; login: string }>;
	}>(token, "/api/mobile/devices");
}

export function unpairDevice(token: string, uuid: string) {
	return request(
		token,
		`/api/mobile/devices?uuid=${encodeURIComponent(uuid)}`,
		{
			method: "DELETE",
		},
	);
}

export function signCredentials(token: string) {
	return request<Record<string, unknown>>(token, "/api/mobile/pair", {
		method: "PUT",
	});
}

export function claimDevice(
	token: string,
	input: { uuid: string; key: string; deviceUrl?: string },
) {
	return request(token, "/api/mobile/pair", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function signWifi(
	token: string,
	input: { uuid: string; ssid: string; psk: string },
) {
	return request<Record<string, unknown>>(token, "/api/mobile/wifi", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function t3Status(token: string, uuid: string) {
	return request(token, `/api/mobile/t3?uuid=${encodeURIComponent(uuid)}`);
}

export function t3Action(
	token: string,
	action: "start" | "persist",
	uuid: string,
) {
	return request(token, "/api/mobile/t3", {
		method: "POST",
		body: JSON.stringify({ action, uuid }),
	});
}
