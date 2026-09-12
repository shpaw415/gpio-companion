import {
	GPIO_MAX_SOCKETS,
	GPIO_STREAM_MS,
	type GpioSnapshot,
	gpioPatchFrame,
	type HardwareId,
	isGpioWsRefresh,
	parseGpioWsCommand,
} from "gpio-companion";
import type { GpioController } from "./gpio.ts";

export type GpioStreamSocket = {
	send(data: string): void;
	close(code?: number, reason?: string): void;
};

export function createGpioStream(options: {
	gpio: GpioController;
	hardware: () => Promise<HardwareId>;
	intervalMs?: number;
}): {
	add(ws: GpioStreamSocket): void;
	remove(ws: GpioStreamSocket): void;
	publish(): void;
	handle(ws: GpioStreamSocket, data: string): Promise<void>;
} {
	const sockets = new Set<GpioStreamSocket>();
	const intervalMs = options.intervalMs ?? GPIO_STREAM_MS;
	let timer: ReturnType<typeof setInterval> | null = null;
	let lastSnapshot: GpioSnapshot | null = null;
	let busy = false;

	function sendAll(payload: string) {
		for (const ws of sockets) {
			try {
				ws.send(payload);
			} catch {
				sockets.delete(ws);
			}
		}
	}

	async function broadcast(forceFull = false) {
		if (busy || sockets.size === 0) {
			return;
		}
		busy = true;
		try {
			const next = await options.gpio.snapshot(await options.hardware());
			const frame = forceFull ? next : gpioPatchFrame(lastSnapshot, next);
			lastSnapshot = next;
			if (!frame) {
				return;
			}
			sendAll(JSON.stringify(frame));
		} catch {
			undefined;
		} finally {
			busy = false;
			if (sockets.size === 0) {
				stopTimer();
			}
		}
	}

	async function pushFull(ws: GpioStreamSocket) {
		const started = Date.now();
		while (busy && Date.now() - started < 2_000) {
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
		if (!sockets.has(ws)) {
			return;
		}
		if (lastSnapshot) {
			try {
				ws.send(JSON.stringify(lastSnapshot));
			} catch {
				sockets.delete(ws);
			}
			return;
		}
		await broadcast(true);
	}

	function startTimer() {
		if (timer) {
			return;
		}
		timer = setInterval(() => {
			void broadcast();
		}, intervalMs);
	}

	function stopTimer() {
		if (!timer) {
			return;
		}
		clearInterval(timer);
		timer = null;
	}

	return {
		add(ws) {
			if (sockets.size >= GPIO_MAX_SOCKETS) {
				ws.close(1013, "too many gpio sockets");
				return;
			}
			sockets.add(ws);
			startTimer();
			void pushFull(ws);
		},
		remove(ws) {
			sockets.delete(ws);
			if (sockets.size === 0) {
				stopTimer();
				lastSnapshot = null;
			}
		},
		publish() {
			void broadcast(true);
		},
		async handle(ws, data) {
			try {
				const command = parseGpioWsCommand(JSON.parse(data));
				if (!isGpioWsRefresh(command)) {
					await options.gpio.apply(await options.hardware(), command);
				}
				await broadcast(isGpioWsRefresh(command));
			} catch (error) {
				const message = error instanceof Error ? error.message : "gpio failed";
				try {
					ws.send(JSON.stringify({ error: message }));
				} catch {
					undefined;
				}
			}
		},
	};
}
