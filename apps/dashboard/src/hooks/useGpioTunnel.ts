import { POST as signGpioLive } from "@api/gpio-live";
import {
	asGpioSnapshot,
	asGpioWsError,
	type GpioApply,
	type GpioSnapshot,
} from "gpio-companion";
import { useCallback, useEffect, useRef } from "react";
import { unwrapAction } from "../lib/action.ts";

export type GpioTunnel = {
	drive: (put: GpioApply) => boolean;
	refresh: () => boolean;
};

export function useGpioTunnel(
	uuid: string,
	onSnapshot: (snapshot: GpioSnapshot) => void,
	onError?: (message: string) => void,
): GpioTunnel {
	const socketRef = useRef<WebSocket | null>(null);
	const onSnapshotRef = useRef(onSnapshot);
	const onErrorRef = useRef(onError);
	onSnapshotRef.current = onSnapshot;
	onErrorRef.current = onError;

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
				socketRef.current = next;
				next.addEventListener("open", () => {
					delay = 500;
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
						const snapshot = asGpioSnapshot(parsed);
						if (snapshot) {
							onSnapshotRef.current(snapshot);
						}
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
	};
}
