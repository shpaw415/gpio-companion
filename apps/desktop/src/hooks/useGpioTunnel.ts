import { useCallback, useEffect, useRef, useState } from "react";
import { connectGpioLive, type GpioSnapshot } from "../api";
import {
	applyGpioMessage,
	gpioSnapshotStatusKey,
	startReconnectSocket,
} from "../hub";

export type GpioPut = {
	physical: number;
	dir?: "in" | "out" | "pwm";
	value?: 0 | 1;
	analog?: number;
	op?: "refresh" | "tone" | "notone";
	hz?: number;
};

export type GpioTunnelStatus = "idle" | "connecting" | "live" | "reconnecting";

export type GpioTunnel = {
	drive: (put: GpioPut) => boolean;
	refresh: () => boolean;
	status: GpioTunnelStatus;
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
	const snapshotRef = useRef<GpioSnapshot | null>(null);
	const [status, setStatus] = useState<GpioTunnelStatus>(
		uuid.trim() ? "connecting" : "idle",
	);
	onSnapshotRef.current = onSnapshot;
	onErrorRef.current = onError;

	useEffect(() => {
		const trimmed = uuid.trim();
		snapshotRef.current = null;
		if (!trimmed) {
			setStatus("idle");
			return;
		}
		setStatus("connecting");
		const client = startReconnectSocket({
			open: async () => {
				const next = await connectGpioLive(trimmed);
				const wsUrl = next.wsUrl?.trim() ?? "";
				if (!wsUrl) {
					throw new Error("missing gpio websocket url");
				}
				return wsUrl;
			},
			onOpen() {
				setStatus("live");
			},
			onClose() {
				setStatus("reconnecting");
			},
			onMessage(data) {
				try {
					const parsed = JSON.parse(data);
					const error = asGpioWsError(parsed);
					if (error) {
						onErrorRef.current?.(error);
						return;
					}
					const snapshot = applyGpioMessage(snapshotRef.current, parsed);
					if (!snapshot) {
						return;
					}
					const prev = snapshotRef.current;
					if (
						prev &&
						gpioSnapshotStatusKey(prev) === gpioSnapshotStatusKey(snapshot)
					) {
						return;
					}
					snapshotRef.current = snapshot;
					onSnapshotRef.current(snapshot);
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
		status,
	};
}
