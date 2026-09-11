import {
	GPIO_MAX_SOCKETS,
	GPIO_STREAM_MS,
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
	let last = "";
	let busy = false;

	async function broadcast() {
		if (busy || sockets.size === 0) {
			return;
		}
		busy = true;
		try {
			const snapshot = JSON.stringify(
				await options.gpio.snapshot(await options.hardware()),
			);
			if (snapshot === last) {
				return;
			}
			last = snapshot;
			for (const ws of sockets) {
				try {
					ws.send(snapshot);
				} catch {
					sockets.delete(ws);
				}
			}
		} catch {
			undefined;
		} finally {
			busy = false;
			if (sockets.size === 0) {
				stopTimer();
			}
		}
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
			last = "";
			startTimer();
			void broadcast();
		},
		remove(ws) {
			sockets.delete(ws);
			if (sockets.size === 0) {
				stopTimer();
				last = "";
			}
		},
		publish() {
			last = "";
			void broadcast();
		},
		async handle(ws, data) {
			try {
				const command = parseGpioWsCommand(JSON.parse(data));
				if (!isGpioWsRefresh(command)) {
					await options.gpio.apply(await options.hardware(), command);
				}
				last = "";
				await broadcast();
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
