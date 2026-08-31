export const BREADBOARD_DIAGRAM_JSON = "breadboard/diagram.json";
export const GPIO_COMPANION_HEADER_TYPE = "gpio-companion-header";
export const WOKWI_BREADBOARD_TYPES = [
	"wokwi-breadboard",
	"wokwi-breadboard-half",
	"wokwi-breadboard-mini",
] as const;

export type WokwiPart = {
	id: string;
	type: string;
	left?: number;
	top?: number;
	rotate?: number;
	hide?: boolean;
	attrs?: Record<string, string>;
};

export type WokwiConnection = [string, string, string, string[]];

export type BreadboardStep = {
	text: string;
	highlight?: string[];
};

export type WokwiDiagram = {
	version: 1;
	author?: string;
	editor?: string;
	parts: WokwiPart[];
	connections: WokwiConnection[];
	steps?: BreadboardStep[];
};

export class BreadboardError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BreadboardError";
	}
}

export function parseWokwiDiagram(input: unknown): WokwiDiagram {
	if (typeof input === "string") {
		try {
			input = JSON.parse(input) as unknown;
		} catch {
			throw new BreadboardError("breadboard diagram is not valid JSON");
		}
	}
	if (!input || typeof input !== "object") {
		throw new BreadboardError("breadboard diagram must be an object");
	}
	const raw = input as Record<string, unknown>;
	if (raw.version !== 1) {
		throw new BreadboardError("breadboard diagram version must be 1");
	}
	if (!Array.isArray(raw.parts) || raw.parts.length === 0) {
		throw new BreadboardError("breadboard diagram needs parts");
	}
	if (!Array.isArray(raw.connections)) {
		throw new BreadboardError("breadboard diagram needs connections");
	}
	const parts = raw.parts.map((part, index) => parsePart(part, index));
	const ids = new Set<string>();
	for (const part of parts) {
		if (ids.has(part.id)) {
			throw new BreadboardError(`duplicate part id ${part.id}`);
		}
		ids.add(part.id);
	}
	if (!parts.some((part) => isBreadboardType(part.type))) {
		throw new BreadboardError(
			"diagram needs a wokwi-breadboard, wokwi-breadboard-half, or wokwi-breadboard-mini part",
		);
	}
	const connections = raw.connections.map((item, index) =>
		parseConnection(item, index, ids),
	);
	return {
		version: 1,
		author: optionalString(raw.author),
		editor: optionalString(raw.editor) ?? "gpio-companion",
		parts,
		connections,
		steps: parseSteps(raw.steps),
	};
}

export function isBreadboardType(type: string): boolean {
	return (WOKWI_BREADBOARD_TYPES as readonly string[]).includes(type);
}

export function splitEndpoint(value: string): { partId: string; pin: string } {
	const index = value.indexOf(":");
	if (index <= 0 || index === value.length - 1) {
		throw new BreadboardError(`invalid connection endpoint ${value}`);
	}
	return { partId: value.slice(0, index), pin: value.slice(index + 1) };
}

function parsePart(input: unknown, index: number): WokwiPart {
	if (!input || typeof input !== "object") {
		throw new BreadboardError(`part ${index} must be an object`);
	}
	const raw = input as Record<string, unknown>;
	if (typeof raw.id !== "string" || !raw.id.trim()) {
		throw new BreadboardError(`part ${index} needs id`);
	}
	if (typeof raw.type !== "string" || !raw.type.trim()) {
		throw new BreadboardError(`part ${raw.id} needs type`);
	}
	if (raw.type === GPIO_COMPANION_HEADER_TYPE) {
		const hardware =
			raw.attrs && typeof raw.attrs === "object"
				? (raw.attrs as Record<string, unknown>).hardware
				: undefined;
		if (hardware !== "raspberrypi" && hardware !== "orangepi") {
			throw new BreadboardError(
				`${GPIO_COMPANION_HEADER_TYPE} ${raw.id} needs attrs.hardware raspberrypi or orangepi`,
			);
		}
	}
	return {
		id: raw.id.trim(),
		type: raw.type.trim(),
		left: optionalNumber(raw.left),
		top: optionalNumber(raw.top),
		rotate: optionalNumber(raw.rotate),
		hide: typeof raw.hide === "boolean" ? raw.hide : undefined,
		attrs: parseAttrs(raw.attrs),
	};
}

function parseConnection(
	input: unknown,
	index: number,
	ids: Set<string>,
): WokwiConnection {
	if (!Array.isArray(input) || input.length < 3) {
		throw new BreadboardError(
			`connection ${index} must be [from, to, color, wires?]`,
		);
	}
	const from = input[0];
	const to = input[1];
	const color = input[2];
	const wires = input[3];
	if (typeof from !== "string" || typeof to !== "string") {
		throw new BreadboardError(`connection ${index} endpoints must be strings`);
	}
	if (typeof color !== "string") {
		throw new BreadboardError(`connection ${index} color must be a string`);
	}
	const start = splitEndpoint(from);
	const end = splitEndpoint(to);
	if (!ids.has(start.partId) || !ids.has(end.partId)) {
		throw new BreadboardError(
			`connection ${index} references unknown part ${start.partId} or ${end.partId}`,
		);
	}
	const instructions = Array.isArray(wires)
		? wires.filter((item): item is string => typeof item === "string")
		: [];
	return [from, to, color, instructions];
}

function parseSteps(input: unknown): BreadboardStep[] | undefined {
	if (input === undefined) {
		return undefined;
	}
	if (!Array.isArray(input)) {
		throw new BreadboardError("steps must be an array");
	}
	return input.map((item, index) => {
		if (!item || typeof item !== "object") {
			throw new BreadboardError(`step ${index} must be an object`);
		}
		const raw = item as Record<string, unknown>;
		if (typeof raw.text !== "string" || !raw.text.trim()) {
			throw new BreadboardError(`step ${index} needs text`);
		}
		const highlight = Array.isArray(raw.highlight)
			? raw.highlight.filter(
					(value): value is string => typeof value === "string",
				)
			: undefined;
		return { text: raw.text.trim(), highlight };
	});
}

function parseAttrs(input: unknown): Record<string, string> | undefined {
	if (input === undefined) {
		return undefined;
	}
	if (!input || typeof input !== "object") {
		throw new BreadboardError("part attrs must be an object");
	}
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
		if (value === undefined || value === null) {
			continue;
		}
		out[key] = String(value);
	}
	return out;
}

function optionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

export const BREADBOARD_PITCH = 10;
export const HEADER_PIN_COUNT = 40;

export type Point = { x: number; y: number };

const LEFT_COLS = ["a", "b", "c", "d", "e"] as const;
const RIGHT_COLS = ["f", "g", "h", "i", "j"] as const;

export function breadboardRows(type: string): number {
	if (type === "wokwi-breadboard") {
		return 63;
	}
	if (type === "wokwi-breadboard-mini") {
		return 17;
	}
	return 30;
}

export function breadboardSize(type: string): {
	width: number;
	height: number;
} {
	const rows = breadboardRows(type);
	const width = BREADBOARD_PITCH * 18;
	const height = BREADBOARD_PITCH * (rows + 10);
	return { width, height };
}

export function headerSize(): { width: number; height: number } {
	return {
		width: BREADBOARD_PITCH * 4,
		height: BREADBOARD_PITCH * 22,
	};
}

export function breadboardPinOffset(type: string, pin: string): Point | null {
	const hole = pin.match(/^(\d+)([a-j])$/i);
	if (hole) {
		const row = Number(hole[1]);
		const col = hole[2]?.toLowerCase() ?? "";
		const rows = breadboardRows(type);
		if (row < 1 || row > rows) {
			return null;
		}
		const leftIndex = (LEFT_COLS as readonly string[]).indexOf(col);
		const rightIndex = (RIGHT_COLS as readonly string[]).indexOf(col);
		const originY = BREADBOARD_PITCH * 6 + (row - 1) * BREADBOARD_PITCH;
		if (leftIndex >= 0) {
			return { x: BREADBOARD_PITCH * (3 + leftIndex), y: originY };
		}
		if (rightIndex >= 0) {
			return { x: BREADBOARD_PITCH * (10 + rightIndex), y: originY };
		}
		return null;
	}
	const rail = pin.match(/^([tb])([pn])\.(\d+)$/i);
	if (!rail) {
		return null;
	}
	const side = rail[1]?.toLowerCase();
	const polarity = rail[2]?.toLowerCase();
	const index = Number(rail[3]);
	const rows = breadboardRows(type);
	const x = BREADBOARD_PITCH * (2 + Math.max(0, index - 1));
	const top =
		polarity === "p" ? BREADBOARD_PITCH * 1.5 : BREADBOARD_PITCH * 2.5;
	const bottom =
		polarity === "p"
			? BREADBOARD_PITCH * (rows + 7.5)
			: BREADBOARD_PITCH * (rows + 8.5);
	return { x, y: side === "t" ? top : bottom };
}

export function headerPinOffset(pin: string): Point | null {
	const number = Number(pin);
	if (!Number.isInteger(number) || number < 1 || number > HEADER_PIN_COUNT) {
		return null;
	}
	const row = Math.ceil(number / 2);
	const col = number % 2 === 1 ? 0 : 1;
	return {
		x: BREADBOARD_PITCH * (1 + col),
		y: BREADBOARD_PITCH * (1 + row),
	};
}

export function rotatePoint(point: Point, degrees: number): Point {
	if (!degrees) {
		return point;
	}
	const rad = (degrees * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	return {
		x: point.x * cos - point.y * sin,
		y: point.x * sin + point.y * cos,
	};
}

export function partOrigin(part: WokwiPart): Point {
	return { x: part.left ?? 0, y: part.top ?? 0 };
}

export function wirePath(
	from: Point,
	to: Point,
	instructions: string[],
): Point[] {
	const star = instructions.indexOf("*");
	const before = star === -1 ? instructions : instructions.slice(0, star);
	const after = star === -1 ? [] : instructions.slice(star + 1);
	const start: Point[] = [{ ...from }];
	let cursor = { ...from };
	for (const instruction of before) {
		cursor = applyWireMove(cursor, instruction);
		start.push({ ...cursor });
	}
	const end: Point[] = [];
	let tail = { ...to };
	for (const instruction of [...after].reverse()) {
		tail = applyWireMove(tail, instruction);
		end.unshift({ ...tail });
	}
	end.push({ ...to });
	const mid = elbow(cursor, end[0] ?? to);
	return [...start, ...mid, ...end];
}

function applyWireMove(point: Point, instruction: string): Point {
	const match = instruction.match(/^([vh])(-?\d+(?:\.\d+)?)$/i);
	if (!match) {
		return point;
	}
	const amount = Number(match[2]);
	if (match[1]?.toLowerCase() === "v") {
		return { x: point.x, y: point.y + amount };
	}
	return { x: point.x + amount, y: point.y };
}

function elbow(from: Point, to: Point): Point[] {
	if (from.x === to.x || from.y === to.y) {
		return [];
	}
	return [{ x: to.x, y: from.y }];
}
