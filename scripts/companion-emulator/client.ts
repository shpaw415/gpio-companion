import {
	CONSOLE_PATH,
	CONSOLE_USB_PATH,
	CONSOLE_USB_STOP_PATH,
	DEBUG_PATH,
	type DeviceKeyPair,
	debugWsConnectUrl,
	FLASH_PATH,
	FLASH_PORTS_PATH,
	FLASH_PROXY_PATH,
	GPIO_PATH,
	gpioWsConnectUrl,
	RUN_PATH,
	RUN_STOP_PATH,
	signDeviceRequest,
	VERIFY_PATH,
	VERIFY_STOP_PATH,
} from "../../packages/core/src/index.ts";

export type CompanionClient = {
	url: string;
	keys: DeviceKeyPair;
};

export async function deviceFetch(
	client: CompanionClient,
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const method = (init.method ?? "GET").toUpperCase();
	const body = typeof init.body === "string" ? init.body : "";
	const auth = await signDeviceRequest({
		privateKeyPem: client.keys.privateKeyPem,
		keyId: client.keys.keyId,
		method,
		path: path.startsWith("/") ? path : `/${path}`,
		body,
	});
	return fetch(`${client.url}${path.replace(/^\//, "")}`, {
		...init,
		headers: {
			"content-type": "application/json",
			...auth,
			...(init.headers ?? {}),
		},
	});
}

export async function deviceJson(
	client: CompanionClient,
	path: string,
	init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
	const response = await deviceFetch(client, path, init);
	let body: unknown = null;
	try {
		body = await response.json();
	} catch {
		body = await response.text();
	}
	return { status: response.status, body };
}

export async function openSignedWs(
	client: CompanionClient,
	kind: "gpio" | "debug" | "console",
): Promise<WebSocket> {
	const headers = await signDeviceRequest({
		privateKeyPem: client.keys.privateKeyPem,
		keyId: client.keys.keyId,
		method: "GET",
		path:
			kind === "gpio"
				? GPIO_PATH
				: kind === "debug"
					? DEBUG_PATH
					: CONSOLE_PATH,
		body: "",
	});
	const connect =
		kind === "gpio"
			? gpioWsConnectUrl(client.url, headers)
			: kind === "debug"
				? debugWsConnectUrl(client.url, headers)
				: `${client.url.replace(/\/+$/, "").replace(/^http/, "ws")}${CONSOLE_PATH}?${new URLSearchParams(
						{
							"x-gpio-key-id": headers["X-Gpio-Key-Id"],
							"x-gpio-timestamp": headers["X-Gpio-Timestamp"],
							"x-gpio-nonce": headers["X-Gpio-Nonce"],
							"x-gpio-signature": headers["X-Gpio-Signature"],
						},
					).toString()}`;
	const ws = new WebSocket(connect);
	await waitOpen(ws);
	return ws;
}

export async function waitOpen(
	ws: WebSocket,
	timeoutMs = 5_000,
): Promise<void> {
	if (ws.readyState === WebSocket.OPEN) {
		return;
	}
	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error("websocket open timed out"));
		}, timeoutMs);
		ws.addEventListener("open", () => {
			clearTimeout(timer);
			resolve();
		});
		ws.addEventListener("error", () => {
			clearTimeout(timer);
			reject(new Error("websocket error"));
		});
	});
}

export async function closeWs(ws: WebSocket): Promise<void> {
	if (ws.readyState === WebSocket.CLOSED) {
		return;
	}
	await new Promise<void>((resolve) => {
		ws.addEventListener("close", () => resolve());
		ws.close();
		setTimeout(resolve, 1_000);
	});
}

export const paths = {
	gpio: GPIO_PATH,
	run: RUN_PATH,
	runStop: RUN_STOP_PATH,
	flash: FLASH_PATH,
	flashPorts: FLASH_PORTS_PATH,
	flashProxy: FLASH_PROXY_PATH,
	consoleUsb: CONSOLE_USB_PATH,
	consoleUsbStop: CONSOLE_USB_STOP_PATH,
	console: CONSOLE_PATH,
	debug: DEBUG_PATH,
	verify: VERIFY_PATH,
	verifyStop: VERIFY_STOP_PATH,
};
