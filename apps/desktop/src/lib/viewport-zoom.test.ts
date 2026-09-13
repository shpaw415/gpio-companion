import { describe, expect, test } from "bun:test";
import {
	clampScale,
	fitContain,
	fitRect,
	panBy,
	touchDistance,
	touchMidpoint,
	zoomAt,
} from "./viewport-zoom.ts";

describe("viewport zoom", () => {
	test("clamps scale", () => {
		expect(clampScale(0)).toBe(0.1);
		expect(clampScale(99)).toBe(8);
		expect(clampScale(1.5)).toBe(1.5);
	});

	test("zooms toward the cursor", () => {
		const next = zoomAt({ scale: 1, x: 0, y: 0 }, 2, 100, 50);
		expect(next.scale).toBe(2);
		expect(next.x).toBe(-100);
		expect(next.y).toBe(-50);
	});

	test("ignores zoom when already at the cap", () => {
		const current = { scale: 8, x: 10, y: 4 };
		expect(zoomAt(current, 2, 0, 0)).toEqual(current);
	});

	test("pans by delta", () => {
		expect(panBy({ scale: 1, x: 3, y: 4 }, 2, -1)).toEqual({
			scale: 1,
			x: 5,
			y: 3,
		});
	});

	test("fits content inside the view", () => {
		const next = fitContain(200, 400, 400, 400, 0);
		expect(next.scale).toBe(1);
		expect(next.x).toBe(100);
		expect(next.y).toBe(0);
	});

	test("fits a sub-rect so it stays centered", () => {
		const next = fitRect(
			{ x: 50, y: 20, width: 100, height: 100 },
			200,
			200,
			0,
		);
		expect(next.scale).toBe(2);
		expect(next.x).toBe(-100);
		expect(next.y).toBe(-40);
	});

	test("touch helpers", () => {
		expect(
			touchDistance({ clientX: 0, clientY: 0 }, { clientX: 3, clientY: 4 }),
		).toBe(5);
		expect(
			touchMidpoint({ clientX: 0, clientY: 2 }, { clientX: 4, clientY: 6 }),
		).toEqual({ x: 2, y: 4 });
	});
});
