import {
	createSignedEnvelope,
	DEFAULT_DEVICE_KEY_ID,
	type DeviceAuthHeaders,
	type SignedDeviceEnvelope,
	signDeviceRequest,
} from "gpio-companion";

export type DeviceSigningEnv = {
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export async function signDeviceEnvelope(
	env: DeviceSigningEnv,
	method: string,
	path: string,
	body?: unknown,
): Promise<SignedDeviceEnvelope> {
	const privateKeyPem = env.GPIO_COMPANION_DEVICE_PRIVATE_KEY ?? "";
	if (!privateKeyPem.trim()) {
		throw new Error("GPIO_COMPANION_DEVICE_PRIVATE_KEY is not set");
	}
	const bodyText = body === undefined ? "" : JSON.stringify(body);
	return createSignedEnvelope({
		privateKeyPem,
		keyId: env.GPIO_COMPANION_DEVICE_KEY_ID ?? DEFAULT_DEVICE_KEY_ID,
		method,
		path,
		body: bodyText,
	});
}

export async function signDeviceHeaders(
	env: DeviceSigningEnv,
	method: string,
	path: string,
	body?: unknown,
): Promise<DeviceAuthHeaders> {
	const privateKeyPem = env.GPIO_COMPANION_DEVICE_PRIVATE_KEY ?? "";
	if (!privateKeyPem.trim()) {
		throw new Error("GPIO_COMPANION_DEVICE_PRIVATE_KEY is not set");
	}
	const bodyText = body === undefined ? "" : JSON.stringify(body);
	return signDeviceRequest({
		privateKeyPem,
		keyId: env.GPIO_COMPANION_DEVICE_KEY_ID ?? DEFAULT_DEVICE_KEY_ID,
		method,
		path,
		body: bodyText,
	});
}

export async function signedDeviceFetch(
	env: DeviceSigningEnv,
	deviceUrl: string,
	method: string,
	path: string,
	body?: unknown,
): Promise<Response> {
	const origin = deviceUrl.replace(/\/+$/, "");
	const bodyText = body === undefined ? "" : JSON.stringify(body);
	const headers = await signDeviceHeaders(env, method, path, body);
	return fetch(`${origin}${path}`, {
		method,
		headers: {
			"content-type": "application/json",
			...headers,
		},
		body: bodyText || undefined,
	});
}

export async function readDeviceJson<T>(response: Response): Promise<T> {
	if (!response.ok) {
		let detail = `device ${response.status}`;
		try {
			const errorBody = (await response.json()) as { error?: string };
			if (errorBody.error) {
				detail = errorBody.error;
			}
		} catch {
			// keep status text
		}
		throw new Error(detail);
	}
	return (await response.json()) as T;
}

export type T3PairingResult = {
	pairingUrl: string;
	pairingToken: string;
};

export async function signedT3Pair(
	env: DeviceSigningEnv,
	deviceUrl: string,
): Promise<T3PairingResult> {
	const pair = await signedDeviceFetch(env, deviceUrl, "POST", "/v1/t3/pair");
	if (pair.status !== 404) {
		return readDeviceJson<T3PairingResult>(pair);
	}
	const start = await signedDeviceFetch(env, deviceUrl, "POST", "/v1/t3/start");
	if (start.status === 404) {
		throw new Error(
			"T3 pairing is not available on this board yet. Wait for the companion update, then try again.",
		);
	}
	return readDeviceJson<T3PairingResult>(start);
}
