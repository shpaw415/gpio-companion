import {
	DEBUG_LIVE_PATH,
	DEBUG_LIVE_PING_MS,
	DEFAULT_DASHBOARD_ORIGIN,
} from "gpio-companion";

export { DEBUG_LIVE_PING_MS };

export function livePingUrl(dashboardUrl?: string): string {
	const origin = (
		dashboardUrl ||
		process.env.GPIO_COMPANION_DASHBOARD_URL ||
		DEFAULT_DASHBOARD_ORIGIN
	).replace(/\/+$/, "");
	return `${origin}${DEBUG_LIVE_PATH}`;
}

export async function pingDashboardLive(options: {
	uuid: string;
	dashboardUrl?: string;
	fetchImpl?: typeof fetch;
}): Promise<boolean> {
	const uuid = options.uuid.trim();
	if (!uuid) {
		return false;
	}
	const fetchImpl = options.fetchImpl ?? fetch;
	const response = await fetchImpl(livePingUrl(options.dashboardUrl), {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ uuid }),
	});
	return response.ok;
}

export function startLivePing(options: {
	uuid: string;
	dashboardUrl?: string;
	intervalMs?: number;
	fetchImpl?: typeof fetch;
}): { stop(): void } {
	const tick = () => {
		void pingDashboardLive(options).catch(() => undefined);
	};
	tick();
	const timer = setInterval(tick, options.intervalMs ?? DEBUG_LIVE_PING_MS);
	return {
		stop() {
			clearInterval(timer);
		},
	};
}
