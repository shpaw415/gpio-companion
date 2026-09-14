import { describe, expect, test } from "bun:test";
import {
	headerPinsForBoard,
	isHardwareId,
	parseWokwiDiagram,
} from "./breadboard-view.ts";

describe("breadboard-view", () => {
	test("exports isHardwareId for desktop gpio-companion alias", () => {
		expect(isHardwareId("orangepi")).toBe(true);
		expect(isHardwareId("esp32")).toBe(false);
	});

	test("exports headerPinsForBoard and parseWokwiDiagram", () => {
		expect(headerPinsForBoard("orangepi", "Orange Pi 3 LTS")).toHaveLength(26);
		expect(
			parseWokwiDiagram({
				version: 1,
				parts: [{ id: "bb1", type: "wokwi-breadboard-half" }],
				connections: [],
			}).parts[0]?.id,
		).toBe("bb1");
	});
});
