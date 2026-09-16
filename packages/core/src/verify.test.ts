import { describe, expect, test } from "bun:test";
import { parseWokwiDiagram } from "./breadboard.ts";
import type { GpioSnapshot } from "./gpio.ts";
import {
	circuitVerifyColor,
	circuitVerifyOverlay,
	circuitVerifyPlan,
	expandCircuitNets,
	isVerifyPath,
	parseVerifyPut,
	VERIFY_PATH,
	VERIFY_STOP_PATH,
	VerifyError,
} from "./verify.ts";

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
		{ id: "btn1", type: "wokwi-pushbutton" },
	],
	connections: [
		["header:11", "bb1:10a", "yellow", ["h20"]],
		["led1:A", "bb1:10e", "green", []],
		["led1:C", "bb1:11e", "green", []],
		["r1:1", "bb1:11a", "green", []],
		["r1:2", "bb1:tn.1", "black", []],
		["header:6", "bb1:tn.2", "black", []],
		["header:13", "bb1:12a", "orange", []],
		["header:15", "bb1:12e", "orange", []],
		["btn1:1.l", "bb1:13a", "blue", []],
		["header:7", "bb1:13e", "blue", []],
	],
};

const snapshot: GpioSnapshot = {
	hardware: "raspberrypi",
	pins: [
		{ physical: 6, name: "GND", type: "gnd" },
		{ physical: 7, name: "GPIO4", type: "gpio" },
		{ physical: 11, name: "GPIO17", type: "gpio" },
		{ physical: 13, name: "GPIO27", type: "gpio" },
		{ physical: 15, name: "GPIO22", type: "gpio" },
	],
};

describe("verify paths", () => {
	test("matches verify routes", () => {
		expect(isVerifyPath(VERIFY_PATH)).toBe(true);
		expect(isVerifyPath(VERIFY_STOP_PATH)).toBe(true);
		expect(isVerifyPath("/v1/run")).toBe(false);
	});

	test("parses repo names", () => {
		expect(parseVerifyPut({ repo: "blink-led" })).toEqual({
			repo: "blink-led",
		});
		expect(() => parseVerifyPut({})).toThrow(VerifyError);
		expect(() => parseVerifyPut({ repo: "../etc" })).toThrow(VerifyError);
	});
});

describe("circuit nets", () => {
	test("unions breadboard rows and rails", () => {
		const diagram = parseWokwiDiagram(sample);
		const nets = expandCircuitNets(diagram);
		const ledAnode = nets.find(
			(net) => net.partIds.includes("led1") && net.pins.includes(11),
		);
		expect(ledAnode?.pins).toEqual([11]);
		const gnd = nets.find((net) => net.pins.includes(6));
		expect(gnd?.partIds).toContain("r1");
		const jumper = nets.find(
			(net) => net.pins.includes(13) && net.pins.includes(15),
		);
		expect(jumper?.pins).toEqual([13, 15]);
	});
});

describe("circuit verify plan", () => {
	test("classifies continuity, drive, button, and ground", () => {
		const plan = circuitVerifyPlan(sample, snapshot);
		expect(plan.find((item) => item.kind === "continuity")?.pins).toEqual([
			13, 15,
		]);
		expect(plan.find((item) => item.kind === "drive")?.partIds).toContain(
			"led1",
		);
		expect(plan.find((item) => item.kind === "button")?.status).toBe(
			"needs-press",
		);
		expect(plan.find((item) => item.kind === "power")?.pins).toContain(6);
	});

	test("refuses gpio shorted to gnd", () => {
		const plan = circuitVerifyPlan(
			{
				...sample,
				connections: [
					["header:11", "bb1:10a", "yellow", []],
					["header:6", "bb1:10e", "black", []],
				],
			},
			snapshot,
		);
		expect(plan.some((item) => item.kind === "unsafe")).toBe(true);
	});

	test("namespaces arduino proxy pins away from companion header", () => {
		const diagram = parseWokwiDiagram({
			version: 1,
			parts: [
				{ id: "bb1", type: "wokwi-breadboard-half" },
				{
					id: "uno",
					type: "gpio-arduino-proxy",
					attrs: { board: "uno" },
				},
			],
			connections: [
				["uno:13", "bb1:12a", "orange", []],
				["uno:12", "bb1:12e", "orange", []],
			],
		});
		const nets = expandCircuitNets(diagram);
		expect(nets.some((net) => net.pins.includes(13))).toBe(false);
		expect(
			nets.some(
				(net) => net.arduinoPins.includes(13) && net.arduinoPins.includes(12),
			),
		).toBe(true);
		const plan = circuitVerifyPlan(diagram, snapshot, {
			hardware: "raspberrypi",
			target: "arduino-proxy",
			pins: [
				{ physical: 12, name: "D12", type: "gpio" },
				{ physical: 13, name: "D13", type: "gpio" },
			],
		});
		const continuity = plan.find((item) => item.kind === "continuity");
		expect(continuity?.target).toBe("arduino-proxy");
		expect(continuity?.pins).toEqual([12, 13]);
	});

	test("refuses mixing companion header gpio with arduino gpio", () => {
		const plan = circuitVerifyPlan(
			{
				version: 1,
				parts: [
					{ id: "bb1", type: "wokwi-breadboard-half" },
					{
						id: "header",
						type: "gpio-companion-header",
						attrs: { hardware: "raspberrypi" },
					},
					{
						id: "uno",
						type: "gpio-arduino-proxy",
						attrs: { board: "uno" },
					},
				],
				connections: [
					["header:11", "bb1:10a", "yellow", []],
					["uno:13", "bb1:10e", "orange", []],
				],
			},
			snapshot,
			{
				hardware: "raspberrypi",
				target: "arduino-proxy",
				pins: [{ physical: 13, name: "D13", type: "gpio" }],
			},
		);
		expect(plan.some((item) => item.kind === "unsafe")).toBe(true);
	});

	test("paints overlay from results", () => {
		const diagram = parseWokwiDiagram(sample);
		const overlay = circuitVerifyOverlay(diagram, [
			{
				id: "net-11",
				net: "x",
				kind: "drive",
				status: "unknown",
				partIds: ["led1"],
				pins: [11],
				connections: [0, 1],
				detail: "no sense",
			},
		]);
		expect(overlay.parts.led1).toBe("unknown");
		expect(overlay.wires["header:11->bb1:10a"]).toBe("unknown");
		expect(circuitVerifyColor("pass")).toBe("#22c55e");
	});
});
