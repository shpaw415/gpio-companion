import {
	asFlashStatus,
	asGpioSnapshot,
	asHubT3Status,
	type FlashStatus,
	type GpioSnapshot,
	HUB_PATH,
	type HubT3Status,
	parseHubMessage,
} from "gpio-companion";
import { useEffect } from "react";

export type DeviceHubHandlers = {
	onGpio?: (snapshot: GpioSnapshot) => void;
	onFlash?: (status: FlashStatus) => void;
	onT3?: (status: HubT3Status) => void;
};

export function hubBrowserUrl(uuid: string, location: Location): string {
	const protocol = location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${location.host}${HUB_PATH}?uuid=${encodeURIComponent(uuid.trim())}`;
}

export function useDeviceHub(uuid: string, handlers: DeviceHubHandlers): void {
	const onGpio = handlers.onGpio;
	const onFlash = handlers.onFlash;
	const onT3 = handlers.onT3;

	useEffect(() => {
		const trimmed = uuid.trim();
		if (!trimmed || typeof window === "undefined") {
			return;
		}
		let closed = false;
		let socket: WebSocket | null = null;
		let timer = 0;
		let delay = 500;

		function connect() {
			if (closed) {
				return;
			}
			socket = new WebSocket(hubBrowserUrl(trimmed, window.location));
			socket.addEventListener("open", () => {
				delay = 500;
			});
			socket.addEventListener("message", (event) => {
				const message = parseHubMessage(String(event.data ?? ""));
				if (!message) {
					return;
				}
				if (message.type === "gpio") {
					const snapshot = asGpioSnapshot(message.payload);
					if (snapshot) {
						onGpio?.(snapshot);
					}
					return;
				}
				if (message.type === "flash") {
					const status = asFlashStatus(message.payload);
					if (status) {
						onFlash?.(status);
					}
					return;
				}
				if (message.type === "t3") {
					const status = asHubT3Status(message.payload);
					if (status) {
						onT3?.(status);
					}
				}
			});
			socket.addEventListener("close", () => {
				if (closed) {
					return;
				}
				timer = window.setTimeout(() => {
					delay = Math.min(delay * 2, 10_000);
					connect();
				}, delay);
			});
		}

		connect();
		return () => {
			closed = true;
			window.clearTimeout(timer);
			socket?.close();
		};
	}, [uuid, onGpio, onFlash, onT3]);
}
