import { describe, expect, test } from "bun:test";
import {
	BreadboardError,
	breadboardPinOffset,
	parseWokwiDiagram,
	splitEndpoint,
	wirePath,
} from "./breadboard.ts";

const sample = {
	version: 1 as const,
	editor: "gpio-companion",
	parts: [
		{ id: "bb1", type: "wokwi-breadboard-half", left: 80, top: 0 },
		{
			id: "header",
			type: "gpio-companion-header",
			left: 0,
			top: 40,
			attrs: { hardware: "raspberrypi" },
		},
		{
			id: "led1",
			type: "wokwi-led",
			left: 140,
			top: 120,
			attrs: { color: "red" },
		},
		{
			id: "r1",
			type: "wokwi-resistor",
			left: 160,
			top: 160,
			attrs: { value: "220" },
		},
	],
	connections: [
		["header:11", "bb1:10a", "yellow", ["h20"]],
		["led1:A", "bb1:10e", "green", []],
		["led1:C", "bb1:11e", "green", []],
		["r1:1", "bb1:11a", "green", []],
		["r1:2", "bb1:tn.1", "black", []],
		["header:6", "bb1:tn.2", "black", []],
	],
	steps: [
		{ text: "LED anode in row 10, cathode in row 11", highlight: ["led1"] },
	],
};

describe("wokwi diagram", () => {
	test("parses a gpio-companion breadboard diagram", () => {
		const diagram = parseWokwiDiagram(sample);
		expect(diagram.parts).toHaveLength(4);
		expect(diagram.connections).toHaveLength(6);
		expect(diagram.steps?.[0]?.highlight).toEqual(["led1"]);
	});

	test("parses JSON text", () => {
		const diagram = parseWokwiDiagram(JSON.stringify(sample));
		expect(diagram.version).toBe(1);
	});

	test("rejects missing breadboard", () => {
		try {
			parseWokwiDiagram({
				version: 1,
				parts: [{ id: "led1", type: "wokwi-led" }],
				connections: [],
			});
			throw new Error("expected failure");
		} catch (error) {
			expect(error).toBeInstanceOf(BreadboardError);
		}
	});

	test("rejects duplicate ids", () => {
		try {
			parseWokwiDiagram({
				version: 1,
				parts: [
					{ id: "bb1", type: "wokwi-breadboard-half" },
					{ id: "bb1", type: "wokwi-led" },
				],
				connections: [],
			});
			throw new Error("expected failure");
		} catch (error) {
			expect(error).toBeInstanceOf(BreadboardError);
		}
	});

	test("rejects unknown connection parts", () => {
		try {
			parseWokwiDiagram({
				version: 1,
				parts: [{ id: "bb1", type: "wokwi-breadboard-half" }],
				connections: [["led1:A", "bb1:10a", "green", []]],
			});
			throw new Error("expected failure");
		} catch (error) {
			expect(error).toBeInstanceOf(BreadboardError);
		}
	});

	test("rejects header without hardware", () => {
		try {
			parseWokwiDiagram({
				version: 1,
				parts: [
					{ id: "bb1", type: "wokwi-breadboard-half" },
					{ id: "header", type: "gpio-companion-header" },
				],
				connections: [],
			});
			throw new Error("expected failure");
		} catch (error) {
			expect(error).toBeInstanceOf(BreadboardError);
		}
	});

	test("splits endpoints", () => {
		expect(splitEndpoint("bb1:10e")).toEqual({ partId: "bb1", pin: "10e" });
	});

	test("maps breadboard holes and rails", () => {
		expect(breadboardPinOffset("wokwi-breadboard-half", "10e")).not.toBeNull();
		expect(breadboardPinOffset("wokwi-breadboard-half", "tn.1")).not.toBeNull();
		expect(breadboardPinOffset("wokwi-breadboard-half", "99z")).toBeNull();
	});

	test("builds a wire path", () => {
		const points = wirePath({ x: 0, y: 0 }, { x: 20, y: 10 }, [
			"h8",
			"*",
			"v-4",
		]);
		expect(points[0]).toEqual({ x: 0, y: 0 });
		expect(points.at(-1)).toEqual({ x: 20, y: 10 });
	});
});
