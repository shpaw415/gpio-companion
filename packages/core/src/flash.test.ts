import { describe, expect, test } from "bun:test";
import {
	capFlashLog,
	FLASH_LOG_MAX,
	FlashError,
	isFlashPath,
	parseArduinoBoardList,
	parseFlashPut,
} from "./flash.ts";

describe("parseFlashPut", () => {
	test("requires fqbn and absolute dir", () => {
		expect(
			parseFlashPut({ fqbn: "arduino:avr:uno", dir: "/home/gpio/blink" }),
		).toEqual({
			fqbn: "arduino:avr:uno",
			dir: "/home/gpio/blink",
		});
	});

	test("optional port", () => {
		expect(
			parseFlashPut({
				fqbn: "arduino:avr:uno",
				dir: "/tmp/sketch",
				port: "/dev/ttyUSB0",
			}).port,
		).toBe("/dev/ttyUSB0");
	});

	test("rejects relative dir and traversal", () => {
		expect(() =>
			parseFlashPut({ fqbn: "arduino:avr:uno", dir: "blink" }),
		).toThrow(FlashError);
		expect(() =>
			parseFlashPut({ fqbn: "arduino:avr:uno", dir: "/tmp/../etc" }),
		).toThrow("absolute");
	});

	test("rejects empty fqbn", () => {
		expect(() => parseFlashPut({ dir: "/tmp/sketch" })).toThrow("fqbn");
	});
});

describe("parseArduinoBoardList", () => {
	test("reads detected_ports json", () => {
		expect(
			parseArduinoBoardList({
				detected_ports: [
					{
						port: { address: "/dev/ttyUSB0", protocol: "serial" },
						matching_boards: [{ name: "Arduino Uno", fqbn: "arduino:avr:uno" }],
					},
				],
			}),
		).toEqual([
			{
				address: "/dev/ttyUSB0",
				protocol: "serial",
				fqbn: "arduino:avr:uno",
				name: "Arduino Uno",
			},
		]);
	});

	test("parses json string", () => {
		expect(
			parseArduinoBoardList(
				JSON.stringify({
					detected_ports: [{ port: { address: "/dev/ttyACM0" } }],
				}),
			)[0]?.address,
		).toBe("/dev/ttyACM0");
	});
});

describe("flash helpers", () => {
	test("path match", () => {
		expect(isFlashPath("/v1/flash")).toBe(true);
		expect(isFlashPath("/v1/flash/ports")).toBe(true);
		expect(isFlashPath("/v1/flash/sketches")).toBe(true);
		expect(isFlashPath("/v1/gpio")).toBe(false);
	});

	test("caps log", () => {
		expect(capFlashLog("ok")).toBe("ok");
		const log = "x".repeat(FLASH_LOG_MAX + 10);
		expect(capFlashLog(log).length).toBe(FLASH_LOG_MAX);
	});
});
