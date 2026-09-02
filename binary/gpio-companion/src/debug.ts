import {
	DEBUG_MAX_SOCKETS,
	DEBUG_RING_SIZE,
	type DebugEvent,
	debugLevelFromStatus,
	isAllowedDebugOrigin,
	normalizeDebugPath,
	redactDebugMessage,
	shouldPublishDebugPath,
} from "gpio-companion";

export type DebugSocket = {
	send(data: string): void;
	close(code?: number, reason?: string): void;
};

export type DebugHub = {
	allowOrigin(origin: string): boolean;
	add(ws: DebugSocket): void;
	remove(ws: DebugSocket): void;
	publishFromResponse(request: Request, response: Response): Promise<void>;
};

export function createDebugHub(options?: {
	now?: () => number;
	dashboardUrl?: string;
}): DebugHub {
	const sockets = new Set<DebugSocket>();
	const ring: DebugEvent[] = [];
	const now = options?.now ?? Date.now;

	function publish(event: DebugEvent): void {
		ring.push(event);
		if (ring.length > DEBUG_RING_SIZE) {
			ring.shift();
		}
		const payload = JSON.stringify(event);
		for (const ws of sockets) {
			try {
				ws.send(payload);
			} catch {
				sockets.delete(ws);
			}
		}
	}

	return {
		allowOrigin(origin) {
			return isAllowedDebugOrigin(origin, options?.dashboardUrl);
		},
		add(ws) {
			if (sockets.size >= DEBUG_MAX_SOCKETS) {
				ws.close(1013, "too many debug sockets");
				return;
			}
			sockets.add(ws);
			for (const event of ring) {
				try {
					ws.send(JSON.stringify(event));
				} catch {
					sockets.delete(ws);
					return;
				}
			}
		},
		remove(ws) {
			sockets.delete(ws);
		},
		async publishFromResponse(request, response) {
			const url = new URL(request.url);
			const path = normalizeDebugPath(url.pathname);
			if (!shouldPublishDebugPath(path)) {
				return;
			}
			const level = debugLevelFromStatus(response.status);
			if (!level) {
				return;
			}
			let message = response.statusText.trim() || "request failed";
			try {
				const body = (await response.clone().json()) as {
					error?: unknown;
				};
				if (typeof body.error === "string" && body.error.trim()) {
					message = redactDebugMessage(body.error);
				}
			} catch {
				// keep status text
			}
			publish({
				t: now(),
				level,
				method: request.method.toUpperCase(),
				path,
				status: response.status,
				message,
			});
		},
	};
}
