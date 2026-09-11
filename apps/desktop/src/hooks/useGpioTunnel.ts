import { useCallback, useEffect, useRef } from "react";
import { connectGpioLive, type GpioSnapshot } from "../api";
import { asGpioSnapshot, startReconnectSocket } from "../hub";

export type GpioPut = {
	physical: number;
	dir: "in" | "out";
	value?: 0 | 1;
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
		return () => {
			client.stop();
			clientRef.current = null;
		};
	}, [uuid]);

	const send = useCallback((payload: unknown) => {
		return clientRef.current?.send(JSON.stringify(payload)) ?? false;
	}, []);

	return {
		drive: (put) => send(put),
		refresh: () => send({ op: "refresh" }),
	};
}
