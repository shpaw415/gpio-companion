import { normalizeBoardModel } from "./board-seeds.ts";

export type SkuGpioDomain = "pio" | "rpio";

export type SkuGpioLine = {
	physical: number;
	domain: SkuGpioDomain;
	line: number;
	name: string;
	soc?: string;
};

export type GpioChipSize = {
	name: string;
	lines: number;
};

export type SkuPinout = {
	slug: string;
	pinCount: number;
	lines: SkuGpioLine[];
};

const ORANGEPI_3_LTS_LINES: SkuGpioLine[] = [
	{ physical: 3, domain: "pio", line: 122, name: "SDA", soc: "PD26" },
	{ physical: 5, domain: "pio", line: 121, name: "SCL", soc: "PD25" },
	{ physical: 7, domain: "pio", line: 118, name: "GPIO", soc: "PD22" },
	{ physical: 8, domain: "rpio", line: 2, name: "TXD", soc: "PL2" },
	{ physical: 10, domain: "rpio", line: 3, name: "RXD", soc: "PL3" },
	{ physical: 11, domain: "pio", line: 120, name: "GPIO", soc: "PD24" },
	{ physical: 12, domain: "pio", line: 114, name: "GPIO", soc: "PD18" },
	{ physical: 13, domain: "pio", line: 119, name: "GPIO", soc: "PD23" },
	{ physical: 15, domain: "rpio", line: 10, name: "GPIO", soc: "PL10" },
	{ physical: 16, domain: "pio", line: 111, name: "GPIO", soc: "PD15" },
	{ physical: 18, domain: "pio", line: 112, name: "GPIO", soc: "PD16" },
	{ physical: 19, domain: "pio", line: 229, name: "MOSI", soc: "PH5" },
	{ physical: 21, domain: "pio", line: 230, name: "MISO", soc: "PH6" },
	{ physical: 22, domain: "pio", line: 117, name: "GPIO", soc: "PD21" },
	{ physical: 23, domain: "pio", line: 228, name: "SCLK", soc: "PH4" },
	{ physical: 24, domain: "pio", line: 227, name: "CE0", soc: "PH3" },
	{ physical: 26, domain: "rpio", line: 8, name: "CE1", soc: "PL8" },
];

export function skuPinout(model?: string): SkuPinout | null {
	if (!model?.trim()) {
		return null;
	}
	const normalized = normalizeBoardModel(model)
		.replace(/orangepi/g, "orange pi ")
		.replace(/[-_]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (normalized.includes("orange pi 3 lts")) {
		return {
			slug: "orangepi-3-lts",
			pinCount: 26,
			lines: ORANGEPI_3_LTS_LINES,
		};
	}
	return null;
}

export function parseGpioChips(text: string): GpioChipSize[] {
	const chips: GpioChipSize[] = [];
	for (const raw of text.split("\n")) {
		const match = /^(gpiochip\d+)\s*-\s*(\d+)\s+lines?/i.exec(raw.trim());
		if (match?.[1] && match[2]) {
			chips.push({ name: match[1], lines: Number(match[2]) });
		}
	}
	return chips;
}

export function resolveSkuChip(
	domain: SkuGpioDomain,
	chips: GpioChipSize[],
): string {
	if (chips.length === 0) {
		return domain === "rpio" ? "gpiochip0" : "gpiochip1";
	}
	const sorted = [...chips].sort((a, b) => b.lines - a.lines);
	const pio = sorted[0];
	const rpio = sorted[sorted.length - 1];
	if (domain === "pio") {
		return pio?.name ?? "gpiochip1";
	}
	return rpio?.name ?? "gpiochip0";
}
