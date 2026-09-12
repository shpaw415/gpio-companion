import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { connectGpioLive, type GpioSnapshot } from "./api.ts";
import { asGpioSnapshot, startReconnectSocket } from "./hub.ts";

export type GpioPut = {
	physical: number;
	dir?: "in" | "out" | "pwm";
	value?: 0 | 1;
	analog?: number;
	op?: "refresh" | "tone" | "notone";
	hz?: number;
};

export type GpioTunnel = {
	drive: (put: GpioPut) => boolean;
	refresh: () => boolean;
};

function asGpioWsError(payload: unknown): string | null {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		return null;
	}
	const record = payload as {
		error?: unknown;
		hardware?: unknown;
		pins?: unknown;
	};
	if (
		Array.isArray(record.pins) ||
		record.hardware === "raspberrypi" ||
		record.hardware === "orangepi"
	) {
		return null;
	}
	return typeof record.error === "string" && record.error.trim()
		? record.error
		: null;
}

export function useGpioTunnel(
	uuid: string,
	token: string | null | undefined,
	onSnapshot: (snapshot: GpioSnapshot) => void,
	onError?: (message: string) => void,
): GpioTunnel {
	const clientRef = useRef<ReturnType<typeof startReconnectSocket> | null>(
		null,
	);
	const onSnapshotRef = useRef(onSnapshot);
	const onErrorRef = useRef(onError);
	onSnapshotRef.current = onSnapshot;
	onErrorRef.current = onError;

	useEffect(() => {
		const trimmed = uuid.trim();
		if (!trimmed || !token) {
			return;
		}
		const authToken = token;
		let closed = false;
		let client: ReturnType<typeof startReconnectSocket> | null = null;

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
						const parsed = JSON.parse(data);
						const error = asGpioWsError(parsed);
						if (error) {
							onErrorRef.current?.(error);
							return;
						}
						const snapshot = asGpioSnapshot(parsed);
						if (snapshot) {
							onSnapshotRef.current(snapshot);
						}
					} catch {
						undefined;
					}
				},
			});
			clientRef.current = client;
		}

		function onAppState(state: AppStateStatus) {
			if (state === "active") {
				start();
				return;
			}
			client?.stop();
			client = null;
			clientRef.current = null;
		}

		if (AppState.currentState === "active") {
			start();
		}
		const sub = AppState.addEventListener("change", onAppState);
		return () => {
			closed = true;
			sub.remove();
			client?.stop();
			clientRef.current = null;
		};
	}, [uuid, token]);

	const send = useCallback((payload: unknown) => {
		return clientRef.current?.send(JSON.stringify(payload)) ?? false;
	}, []);

	return {
		drive: (put) => send(put),
		refresh: () => send({ op: "refresh" }),
	};
}
