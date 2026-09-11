import { POST as signGpioLive } from "@api/gpio-live";
import { asGpioSnapshot, type GpioSnapshot } from "gpio-companion";
import { useEffect } from "react";
import { unwrapAction } from "../lib/action.ts";

export function useGpioTunnel(
	uuid: string,
	onSnapshot: (snapshot: GpioSnapshot) => void,
): void {
	useEffect(() => {
		const trimmed = uuid.trim();
		if (!trimmed || typeof window === "undefined") {
			return;
		}
		let closed = false;
		let socket: WebSocket | null = null;
		let timer = 0;
		let delay = 500;

		async function connect() {
			if (closed) {
				return;
			}
			try {
				const signed = unwrapAction(await signGpioLive(trimmed));
				if (closed) {
					return;
				}
				const wsUrl = signed.wsUrl.trim();
				if (!wsUrl) {
					throw new Error("missing gpio websocket url");
				}
				socket?.close();
				const next = new WebSocket(wsUrl);
				socket = next;
				next.addEventListener("open", () => {
					delay = 500;
				});
				next.addEventListener("message", (event) => {
					if (socket !== next) {
						return;
					}
					try {
						const snapshot = asGpioSnapshot(
							JSON.parse(String(event.data ?? "")),
						);
						if (snapshot) {
							onSnapshot(snapshot);
						}
					} catch {
						undefined;
					}
				});
				next.addEventListener("close", () => {
					if (socket === next) {
						socket = null;
					}
					schedule();
				});
			} catch {
				schedule();
			}
		}

		function schedule() {
			if (closed) {
				return;
			}
			window.clearTimeout(timer);
			timer = window.setTimeout(() => {
				delay = Math.min(delay * 2, 10_000);
				void connect();
			}, delay);
		}

		void connect();
		return () => {
			closed = true;
			window.clearTimeout(timer);
			socket?.close();
		};
	}, [uuid, onSnapshot]);
}
