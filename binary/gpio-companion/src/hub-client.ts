import {
	encodeHubMessage,
	type HardwareId,
	HUB_FLASH_MS,
	HUB_GPIO_MS,
	HUB_PATH,
	HUB_PING_MS,
	HUB_T3_MS,
	type HubTicket,
	hubOrigin,
} from "gpio-companion";
import type { FlashController } from "./flash.ts";
import type { GpioController } from "./gpio.ts";
import type { T3Controller } from "./t3.ts";

export type FetchLike = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

export type HubClientOptions = {
	uuid: string;
	key: string;
	hardware: HardwareId;
	gpio: GpioController;
	flash: FlashController;
	t3?: T3Controller;
	dashboardUrl?: string;
	fetchImpl?: FetchLike;
	webSocket?: typeof WebSocket;
	gpioMs?: number;
	flashMs?: number;
	t3Ms?: number;
	pingMs?: number;
};

export function hubCredentialsUrl(dashboardUrl?: string): string {
	return `${hubOrigin(dashboardUrl || process.env.GPIO_COMPANION_DASHBOARD_URL)}${HUB_PATH}`;
}

export async function fetchHubTicket(options: {
	uuid: string;
	key: string;
	dashboardUrl?: string;
	fetchImpl?: FetchLike;
}): Promise<HubTicket> {
	const uuid = options.uuid.trim();
	if (!uuid || !options.key) {
		throw new Error("pairing uuid and key are required");
	}
	const fetcher = options.fetchImpl ?? fetch;
	const response = await fetcher(hubCredentialsUrl(options.dashboardUrl), {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ uuid, key: options.key }),
	});
	if (!response.ok) {
		let detail = `hub credentials ${response.status}`;
		try {
			const body = (await response.json()) as { error?: string };
			if (body.error) {
				detail = body.error;
			}
		} catch {
			detail = `hub credentials ${response.status}`;
		}
		throw new Error(detail);
	}
	const body = (await response.json()) as Partial<HubTicket>;
	const token = body.token?.trim() ?? "";
	const wsUrl = body.wsUrl?.trim() ?? "";
	if (!token || !wsUrl) {
		throw new Error("hub credentials missing token");
	}
	return {
		token,
		wsUrl,
		expiresAt: body.expiresAt ?? "",
		exp: body.exp ?? 0,
	};
}

export function startHubClient(options: HubClientOptions): { stop(): void } {
	const uuid = options.uuid.trim();
	if (!uuid || !options.key) {
		return { stop() {} };
	}
	let stopped = false;
	let socket: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	const watchTimers: Array<ReturnType<typeof setInterval>> = [];
	let delay = 500;
	let lastGpio = "";
	let lastFlash = "";
	let lastT3 = "";
	const Socket = options.webSocket ?? WebSocket;

	function send(
		type: "gpio" | "flash" | "t3" | "ping" | "hello",
		payload?: unknown,
	) {
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			return;
		}
		socket.send(
			encodeHubMessage(
				payload === undefined ? { v: 1, type } : { v: 1, type, payload },
			),
		);
	}

	async function publishGpio() {
		try {
			const gpio = JSON.stringify(
				await options.gpio.snapshot(options.hardware),
			);
			if (gpio !== lastGpio) {
				lastGpio = gpio;
				send("gpio", JSON.parse(gpio));
			}
		} catch {
			undefined;
		}
	}

	function publishFlash() {
		try {
			const flash = JSON.stringify(options.flash.status());
			if (flash !== lastFlash) {
				lastFlash = flash;
				send("flash", JSON.parse(flash));
			}
		} catch {
			undefined;
		}
	}

	async function publishT3() {
		if (!options.t3) {
			return;
		}
		try {
			const t3 = JSON.stringify(await options.t3.status());
			if (t3 !== lastT3) {
				lastT3 = t3;
				send("t3", JSON.parse(t3));
			}
		} catch {
			undefined;
		}
	}

	function clearTimers() {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		for (const timer of watchTimers) {
			clearInterval(timer);
		}
		watchTimers.length = 0;
	}

	function scheduleReconnect() {
		if (stopped) {
			return;
		}
		clearTimers();
		reconnectTimer = setTimeout(() => {
			delay = Math.min(delay * 2, 10_000);
			void connect();
		}, delay);
	}

	async function connect() {
		if (stopped) {
			return;
		}
		try {
			const ticket = await fetchHubTicket({
				uuid,
				key: options.key,
				dashboardUrl: options.dashboardUrl,
				fetchImpl: options.fetchImpl,
			});
			if (stopped) {
				return;
			}
			socket = new Socket(ticket.wsUrl);
			socket.addEventListener("open", () => {
				delay = 500;
				lastGpio = "";
				lastFlash = "";
				lastT3 = "";
				send("hello");
				void publishGpio();
				publishFlash();
				void publishT3();
				watchTimers.push(
					setInterval(() => {
						void publishGpio();
					}, options.gpioMs ?? HUB_GPIO_MS),
					setInterval(publishFlash, options.flashMs ?? HUB_FLASH_MS),
					setInterval(() => {
						void publishT3();
					}, options.t3Ms ?? HUB_T3_MS),
					setInterval(() => {
						send("ping");
					}, options.pingMs ?? HUB_PING_MS),
				);
			});
			socket.addEventListener("close", () => {
				scheduleReconnect();
			});
			socket.addEventListener("error", () => {
				socket?.close();
			});
		} catch {
			scheduleReconnect();
		}
	}

	void connect();
	return {
		stop() {
			stopped = true;
			clearTimers();
			socket?.close();
			socket = null;
		},
	};
}
