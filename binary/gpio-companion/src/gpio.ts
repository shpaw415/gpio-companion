import {
	assertGpioDrive,
	GPIO_RESERVED_PHYSICAL,
	type GpioDir,
	GpioError,
	type GpioPinState,
	type GpioPut,
	type GpioSnapshot,
	gpioNamedLine,
	type HardwareId,
	headerPins,
} from "gpio-companion";

export type GpioInfoLine = {
	chip: string;
	line: number;
	name: string;
	dir?: GpioDir;
};

export type GpioLineRef = {
	chip: string;
	line: number;
	name: string;
};

export type GpioBackend = {
	gpioinfo(): Promise<string>;
	readall(): Promise<string>;
	get(ref: GpioLineRef): Promise<{ dir: GpioDir; value: 0 | 1 }>;
	set(ref: GpioLineRef, dir: GpioDir, value?: 0 | 1): Promise<void>;
};

export type GpioController = {
	snapshot(hardware: HardwareId): Promise<GpioSnapshot>;
	apply(hardware: HardwareId, put: GpioPut): Promise<GpioSnapshot>;
};

export function parseGpioinfo(text: string): GpioInfoLine[] {
	const lines: GpioInfoLine[] = [];
	let chip = "";
	for (const raw of text.split("\n")) {
		const chipMatch = /^(gpiochip\d+)\b/.exec(raw.trim());
		if (chipMatch?.[1]) {
			chip = chipMatch[1];
			continue;
		}
		const lineMatch = /^\s*line\s+(\d+):\s+"?([^"\s]+)"?\s+(.*)$/.exec(raw);
		if (!chip || !lineMatch) {
			continue;
		}
		const offset = Number(lineMatch[1]);
		const name = (lineMatch[2] ?? "").trim();
		const rest = (lineMatch[3] ?? "").toLowerCase();
		const dir: GpioDir | undefined = rest.includes("output")
			? "out"
			: rest.includes("input")
				? "in"
				: undefined;
		if (!Number.isInteger(offset) || !name || name === "unnamed") {
			continue;
		}
		lines.push({ chip, line: offset, name, dir });
	}
	return lines;
}

export function parseWiringOpReadall(text: string): Map<number, string> {
	const names = new Map<number, string>();
	for (const raw of text.split("\n")) {
		if (!raw.includes("||")) {
			continue;
		}
		const [left, right] = raw.split("||");
		addReadallSide(names, left ?? "", "left");
		addReadallSide(names, right ?? "", "right");
	}
	return names;
}

export function resolveHeaderLines(
	hardware: HardwareId,
	gpioinfoText: string,
	readallText = "",
): Map<number, GpioLineRef> {
	const info = parseGpioinfo(gpioinfoText);
	const byName = new Map<string, GpioInfoLine>();
	for (const line of info) {
		byName.set(normalizeLineName(line.name), line);
	}
	const wiringNames = parseWiringOpReadall(readallText);
	const resolved = new Map<number, GpioLineRef>();
	for (const pin of headerPins(hardware)) {
		if (pin.type !== "gpio") {
			continue;
		}
		const ref = resolvePinLine(
			hardware,
			pin.physical,
			pin,
			byName,
			wiringNames,
		);
		if (ref) {
			resolved.set(pin.physical, {
				chip: ref.chip,
				line: ref.line,
				name: ref.name,
			});
		}
	}
	return resolved;
}

export function createGpioController(backend: GpioBackend): GpioController {
	return {
		async snapshot(hardware) {
			return readSnapshot(hardware, backend);
		},
		async apply(hardware, put) {
			const pin = assertGpioDrive(hardware, put.physical);
			const { gpioinfoText, readallText } = await probe(backend);
			const ref = resolveHeaderLines(hardware, gpioinfoText, readallText).get(
				put.physical,
			);
			if (!ref) {
				throw new GpioError(
					pin.resolve === "live"
						? `pin ${put.physical} is unresolved`
						: `pin ${put.physical} line not found`,
				);
			}
			await backend.set(ref, put.dir, put.value);
			return readSnapshot(hardware, backend, gpioinfoText, readallText);
		},
	};
}

export function createLibgpiodGpio(): GpioController {
	return createGpioController({
		gpioinfo: () => spawnText(["gpioinfo"]),
		readall: () => spawnText(["gpio", "readall"]).catch(() => ""),
		async get(ref) {
			const text = await spawnGpioGet(ref);
			return parseGpioGet(text);
		},
		async set(ref, dir, value) {
			if (dir === "in") {
				await spawnGpioGet(ref);
				return;
			}
			if (value !== 0 && value !== 1) {
				throw new GpioError("value is required for output");
			}
			await spawnGpioSet(ref, value);
		},
	});
}

export function memoryGpioBackend(
	infoText: string,
	readallText = "",
	values: Record<string, 0 | 1> = {},
): GpioBackend {
	const state = new Map<string, { dir: GpioDir; value: 0 | 1 }>();
	for (const line of parseGpioinfo(infoText)) {
		const key = lineKey(line);
		state.set(key, { dir: line.dir ?? "in", value: values[key] ?? 0 });
	}
	return {
		async gpioinfo() {
			return infoText;
		},
		async readall() {
			return readallText;
		},
		async get(ref) {
			return state.get(lineKey(ref)) ?? { dir: "in", value: 0 };
		},
		async set(ref, dir, value) {
			state.set(lineKey(ref), {
				dir,
				value: dir === "out" ? (value ?? 0) : 0,
			});
		},
	};
}

async function readSnapshot(
	hardware: HardwareId,
	backend: GpioBackend,
	gpioinfoText?: string,
	readallText?: string,
): Promise<GpioSnapshot> {
	const infoText = gpioinfoText ?? (await backend.gpioinfo());
	const wiringText =
		readallText ?? (hardware === "orangepi" ? await backend.readall() : "");
	const resolved = resolveHeaderLines(hardware, infoText, wiringText);
	const pins: GpioPinState[] = [];
	for (const def of headerPins(hardware)) {
		const reserved = GPIO_RESERVED_PHYSICAL[hardware].includes(def.physical);
		const ref = resolved.get(def.physical);
		if (def.type !== "gpio") {
			pins.push({
				physical: def.physical,
				name: def.name,
				type: def.type,
			});
			continue;
		}
		if (!ref) {
			pins.push({
				physical: def.physical,
				name: def.name,
				type: "gpio",
				reserved,
				unresolved: !reserved,
			});
			continue;
		}
		let live: { dir: GpioDir; value: 0 | 1 } | undefined;
		try {
			live = await backend.get(ref);
		} catch {
			live = undefined;
		}
		pins.push({
			physical: def.physical,
			name: def.name,
			type: "gpio",
			chip: ref.chip,
			line: ref.line,
			dir: live?.dir,
			value: live?.value,
			reserved,
		});
	}
	return { hardware, pins };
}

async function probe(backend: GpioBackend): Promise<{
	gpioinfoText: string;
	readallText: string;
}> {
	return {
		gpioinfoText: await backend.gpioinfo(),
		readallText: await backend.readall().catch(() => ""),
	};
}

function resolvePinLine(
	hardware: HardwareId,
	physical: number,
	pin: { name: string; bcm?: number | null; resolve?: "live" },
	byName: Map<string, GpioInfoLine>,
	wiringNames: Map<number, string>,
): GpioLineRef | undefined {
	if (hardware === "raspberrypi" && pin.bcm != null) {
		const named = byName.get(normalizeLineName(gpioNamedLine(pin.bcm)));
		if (named) {
			return named;
		}
		const fallback = [...byName.values()].find(
			(line) => line.chip === "gpiochip0" && line.line === pin.bcm,
		);
		if (fallback) {
			return fallback;
		}
	}
	const wiring = wiringNames.get(physical);
	if (wiring) {
		const named = byName.get(normalizeLineName(wiring));
		if (named) {
			return named;
		}
	}
	if (pin.name !== "GPIO") {
		const exact = byName.get(normalizeLineName(pin.name));
		if (exact) {
			return exact;
		}
		for (const [name, line] of byName) {
			if (name.includes(normalizeLineName(pin.name))) {
				return line;
			}
		}
	}
	return undefined;
}

function addReadallSide(
	names: Map<number, string>,
	side: string,
	which: "left" | "right",
) {
	const fields = side.split("|").map((part) => part.trim());
	const cells = fields.filter((part) => part.length > 0);
	if (cells.length < 2) {
		return;
	}
	if (which === "left") {
		const physical = Number(cells[cells.length - 1]);
		const name = cells[2] ?? "";
		if (Number.isInteger(physical) && isGpioName(name)) {
			names.set(physical, name);
		}
		return;
	}
	const physical = Number(cells[0]);
	const name = cells[3] ?? cells[2] ?? "";
	if (Number.isInteger(physical) && isGpioName(name)) {
		names.set(physical, name);
	}
}

function isGpioName(name: string): boolean {
	const trimmed = name.trim();
	if (!trimmed) {
		return false;
	}
	const lower = trimmed.toLowerCase();
	return !(
		lower.includes("3.3") ||
		lower.includes("5v") ||
		lower === "0v" ||
		lower === "gnd"
	);
}

function normalizeLineName(name: string): string {
	return name.trim().toUpperCase().replace(/[.\s]/g, "");
}

function lineKey(ref: { chip: string; line: number }): string {
	return `${ref.chip}:${ref.line}`;
}

function parseGpioGet(text: string): { dir: GpioDir; value: 0 | 1 } {
	const match = /\b([01])\b/.exec(text.trim());
	if (!match) {
		throw new GpioError("gpioget returned no value");
	}
	return { dir: "in", value: match[1] === "1" ? 1 : 0 };
}

async function spawnGpioGet(ref: GpioLineRef): Promise<string> {
	try {
		return await spawnText(["gpioget", "-c", ref.chip, String(ref.line)]);
	} catch {
		return spawnText(["gpioget", ref.chip, String(ref.line)]);
	}
}

async function spawnGpioSet(ref: GpioLineRef, value: 0 | 1): Promise<void> {
	try {
		await spawnText(["gpioset", "-c", ref.chip, `${ref.line}=${value}`]);
	} catch {
		await spawnText(["gpioset", ref.chip, `${ref.line}=${value}`]);
	}
}

async function spawnText(cmd: string[]): Promise<string> {
	const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, code] = await Promise.all([
		readPipe(proc.stdout),
		readPipe(proc.stderr),
		proc.exited,
	]);
	if (code !== 0) {
		throw new GpioError(stderr.trim() || stdout.trim() || `${cmd[0]} failed`);
	}
	return stdout;
}

async function readPipe(
	stream: ReadableStream<Uint8Array> | number | undefined,
): Promise<string> {
	if (!stream || typeof stream === "number") {
		return "";
	}
	return new Response(stream).text();
}
