import type { HardwareId } from "./config.ts";

export const GPIO_PATH = "/v1/gpio";

export const GPIO_RESERVED_PHYSICAL: Record<HardwareId, number[]> = {
	raspberrypi: [27, 28],
	orangepi: [],
};

export type GpioDir = "in" | "out";

export type HeaderPinType = "power" | "gnd" | "gpio";

export type HeaderPinDef = {
	physical: number;
	name: string;
	type: HeaderPinType;
	bcm?: number | null;
	alt?: string[];
	resolve?: "live";
};

export type GpioPinState = {
	physical: number;
	name: string;
	type: HeaderPinType;
	chip?: string;
	line?: number;
	dir?: GpioDir;
	value?: 0 | 1;
	reserved?: boolean;
	unresolved?: boolean;
};

export type GpioSnapshot = {
	hardware: HardwareId;
	pins: GpioPinState[];
};

export type GpioPut = {
	physical: number;
	dir: GpioDir;
	value?: 0 | 1;
};

export class GpioError extends Error {
	readonly status = 400;

	constructor(message: string) {
		super(message);
		this.name = "GpioError";
	}
}

const RASPBERRYPI_PINS: HeaderPinDef[] = [
	{ physical: 1, name: "3V3", type: "power" },
	{ physical: 2, name: "5V", type: "power" },
	{ physical: 3, name: "GPIO2", type: "gpio", bcm: 2, alt: ["I2C1_SDA"] },
	{ physical: 4, name: "5V", type: "power" },
	{ physical: 5, name: "GPIO3", type: "gpio", bcm: 3, alt: ["I2C1_SCL"] },
	{ physical: 6, name: "GND", type: "gnd" },
	{ physical: 7, name: "GPIO4", type: "gpio", bcm: 4, alt: ["GPCLK0"] },
	{ physical: 8, name: "GPIO14", type: "gpio", bcm: 14, alt: ["UART0_TXD"] },
	{ physical: 9, name: "GND", type: "gnd" },
	{ physical: 10, name: "GPIO15", type: "gpio", bcm: 15, alt: ["UART0_RXD"] },
	{ physical: 11, name: "GPIO17", type: "gpio", bcm: 17 },
	{
		physical: 12,
		name: "GPIO18",
		type: "gpio",
		bcm: 18,
		alt: ["PCM_CLK", "PWM0"],
	},
	{ physical: 13, name: "GPIO27", type: "gpio", bcm: 27 },
	{ physical: 14, name: "GND", type: "gnd" },
	{ physical: 15, name: "GPIO22", type: "gpio", bcm: 22 },
	{ physical: 16, name: "GPIO23", type: "gpio", bcm: 23 },
	{ physical: 17, name: "3V3", type: "power" },
	{ physical: 18, name: "GPIO24", type: "gpio", bcm: 24 },
	{ physical: 19, name: "GPIO10", type: "gpio", bcm: 10, alt: ["SPI0_MOSI"] },
	{ physical: 20, name: "GND", type: "gnd" },
	{ physical: 21, name: "GPIO9", type: "gpio", bcm: 9, alt: ["SPI0_MISO"] },
	{ physical: 22, name: "GPIO25", type: "gpio", bcm: 25 },
	{ physical: 23, name: "GPIO11", type: "gpio", bcm: 11, alt: ["SPI0_SCLK"] },
	{ physical: 24, name: "GPIO8", type: "gpio", bcm: 8, alt: ["SPI0_CE0"] },
	{ physical: 25, name: "GND", type: "gnd" },
	{ physical: 26, name: "GPIO7", type: "gpio", bcm: 7, alt: ["SPI0_CE1"] },
	{
		physical: 27,
		name: "GPIO0",
		type: "gpio",
		bcm: 0,
		alt: ["ID_SD", "EEPROM_SDA"],
	},
	{
		physical: 28,
		name: "GPIO1",
		type: "gpio",
		bcm: 1,
		alt: ["ID_SC", "EEPROM_SCL"],
	},
	{ physical: 29, name: "GPIO5", type: "gpio", bcm: 5 },
	{ physical: 30, name: "GND", type: "gnd" },
	{ physical: 31, name: "GPIO6", type: "gpio", bcm: 6 },
	{ physical: 32, name: "GPIO12", type: "gpio", bcm: 12, alt: ["PWM0"] },
	{ physical: 33, name: "GPIO13", type: "gpio", bcm: 13, alt: ["PWM1"] },
	{ physical: 34, name: "GND", type: "gnd" },
	{
		physical: 35,
		name: "GPIO19",
		type: "gpio",
		bcm: 19,
		alt: ["PCM_FS", "SPI1_MISO"],
	},
	{ physical: 36, name: "GPIO16", type: "gpio", bcm: 16, alt: ["SPI1_CE2"] },
	{ physical: 37, name: "GPIO26", type: "gpio", bcm: 26 },
	{
		physical: 38,
		name: "GPIO20",
		type: "gpio",
		bcm: 20,
		alt: ["PCM_DIN", "SPI1_MOSI"],
	},
	{ physical: 39, name: "GND", type: "gnd" },
	{
		physical: 40,
		name: "GPIO21",
		type: "gpio",
		bcm: 21,
		alt: ["PCM_DOUT", "SPI1_SCLK"],
	},
];

const ORANGEPI_PINS: HeaderPinDef[] = [
	{ physical: 1, name: "3V3", type: "power" },
	{ physical: 2, name: "5V", type: "power" },
	{ physical: 3, name: "SDA", type: "gpio", resolve: "live" },
	{ physical: 4, name: "5V", type: "power" },
	{ physical: 5, name: "SCL", type: "gpio", resolve: "live" },
	{ physical: 6, name: "GND", type: "gnd" },
	{ physical: 7, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 8, name: "TXD", type: "gpio", resolve: "live" },
	{ physical: 9, name: "GND", type: "gnd" },
	{ physical: 10, name: "RXD", type: "gpio", resolve: "live" },
	{ physical: 11, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 12, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 13, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 14, name: "GND", type: "gnd" },
	{ physical: 15, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 16, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 17, name: "3V3", type: "power" },
	{ physical: 18, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 19, name: "MOSI", type: "gpio", resolve: "live" },
	{ physical: 20, name: "GND", type: "gnd" },
	{ physical: 21, name: "MISO", type: "gpio", resolve: "live" },
	{ physical: 22, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 23, name: "SCLK", type: "gpio", resolve: "live" },
	{ physical: 24, name: "CE0", type: "gpio", resolve: "live" },
	{ physical: 25, name: "GND", type: "gnd" },
	{ physical: 26, name: "CE1", type: "gpio", resolve: "live" },
	{ physical: 27, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 28, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 29, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 30, name: "GND", type: "gnd" },
	{ physical: 31, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 32, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 33, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 34, name: "GND", type: "gnd" },
	{ physical: 35, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 36, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 37, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 38, name: "GPIO", type: "gpio", resolve: "live" },
	{ physical: 39, name: "GND", type: "gnd" },
	{ physical: 40, name: "GPIO", type: "gpio", resolve: "live" },
];

const HEADER_PINS: Record<HardwareId, HeaderPinDef[]> = {
	raspberrypi: RASPBERRYPI_PINS,
	orangepi: ORANGEPI_PINS,
};

export function headerPins(hardware: HardwareId): HeaderPinDef[] {
	return HEADER_PINS[hardware];
}

export function headerPin(
	hardware: HardwareId,
	physical: number,
): HeaderPinDef | undefined {
	return HEADER_PINS[hardware].find((pin) => pin.physical === physical);
}

export function headerPinPairs(): Array<{ odd: number; even: number }> {
	const pairs: Array<{ odd: number; even: number }> = [];
	for (let physical = 1; physical <= 40; physical += 2) {
		pairs.push({ odd: physical, even: physical + 1 });
	}
	return pairs;
}

export function pinByPhysical(
	pins: GpioPinState[],
	physical: number,
): GpioPinState | undefined {
	return pins.find((pin) => pin.physical === physical);
}

export function canDriveGpio(pin: GpioPinState): boolean {
	return pin.type === "gpio" && !pin.reserved && !pin.unresolved;
}

export type GpioPinTone =
	| "power"
	| "gnd"
	| "reserved"
	| "unresolved"
	| "high"
	| "low"
	| "idle";

export function gpioPinTone(pin: GpioPinState): GpioPinTone {
	if (pin.type === "power") {
		return "power";
	}
	if (pin.type === "gnd") {
		return "gnd";
	}
	if (pin.reserved) {
		return "reserved";
	}
	if (pin.unresolved) {
		return "unresolved";
	}
	if (pin.value === 1) {
		return "high";
	}
	if (pin.value === 0) {
		return "low";
	}
	return "idle";
}

export function parsePhysicalPin(value: unknown): number {
	const physical =
		typeof value === "number"
			? value
			: Number.parseInt(String(value ?? ""), 10);
	if (!Number.isInteger(physical) || physical < 1 || physical > 40) {
		throw new GpioError("physical pin must be 1-40");
	}
	return physical;
}

export function assertGpioDrive(
	hardware: HardwareId,
	physical: number,
): HeaderPinDef {
	const pin = headerPin(hardware, physical);
	if (!pin) {
		throw new GpioError(`unknown physical pin ${physical}`);
	}
	if (pin.type !== "gpio") {
		throw new GpioError(`pin ${physical} is ${pin.type}, not gpio`);
	}
	if (GPIO_RESERVED_PHYSICAL[hardware].includes(physical)) {
		throw new GpioError(`pin ${physical} is reserved`);
	}
	return pin;
}

export function parseGpioPut(input: unknown): GpioPut {
	if (input === null || typeof input !== "object") {
		throw new GpioError("gpio must be an object");
	}
	const record = input as Record<string, unknown>;
	const physical = parsePhysicalPin(record.physical);
	const dir = parseDir(record.dir, record.value);
	const put: GpioPut = { physical, dir };
	if (record.value !== undefined) {
		put.value = parseValue(record.value);
	} else if (dir === "out") {
		throw new GpioError("value is required for output");
	}
	return put;
}

export function gpioNamedLine(bcm: number): string {
	return `GPIO${bcm}`;
}

function parseDir(dir: unknown, value: unknown): GpioDir {
	if (dir === undefined || dir === "") {
		return value === undefined ? "in" : "out";
	}
	if (dir === "in" || dir === "out") {
		return dir;
	}
	throw new GpioError("dir must be in or out");
}

function parseValue(value: unknown): 0 | 1 {
	if (value === 0 || value === "0" || value === false) {
		return 0;
	}
	if (value === 1 || value === "1" || value === true) {
		return 1;
	}
	throw new GpioError("value must be 0 or 1");
}
