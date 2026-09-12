import { POST as signGpioLive } from "@api/gpio-live";
import {
	applyGpioMessage,
	asGpioWsError,
	type GpioApply,
	type GpioSnapshot,
	gpioSnapshotStatusKey,
} from "gpio-companion";
import { useCallback, useEffect, useRef, useState } from "react";
import { unwrapAction } from "../lib/action.ts";

export type GpioTunnelStatus = "idle" | "connecting" | "live" | "reconnecting";

export type GpioTunnel = {
	drive: (put: GpioApply) => boolean;
	refresh: () => boolean;
	status: GpioTunnelStatus;
};

export function useGpioTunnel(
	uuid: string,
	onSnapshot: (snapshot: GpioSnapshot) => void,
	onError?: (message: string) => void,
): GpioTunnel {
	const socketRef = useRef<WebSocket | null>(null);
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
		if (!trimmed || typeof window === "undefined") {
			setStatus("idle");
			return;
		}
		let closed = false;
		let socket: WebSocket | null = null;
		let timer = 0;
		let delay = 500;
		setStatus("connecting");

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
				socketRef.current = next;
				next.addEventListener("open", () => {
					delay = 500;
					if (socket === next) {
						setStatus("live");
					}
				});
				next.addEventListener("message", (event) => {
					if (socket !== next) {
						return;
					}
					try {
						const parsed = JSON.parse(String(event.data ?? ""));
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
				});
				next.addEventListener("close", () => {
					if (socket === next) {
						socket = null;
					}
					if (socketRef.current === next) {
						socketRef.current = null;
					}
					if (!closed) {
						setStatus("reconnecting");
						schedule();
					}
				});
			} catch {
				if (!closed) {
					setStatus("reconnecting");
					schedule();
				}
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
			socketRef.current = null;
		};
	}, [uuid]);

	const send = useCallback((payload: unknown) => {
		const ws = socketRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return false;
		}
		ws.send(JSON.stringify(payload));
		return true;
	}, []);

	return {
		drive: (put) => send(put),
		refresh: () => send({ op: "refresh" }),
		status,
	};
}
