import {
	classifyWifiConnectError,
	type WifiConfig,
	WifiConnectError,
} from "gpio-companion";

export type ApplyWifi = (config: WifiConfig) => Promise<{ ssid: string }>;

async function readPipe(
	stream: ReadableStream<Uint8Array> | number | undefined,
): Promise<string> {
	if (!stream || typeof stream === "number") {
		return "";
	}
	return new Response(stream).text();
}

export function applyNetworkManagerWifi(): ApplyWifi {
	return async (config) => {
		const proc = Bun.spawn(
			[
				"nmcli",
				"device",
				"wifi",
				"connect",
				config.ssid,
				"password",
				config.psk,
			],
			{ stdout: "pipe", stderr: "pipe" },
		);
		const [stdout, stderr, code] = await Promise.all([
			readPipe(proc.stdout),
			readPipe(proc.stderr),
			proc.exited,
		]);
		if (code !== 0) {
			throw new WifiConnectError(
				classifyWifiConnectError(`${stdout}\n${stderr}`),
			);
		}
		return { ssid: config.ssid };
	};
}
