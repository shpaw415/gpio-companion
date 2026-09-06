import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateDeviceKeyPair, signDeviceRequest } from "gpio-companion";
import {
	createGpioController,
	memoryGpioBackend,
	parseGpioinfo,
	parseWiringOpReadall,
	resolveHeaderLines,
} from "./gpio.ts";
import { filePairingStore } from "./pairing.ts";
import { fileSecretsStore } from "./secrets.ts";
import { handleDeviceRequest, startDeviceApi } from "./serve.ts";
import { fileConfigStore } from "./store.ts";

const GPIOINFO = `
gpiochip0 - 58 lines:
	line   0:      unnamed       unused   input
	line   2:      "GPIO2"       unused   input
	line  17:      "GPIO17"      unused  output
gpiochip4 - 54 lines:
	line 437:      "GPIO25"      unused   input
`;

const READALL = `
 | BCM | wPi |   Name   | Mode | V | Physical | V | Mode | Name     | wPi | BCM |
 |     |     |     3.3v |      |   |  1 || 2  |   |      | 5v       |     |     |
 |  12 |   8 |   SDA.0  | ALT5 | 1 |  3 || 4  |   |      | 5v       |     |     |
 |   6 |   2 |  GPIO.2  |  IN  | 0 |  7 || 8  | 1 | ALT5 | TxD.3    |  15 |   13 |
`;

const OPI_INFO = `
gpiochip1 - 32 lines:
	line   5:      "SDA.0"       unused   input
	line  12:      "GPIO.2"      unused   input
	line  21:      "TxD.3"       unused  output
`;

describe("gpioinfo parse", () => {
	test("reads named lines across chips", () => {
		const lines = parseGpioinfo(GPIOINFO);
		expect(lines).toContainEqual(
			expect.objectContaining({
				chip: "gpiochip0",
				line: 17,
				name: "GPIO17",
				dir: "out",
			}),
		);
		expect(lines).toContainEqual(
			expect.objectContaining({
				chip: "gpiochip4",
				line: 437,
				name: "GPIO25",
			}),
		);
		expect(lines.some((line) => line.name === "unnamed")).toBe(false);
	});
});

describe("resolve header", () => {
	test("raspberry pi prefers named GPIO lines", () => {
		const resolved = resolveHeaderLines("raspberrypi", GPIOINFO);
		expect(resolved.get(11)).toEqual({
			chip: "gpiochip0",
			line: 17,
			name: "GPIO17",
		});
		expect(resolved.get(22)).toEqual({
			chip: "gpiochip4",
			line: 437,
			name: "GPIO25",
		});
	});

	test("orangepi uses wiringOP physical names", () => {
		const resolved = resolveHeaderLines("orangepi", OPI_INFO, READALL);
		expect(resolved.get(3)?.name).toBe("SDA.0");
		expect(resolved.get(7)?.name).toBe("GPIO.2");
		expect(resolved.get(8)?.name).toBe("TxD.3");
		expect(resolved.get(11)).toBeUndefined();
	});

	test("parses wiringOP physical names", () => {
		const names = parseWiringOpReadall(READALL);
		expect(names.get(3)).toBe("SDA.0");
		expect(names.get(7)).toBe("GPIO.2");
		expect(names.get(8)).toBe("TxD.3");
	});
});

describe("gpio controller", () => {
	test("snapshot and digital out", async () => {
		const gpio = createGpioController(memoryGpioBackend(GPIOINFO));
		const before = await gpio.snapshot("raspberrypi");
		const pin11 = before.pins.find((pin) => pin.physical === 11);
		expect(pin11?.chip).toBe("gpiochip0");
		expect(pin11?.line).toBe(17);
		const after = await gpio.apply("raspberrypi", {
			physical: 11,
			dir: "out",
			value: 1,
		});
		expect(after.pins.find((pin) => pin.physical === 11)?.value).toBe(1);
	});

	test("refuses power and reserved", async () => {
		const gpio = createGpioController(memoryGpioBackend(GPIOINFO));
		await expect(
			gpio.apply("raspberrypi", { physical: 1, dir: "out", value: 1 }),
		).rejects.toThrow("power");
		await expect(
			gpio.apply("raspberrypi", { physical: 27, dir: "out", value: 1 }),
		).rejects.toThrow("reserved");
	});

	test("orangepi unresolved pin fails closed", async () => {
		const gpio = createGpioController(memoryGpioBackend(OPI_INFO));
		await expect(
			gpio.apply("orangepi", { physical: 11, dir: "out", value: 1 }),
		).rejects.toThrow("unresolved");
	});
});

const dir = await mkdtemp(join(tmpdir(), "gpio-api-"));
const keys = await generateDeviceKeyPair();
const gpio = createGpioController(memoryGpioBackend(GPIOINFO));
const stores = {
	store: fileConfigStore(join(dir, "config.json"), "raspberrypi"),
	secrets: fileSecretsStore(join(dir, "secrets.env")),
	pairing: filePairingStore(join(dir, "pairing.json"), "pair-uuid", "pair-key"),
};

const server = startDeviceApi({
	port: 0,
	hostname: "127.0.0.1",
	...stores,
	applyTunnel: async () => undefined,
	deviceAuth: { keyId: keys.keyId, publicKeyPem: keys.publicKeyPem },
	gpio,
});

afterAll(() => {
	server.stop();
});

describe("gpio http", () => {
	test("loopback unsigned get and put", async () => {
		const get = await fetch(`${server.url}v1/gpio`);
		expect(get.status).toBe(200);
		const snap = (await get.json()) as { hardware: string };
		expect(snap.hardware).toBe("raspberrypi");

		const put = await fetch(`${server.url}v1/gpio`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ physical: 11, value: 1 }),
		});
		expect(put.status).toBe(200);
		const after = (await put.json()) as {
			pins: { physical: number; value?: number }[];
		};
		expect(after.pins.find((pin) => pin.physical === 11)?.value).toBe(1);
	});

	test("signed loopback put still works", async () => {
		const body = JSON.stringify({ physical: 11, dir: "out", value: 0 });
		const auth = await signDeviceRequest({
			privateKeyPem: keys.privateKeyPem,
			keyId: keys.keyId,
			method: "PUT",
			path: "/v1/gpio",
			body,
		});
		const response = await fetch(`${server.url}v1/gpio`, {
			method: "PUT",
			headers: { "content-type": "application/json", ...auth },
			body,
		});
		expect(response.status).toBe(200);
	});

	test("off-loopback unsigned is 401", async () => {
		await expect(
			handleDeviceRequest(
				new Request("https://api.example/v1/gpio", { method: "GET" }),
				stores.store,
				stores.secrets,
				stores.pairing,
				async () => undefined,
				undefined,
				undefined,
				undefined,
				{ keyId: keys.keyId, publicKeyPem: keys.publicKeyPem },
				undefined,
				undefined,
				undefined,
				{ gpio },
			),
		).rejects.toThrow("missing device signature");
	});
});
