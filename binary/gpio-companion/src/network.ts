import type { NetworkConnectionType, NetworkStatus } from "gpio-companion";

export type NmcliDevice = {
	device: string;
	type: string;
	state: string;
	connection: string;
};

export type DefaultRoute = {
	device: string;
	metric: number;
};

export function splitNmcliLine(line: string): string[] {
	const parts: string[] = [];
	let buf = "";
	let esc = false;
	for (const ch of line) {
		if (esc) {
			buf += ch;
			esc = false;
			continue;
		}
		if (ch === "\\") {
			esc = true;
			continue;
		}
		if (ch === ":") {
			parts.push(buf);
			buf = "";
			continue;
		}
		buf += ch;
	}
	parts.push(buf);
	return parts;
}

export function parseNmcliDevices(text: string): NmcliDevice[] {
	return text
		.replace(/\r\n/g, "\n")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const parts = splitNmcliLine(line);
			return {
				device: parts[0] ?? "",
				type: parts[1] ?? "",
				state: parts[2] ?? "",
				connection: parts[3] ?? "",
			};
		})
		.filter((item) => item.device);
}

export function parseDefaultRoutes(text: string): DefaultRoute[] {
	const routes: DefaultRoute[] = [];
	for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
		const bits = line.trim().split(/\s+/);
		if (bits[0] !== "default") {
			continue;
		}
		const devIdx = bits.indexOf("dev");
		const metricIdx = bits.indexOf("metric");
		const device = devIdx >= 0 ? (bits[devIdx + 1] ?? "") : "";
		const parsed = metricIdx >= 0 ? Number(bits[metricIdx + 1]) : 10_000;
		if (device) {
			routes.push({
				device,
				metric: Number.isFinite(parsed) ? parsed : 10_000,
			});
		}
	}
	return routes.sort((a, b) => a.metric - b.metric);
}

export function parseWifiSsid(text: string): string {
	for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
		const parts = splitNmcliLine(line.trim());
		if (parts[0] === "yes" || parts[0] === "*") {
			return parts.slice(1).join(":") || "";
		}
	}
	return "";
}

export function networkType(raw: string): NetworkConnectionType {
	const kind = raw.trim().toLowerCase();
	if (kind === "ethernet" || kind === "802-3-ethernet") {
		return "ethernet";
	}
	if (kind === "wifi" || kind === "802-11-wireless" || kind === "wireless") {
		return "wifi";
	}
	return "unknown";
}

export function resolveNetworkStatus(input: {
	devices: string;
	routes: string;
	wifi: string;
}): NetworkStatus {
	const connected = parseNmcliDevices(input.devices).filter(
		(item) => item.state === "connected" && item.type !== "loopback",
	);
	const ssid = parseWifiSsid(input.wifi);
	const routes = parseDefaultRoutes(input.routes);
	let primary: NmcliDevice | undefined;
	for (const route of routes) {
		primary = connected.find((item) => item.device === route.device);
		if (primary) {
			break;
		}
	}
	if (!primary) {
		primary =
			connected.find((item) => networkType(item.type) === "ethernet") ??
			connected[0];
	}
	if (!primary) {
		return {
			type: "unknown",
			ssid,
			interface: "",
			connection: "",
		};
	}
	const type = networkType(primary.type);
	return {
		type,
		ssid: type === "wifi" ? ssid || primary.connection : "",
		interface: primary.device,
		connection: primary.connection,
	};
}

function spawnText(cmd: string[]): string {
	try {
		const proc = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
		return new TextDecoder().decode(proc.stdout);
	} catch {
		return "";
	}
}

export function readNetworkStatus(): NetworkStatus | null {
	const devices = spawnText([
		"nmcli",
		"-t",
		"-f",
		"DEVICE,TYPE,STATE,CONNECTION",
		"device",
		"status",
	]);
	if (!devices.trim()) {
		return null;
	}
	return resolveNetworkStatus({
		devices,
		routes: spawnText(["ip", "-4", "route", "show", "default"]),
		wifi: spawnText(["nmcli", "-t", "-f", "active,ssid", "dev", "wifi"]),
	});
}
