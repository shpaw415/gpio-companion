import { describe, expect, test } from "bun:test";
import {
	BreadboardError,
	breadboardHasRails,
	breadboardPinOffset,
	parseWokwiDiagram,
	rotatePoint,
	snapPartPlacement,
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

	test("portrait rails sit left and right of a-e / f-j", () => {
		const a = breadboardPinOffset("wokwi-breadboard-half", "1a");
		const e = breadboardPinOffset("wokwi-breadboard-half", "1e");
		const f = breadboardPinOffset("wokwi-breadboard-half", "1f");
		const j = breadboardPinOffset("wokwi-breadboard-half", "1j");
		const row2 = breadboardPinOffset("wokwi-breadboard-half", "2a");
		const tp = breadboardPinOffset("wokwi-breadboard-half", "tp.1");
		const tn = breadboardPinOffset("wokwi-breadboard-half", "tn.1");
		const bn = breadboardPinOffset("wokwi-breadboard-half", "bn.1");
		const bp = breadboardPinOffset("wokwi-breadboard-half", "bp.1");
		const tn10 = breadboardPinOffset("wokwi-breadboard-half", "tn.10");
		const a10 = breadboardPinOffset("wokwi-breadboard-half", "10a");
		expect(
			a && e && f && j && row2 && tp && tn && bn && bp && tn10 && a10,
		).toBeTruthy();
		if (
			!a ||
			!e ||
			!f ||
			!j ||
			!row2 ||
			!tp ||
			!tn ||
			!bn ||
			!bp ||
			!tn10 ||
			!a10
		) {
			return;
		}
		expect(tp.x).toBeLessThan(tn.x);
		expect(tn.x).toBeLessThan(a.x);
		expect(a.x).toBeLessThan(e.x);
		expect(e.x).toBeLessThan(f.x);
		expect(f.x).toBeLessThan(j.x);
		expect(j.x).toBeLessThan(bn.x);
		expect(bn.x).toBeLessThan(bp.x);
		expect(a.y).toBeLessThan(row2.y);
		expect(tn10.y).toBe(a10.y);
		expect(tp.y).toBe(a.y);
	});

	test("mini breadboard has no power rails", () => {
		expect(breadboardHasRails("wokwi-breadboard-mini")).toBe(false);
		expect(breadboardPinOffset("wokwi-breadboard-mini", "tn.1")).toBeNull();
		expect(breadboardPinOffset("wokwi-breadboard-mini", "1a")).not.toBeNull();
	});

	test("snaps a led onto connected holes", () => {
		const diagram = parseWokwiDiagram(sample);
		const led = diagram.parts.find((part) => part.id === "led1");
		const hole = breadboardPinOffset("wokwi-breadboard-half", "10e");
		expect(led && hole).toBeTruthy();
		if (!led || !hole) {
			return;
		}
		const placement = snapPartPlacement(led, diagram);
		const anode = rotatePoint({ x: 25, y: 42 }, placement.rotate);
		expect(placement.origin.x + anode.x).toBeCloseTo(80 + hole.x);
		expect(placement.origin.y + anode.y).toBeCloseTo(hole.y);
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
