import { describe, expect, test } from "bun:test";
import {
	assertGpioDrive,
	canDriveGpio,
	GpioError,
	gpioNamedLine,
	gpioPinTone,
	gpioWsConnectUrl,
	gpioWsUrl,
	headerPin,
	headerPinPairs,
	parseGpioPut,
	parsePhysicalPin,
	pinByPhysical,
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

describe("gpio websocket url", () => {
	test("uses the companion tunnel path", () => {
		expect(gpioWsUrl("https://api-abc.gpio-companion.com")).toBe(
			"wss://api-abc.gpio-companion.com/v1/gpio",
		);
		expect(
			gpioWsConnectUrl("https://api-abc.gpio-companion.com", {
				"X-Gpio-Key-Id": "k",
				"X-Gpio-Timestamp": "1",
				"X-Gpio-Nonce": "n",
				"X-Gpio-Signature": "s",
			}),
		).toContain("/v1/gpio?x-gpio-key-id=k");
	});
});

describe("header", () => {
	test("named bcm line", () => {
		expect(gpioNamedLine(25)).toBe("GPIO25");
		expect(headerPin("raspberrypi", 22)?.bcm).toBe(25);
	});

	test("pairs odd/even physical seats", () => {
		const pairs = headerPinPairs();
		expect(pairs).toHaveLength(20);
		expect(pairs[0]).toEqual({ odd: 1, even: 2 });
		expect(pairs[19]).toEqual({ odd: 39, even: 40 });
	});

	test("looks up and classifies live pins", () => {
		const power = { physical: 1, name: "3V3", type: "power" as const };
		const gpio = {
			physical: 11,
			name: "GPIO17",
			type: "gpio" as const,
			dir: "out" as const,
			value: 1 as const,
		};
		const reserved = {
			physical: 27,
			name: "GPIO0",
			type: "gpio" as const,
			reserved: true,
		};
		expect(pinByPhysical([power, gpio, reserved], 11)?.name).toBe("GPIO17");
		expect(canDriveGpio(power)).toBe(false);
		expect(canDriveGpio(gpio)).toBe(true);
		expect(canDriveGpio(reserved)).toBe(false);
		expect(gpioPinTone(power)).toBe("power");
		expect(gpioPinTone(gpio)).toBe("high");
		expect(gpioPinTone(reserved)).toBe("reserved");
	});
});
