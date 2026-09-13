import { describe, expect, test } from "bun:test";
import {
	applyConsoleMessage,
	asConsoleWsError,
	CONSOLE_LOG_MAX,
	CONSOLE_PATH,
	ConsoleError,
	capConsoleLog,
	consoleWsConnectUrl,
	consoleWsUrl,
	emptyConsoleSnapshot,
	isConsolePath,
	parseConsoleUsbPut,
	parseConsoleWsCommand,
} from "./console.ts";

describe("console paths", () => {
	test("matches console routes", () => {
		expect(isConsolePath("/v1/console")).toBe(true);
		expect(isConsolePath("/v1/console/usb")).toBe(true);
		expect(isConsolePath("/v1/console/usb/stop")).toBe(true);
		expect(isConsolePath("/v1/run")).toBe(false);
	});

	test("builds companion websocket urls", () => {
		expect(consoleWsUrl("https://api-abc.gpio-companion.com")).toBe(
			"wss://api-abc.gpio-companion.com/v1/console",
		);
		expect(
			consoleWsConnectUrl("https://api-abc.gpio-companion.com", {
				"X-Gpio-Key-Id": "k",
				"X-Gpio-Timestamp": "1",
				"X-Gpio-Nonce": "n",
				"X-Gpio-Signature": "s",
			}),
		).toContain("/v1/console?x-gpio-key-id=k");
	});
});

describe("parseConsoleUsbPut", () => {
	test("requires a Pi tty port", () => {
		expect(parseConsoleUsbPut({ port: "/dev/ttyACM0" })).toEqual({
			port: "/dev/ttyACM0",
			baud: 115200,
		});
		expect(parseConsoleUsbPut({ port: "/dev/ttyUSB1", baud: 9600 })).toEqual({
			port: "/dev/ttyUSB1",
			baud: 9600,
		});
	});

	test("rejects other paths and bauds", () => {
		expect(() => parseConsoleUsbPut({ port: "/dev/ttyS0" })).toThrow(
			ConsoleError,
		);
		expect(() => parseConsoleUsbPut({ port: "/tmp/x" })).toThrow("tty");
		expect(() =>
			parseConsoleUsbPut({ port: "/dev/ttyACM0", baud: 1200 }),
		).toThrow("baud");
	});
});

describe("parseConsoleWsCommand", () => {
	test("accepts refresh", () => {
		expect(parseConsoleWsCommand({ op: "refresh" })).toEqual({ op: "refresh" });
	});

	test("rejects other commands", () => {
		expect(() => parseConsoleWsCommand({ op: "drive" })).toThrow("unknown");
	});
});

describe("applyConsoleMessage", () => {
	test("replaces a full snapshot", () => {
		expect(
			applyConsoleMessage(null, {
				host: { running: true, log: "a" },
				usb: { open: true, port: "/dev/ttyACM0", baud: 9600, log: "b" },
			}),
		).toEqual({
			host: { running: true, log: "a" },
			usb: { open: true, port: "/dev/ttyACM0", baud: 9600, log: "b" },
		});
	});

	test("appends host and usb chunks", () => {
		const start = emptyConsoleSnapshot();
		const host = applyConsoleMessage(start, {
			source: "host",
			chunk: "hi\n",
		});
		expect(host?.host.log).toBe("hi\n");
		const usb = applyConsoleMessage(host, { source: "usb", chunk: "ok" });
		expect(usb?.usb.log).toBe("ok");
	});

	test("clears host log when a run starts", () => {
		const prev = applyConsoleMessage(emptyConsoleSnapshot(), {
			source: "host",
			chunk: "old",
		});
		expect(
			applyConsoleMessage(prev, { source: "host", running: true })?.host,
		).toEqual({ running: true, log: "" });
	});

	test("caps log", () => {
		expect(capConsoleLog("ok")).toBe("ok");
		const log = "x".repeat(CONSOLE_LOG_MAX + 8);
		expect(capConsoleLog(log).length).toBe(CONSOLE_LOG_MAX);
	});

	test("error frames are not snapshots", () => {
		expect(asConsoleWsError({ error: "usb serial busy" })).toBe(
			"usb serial busy",
		);
		expect(asConsoleWsError({ source: "host", chunk: "x" })).toBeNull();
		expect(CONSOLE_PATH).toBe("/v1/console");
	});
});
