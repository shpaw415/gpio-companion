import { describe, expect, test } from "bun:test";
import { BreadboardError, parseWokwiDiagram } from "./breadboard.ts";
import {
	arduinoProxyBoardLayout,
	arduinoProxyBoardTitle,
	arduinoProxyPinOffset,
	arduinoProxyResolvePad,
} from "./breadboard-arduino.ts";

const diagram = {
	version: 1 as const,
	editor: "gpio-companion",
	parts: [
		{ id: "bb1", type: "wokwi-breadboard-half", left: 80, top: 0 },
		{
			id: "uno",
			type: "gpio-arduino-proxy",
			left: 420,
			top: 40,
			attrs: { board: "uno" },
		},
		{ id: "led1", type: "wokwi-led" },
	],
	connections: [
		["uno:13", "bb1:10a", "yellow", []],
		["led1:A", "bb1:10e", "green", []],
		["led1:C", "bb1:11e", "green", []],
		["uno:GND", "bb1:tn.1", "black", []],
	],
};

describe("arduino proxy breadboard part", () => {
	test("parses gpio-arduino-proxy with board attr", () => {
		const parsed = parseWokwiDiagram(diagram);
		expect(
			parsed.parts.some((part) => part.type === "gpio-arduino-proxy"),
		).toBe(true);
	});

	test("rejects missing board", () => {
		expect(() =>
			parseWokwiDiagram({
				version: 1,
				parts: [
					{ id: "bb1", type: "wokwi-breadboard-half" },
					{ id: "uno", type: "gpio-arduino-proxy" },
				],
				connections: [],
			}),
		).toThrow(BreadboardError);
	});

	test("uno D13 is top-right and A0 is on the left", () => {
		const d13 = arduinoProxyPinOffset("uno", "13");
		const d13alias = arduinoProxyPinOffset("uno", "D13");
		const a0 = arduinoProxyPinOffset("uno", "A0");
		const gnd = arduinoProxyPinOffset("uno", "GND");
		expect(d13 && d13alias && a0 && gnd).toBeTruthy();
		if (!d13 || !d13alias || !a0 || !gnd) {
			return;
		}
		expect(d13).toEqual(d13alias);
		expect(d13.x).toBeGreaterThan(a0.x);
		expect(d13.y).toBeLessThan(a0.y);
		expect(arduinoProxyBoardTitle("uno")).toBe("Arduino Uno");
	});

	test("resolves 5V and duplicate GND", () => {
		expect(arduinoProxyResolvePad("uno", "5V")?.kind).toBe("power");
		expect(arduinoProxyResolvePad("uno", "GND")?.kind).toBe("gnd");
		expect(arduinoProxyResolvePad("uno", "GND.2")?.kind).toBe("gnd");
		expect(arduinoProxyResolvePad("uno", "GND.2")?.name).toBe("GND.2");
	});

	test("mega extras sit below the main headers", () => {
		const layout = arduinoProxyBoardLayout("mega");
		const extra = layout.pads.filter((pad) => pad.extra);
		expect(extra.length).toBeGreaterThan(0);
		const main = arduinoProxyPinOffset("mega", "13");
		const extraPin = arduinoProxyPinOffset("mega", String(extra[0]?.physical));
		expect(main && extraPin).toBeTruthy();
		if (!main || !extraPin) {
			return;
		}
		expect(extraPin.y).toBeGreaterThan(main.y);
		expect(layout.height).toBeGreaterThan(layout.extraOrigin);
	});
});
