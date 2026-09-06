import { describe, expect, test } from "bun:test";
import {
	assertGpioDrive,
	GpioError,
	gpioNamedLine,
	headerPin,
	parseGpioPut,
	parsePhysicalPin,
} from "./gpio.ts";

describe("gpio safety", () => {
	test("refuses power and ground", () => {
		expect(() => assertGpioDrive("raspberrypi", 1)).toThrow(GpioError);
		expect(() => assertGpioDrive("raspberrypi", 2)).toThrow("power");
		expect(() => assertGpioDrive("raspberrypi", 6)).toThrow("gnd");
		expect(() => assertGpioDrive("orangepi", 1)).toThrow("power");
	});

	test("refuses raspberry pi EEPROM pins 27-28", () => {
		expect(() => assertGpioDrive("raspberrypi", 27)).toThrow("reserved");
		expect(() => assertGpioDrive("raspberrypi", 28)).toThrow("reserved");
	});

	test("allows orangepi 27-28 as gpio", () => {
		expect(assertGpioDrive("orangepi", 27).type).toBe("gpio");
	});

	test("allows digital gpio", () => {
		expect(assertGpioDrive("raspberrypi", 11)).toEqual(
			expect.objectContaining({ physical: 11, bcm: 17, name: "GPIO17" }),
		);
	});
});

describe("parseGpioPut", () => {
	test("output with value", () => {
		expect(parseGpioPut({ physical: 11, dir: "out", value: 1 })).toEqual({
			physical: 11,
			dir: "out",
			value: 1,
		});
	});

	test("value implies output", () => {
		expect(parseGpioPut({ physical: "11", value: "0" })).toEqual({
			physical: 11,
			dir: "out",
			value: 0,
		});
	});

	test("input omits value", () => {
		expect(parseGpioPut({ physical: 11, dir: "in" })).toEqual({
			physical: 11,
			dir: "in",
		});
	});

	test("requires value for output", () => {
		expect(() => parseGpioPut({ physical: 11, dir: "out" })).toThrow("value");
	});

	test("rejects out of range", () => {
		expect(() => parsePhysicalPin(0)).toThrow("1-40");
		expect(() => parsePhysicalPin(41)).toThrow("1-40");
	});
});

describe("header", () => {
	test("named bcm line", () => {
		expect(gpioNamedLine(25)).toBe("GPIO25");
		expect(headerPin("raspberrypi", 22)?.bcm).toBe(25);
	});
});
