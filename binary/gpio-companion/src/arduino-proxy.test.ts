import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateDeviceKeyPair, signDeviceRequest } from "gpio-companion";
import {
	createArduinoProxy,
	listUsbSerialPorts,
	memoryArduinoProxy,
} from "./arduino-proxy.ts";
import { memoryFlash } from "./flash.ts";
import { filePairingStore } from "./pairing.ts";
import { formatProxyPinmap, memoryRun } from "./run.ts";
import { fileSecretsStore } from "./secrets.ts";
import { handleDeviceRequest, startDeviceApi } from "./serve.ts";
import { fileConfigStore } from "./store.ts";

describe("memory arduino proxy", () => {
	test("applies pin writes when connected", async () => {
		const proxy = memoryArduinoProxy({ connected: true });
		const snapshot = proxy.apply("raspberrypi", {
			physical: 13,
			dir: "out",
			value: 1,
		});
		expect(snapshot.target).toBe("arduino-proxy");
		expect(snapshot.pins.find((pin) => pin.physical === 13)?.value).toBe(1);
	});

	test("refuses writes when disconnected", () => {
		const proxy = memoryArduinoProxy();
		expect(() =>
			proxy.apply("raspberrypi", { physical: 13, dir: "out", value: 1 }),
		).toThrow("not connected");
	});

	test("attach sets board from fqbn", async () => {
		const proxy = memoryArduinoProxy();
		const status = await proxy.attach("/dev/ttyACM0", "arduino:avr:mega");
		expect(status.connected).toBe(true);
		expect(status.board).toBe("mega");
		expect(status.pins.some((pin) => pin.physical === 54)).toBe(true);
	});
});

describe("live handshake", () => {
	test("retries firmware query until the board answers", async () => {
		let writes = 0;
		let onData: (bytes: Uint8Array) => void = () => undefined;
		const proxy = createArduinoProxy({
			probeMs: 800,
			openSerial: (_port, _baud, data) => {
				onData = data;
				return {
					write() {
						writes += 1;
						if (writes >= 2) {
							onData(Uint8Array.from([0xf0, 0x79, 2, 5, 0xf7]));
						}
					},
					close() {
						undefined;
					},
				};
			},
		});
		const status = await proxy.attach("/dev/ttyACM0", "arduino:avr:uno");
		expect(status.connected).toBe(true);
		expect(status.board).toBe("uno");
		expect(writes).toBeGreaterThanOrEqual(2);
	});
});

describe("listUsbSerialPorts", () => {
	test("finds ttyACM and ttyUSB only", () => {
		const root = join(tmpdir(), `usb-serial-${Date.now()}`);
		mkdirSync(root);
		writeFileSync(join(root, "ttyACM0"), "");
		writeFileSync(join(root, "ttyUSB1"), "");
		writeFileSync(join(root, "ttyS0"), "");
		expect(listUsbSerialPorts(root)).toEqual([
			join(root, "ttyACM0"),
			join(root, "ttyUSB1"),
		]);
	});
});

describe("formatProxyPinmap", () => {
	test("writes port and reserved pins", () => {
		const proxy = memoryArduinoProxy({ connected: true, port: "/dev/ttyACM0" });
		const text = formatProxyPinmap(proxy.status());
		expect(text).toContain("target arduino-proxy");
		expect(text).toContain("port /dev/ttyACM0");
		expect(text).toContain("0 reserved");
	});
});

const dir = await mkdtemp(join(tmpdir(), "proxy-api-"));
const keys = await generateDeviceKeyPair();
const proxy = memoryArduinoProxy({ connected: true, port: "/dev/ttyACM0" });
const flash = memoryFlash(
	JSON.stringify({
		detected_ports: [
			{
				port: { address: "/dev/ttyACM0", protocol: "serial" },
				matching_boards: [{ name: "Arduino Uno", fqbn: "arduino:avr:uno" }],
			},
		],
	}),
);
const stores = {
	store: fileConfigStore(join(dir, "config.json"), "raspberrypi"),
	secrets: fileSecretsStore(join(dir, "secrets.env")),
	pairing: filePairingStore(join(dir, "pairing.json"), "pair-uuid", "pair-key"),
};

const server = startDeviceApi({
	port: 0,
	hostname: "127.0.0.1",
	store: stores.store,
	secrets: stores.secrets,
	pairing: stores.pairing,
	applyTunnel: async () => undefined,
	deviceAuth: { keyId: "k", publicKeyPem: keys.publicKeyPem },
	flash,
	run: memoryRun(),
	proxy,
});

afterAll(() => {
	server.stop();
});

describe("arduino-proxy http", () => {
	test("GET /v1/arduino-proxy", async () => {
		const response = await fetch(`${server.url}v1/arduino-proxy`);
		expect(response.status).toBe(200);
		const body = (await response.json()) as { connected: boolean; fqbn?: string };
		expect(body.connected).toBe(true);
	});

	test("POST /v1/flash/proxy starts a job", async () => {
		const response = await fetch(`${server.url}v1/flash/proxy`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{}",
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ started: true });
	});

	test("PUT gpio target arduino-proxy", async () => {
		const response = await fetch(`${server.url}v1/gpio`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				target: "arduino-proxy",
				physical: 13,
				dir: "out",
				value: 1,
			}),
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			target?: string;
			pins: Array<{ physical: number; value?: number }>;
		};
		expect(body.target).toBe("arduino-proxy");
		expect(body.pins.find((pin) => pin.physical === 13)?.value).toBe(1);
	});
});

describe("signed flash proxy", () => {
	test("owner POST /v1/flash/proxy", async () => {
		const headers = await signDeviceRequest({
			privateKeyPem: keys.privateKeyPem,
			keyId: "k",
			method: "POST",
			path: "/v1/flash/proxy",
			body: "{}",
		});
		const response = await handleDeviceRequest(
			new Request("https://api.example/v1/flash/proxy", {
				method: "POST",
				headers: { "content-type": "application/json", ...headers },
				body: "{}",
			}),
			stores.store,
			stores.secrets,
			stores.pairing,
			async () => undefined,
			undefined,
			undefined,
			undefined,
			{ keyId: "k", publicKeyPem: keys.publicKeyPem },
			undefined,
			undefined,
			undefined,
			{ flash, proxy },
		);
		expect(response.status).toBe(200);
	});
});
