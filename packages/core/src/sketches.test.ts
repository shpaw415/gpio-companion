import { describe, expect, test } from "bun:test";
import { parseBoardSketchList, sketchKindDir } from "./sketches.ts";

describe("board sketches", () => {
	test("kind dirs", () => {
		expect(sketchKindDir("host")).toBe("host");
		expect(sketchKindDir("firmware")).toBe("firmware");
	});

	test("parses a list", () => {
		expect(
			parseBoardSketchList({
				sketches: [
					{
						project: "blink-led",
						name: "blink",
						dir: "/home/companion/projects/blink-led/host/blink",
						files: ["blink.c"],
					},
				],
			}),
		).toEqual({
			sketches: [
				{
					project: "blink-led",
					name: "blink",
					dir: "/home/companion/projects/blink-led/host/blink",
					files: ["blink.c"],
				},
			],
		});
	});

	test("rejects relative dir", () => {
		expect(() =>
			parseBoardSketchList({
				sketches: [
					{
						project: "blink",
						name: "blink",
						dir: "host/blink",
						files: ["blink.c"],
					},
				],
			}),
		).toThrow("absolute");
	});
});
