import { describe, expect, test } from "bun:test";
import {
	familyFallbackSeed,
	normalizeBoardModel,
	parseBoardSeedManifest,
	resolveBoardSeed,
} from "./board-seeds.ts";

const manifest = parseBoardSeedManifest({
	boards: [
		{
			slug: "orangepi-3-lts",
			dir: "boards/orangepi-3-lts",
			hardware: "orangepi",
			match: ["orange pi 3 lts"],
			exact: true,
		},
		{
			slug: "raspberrypi",
			dir: "boards/raspberrypi",
			hardware: "raspberrypi",
			match: ["raspberry pi"],
			exact: false,
		},
		{
			slug: "orangepi",
			dir: "boards/orangepi",
			hardware: "orangepi",
			match: ["orange pi"],
			exact: false,
		},
	],
});

describe("board seeds", () => {
	test("exact SKU wins over family fallback", () => {
		const seed = resolveBoardSeed(manifest, "Orange Pi 3 LTS");
		expect(seed?.slug).toBe("orangepi-3-lts");
		expect(seed?.exact).toBe(true);
	});

	test("unknown Orange Pi SKU falls back to the orangepi family", () => {
		const seed = resolveBoardSeed(manifest, "Orange Pi 5 Plus");
		expect(seed?.slug).toBe("orangepi");
		expect(seed?.exact).toBe(false);
	});

	test("raspberry pi matches its family entry", () => {
		const seed = resolveBoardSeed(manifest, "Raspberry Pi 4 Model B Rev 1.5");
		expect(seed?.slug).toBe("raspberrypi");
	});

	test("never falls back across families", () => {
		expect(resolveBoardSeed(manifest, "Banana Pi M5")).toBeNull();
		expect(resolveBoardSeed(manifest, "")).toBeNull();
	});

	test("model normalization ignores case and whitespace runs", () => {
		expect(normalizeBoardModel("  ORANGE   PI 3  LTS ")).toBe(
			"orange pi 3 lts",
		);
		expect(resolveBoardSeed(manifest, "  ORANGE   PI 3  LTS ")?.slug).toBe(
			"orangepi-3-lts",
		);
	});

	test("familyFallbackSeed finds the non-exact entry per hardware", () => {
		expect(familyFallbackSeed(manifest, "orangepi")?.slug).toBe("orangepi");
		expect(familyFallbackSeed(manifest, "raspberrypi")?.slug).toBe(
			"raspberrypi",
		);
		expect(familyFallbackSeed(manifest, "bananapi")).toBeNull();
	});

	test("parseBoardSeedManifest rejects malformed manifests", () => {
		expect(() => parseBoardSeedManifest({})).toThrow();
		expect(() => parseBoardSeedManifest({ boards: [] })).toThrow();
		expect(() =>
			parseBoardSeedManifest({
				boards: [
					{ slug: "x", dir: "d", hardware: "h", match: [], exact: true },
				],
			}),
		).toThrow();
		expect(() =>
			parseBoardSeedManifest({
				boards: [
					{ slug: "x", dir: "d", hardware: "h", match: ["x"], exact: false },
					{ slug: "x", dir: "d", hardware: "h", match: ["x"], exact: false },
				],
			}),
		).toThrow();
	});
});
