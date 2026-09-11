import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { connectGpioLive, type GpioSnapshot } from "./api.ts";
import { asGpioSnapshot, startReconnectSocket } from "./hub.ts";

export function useGpioTunnel(
	uuid: string,
	token: string | null | undefined,
	onSnapshot: (snapshot: GpioSnapshot) => void,
): void {
	useEffect(() => {
		const trimmed = uuid.trim();
		if (!trimmed || !token) {
			return;
		}
		const authToken = token;
		let closed = false;
		let client: { stop(): void; pause(): void; resume(): void } | null = null;

		function start() {
			client?.stop();
			if (closed) {
				return;
			}
			client = startReconnectSocket({
				headers: { Origin: "https://gpio-companion.com" },
				open: async () => {
					const next = await connectGpioLive(authToken, trimmed);
					const wsUrl = next.wsUrl?.trim() ?? "";
					if (!wsUrl) {
						throw new Error("missing gpio websocket url");
					}
					return wsUrl;
				},
				onMessage(data) {
					try {
						const snapshot = asGpioSnapshot(JSON.parse(data));
						if (snapshot) {
							onSnapshot(snapshot);
						}
					} catch {
						undefined;
					}
				},
			});
		}

		function onAppState(state: AppStateStatus) {
			if (state === "active") {
				start();
				return;
			}
			client?.stop();
			client = null;
		}

		if (AppState.currentState === "active") {
			start();
		}
		const sub = AppState.addEventListener("change", onAppState);
		return () => {
			closed = true;
			sub.remove();
			client?.stop();
		};
	}, [uuid, token, onSnapshot]);
}
