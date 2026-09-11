import { useEffect } from "react";
import { connectGpioLive, type GpioSnapshot } from "../api";
import { asGpioSnapshot, startReconnectSocket } from "../hub";

export function useGpioTunnel(
	uuid: string,
	onSnapshot: (snapshot: GpioSnapshot) => void,
): void {
	useEffect(() => {
		const trimmed = uuid.trim();
		if (!trimmed) {
			return;
		}
		const client = startReconnectSocket({
			open: async () => {
				const next = await connectGpioLive(trimmed);
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
		return () => {
			client.stop();
		};
	}, [uuid, onSnapshot]);
}
