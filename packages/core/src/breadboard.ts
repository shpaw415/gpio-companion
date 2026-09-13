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
export const BREADBOARD_LEFT_COLS = ["a", "b", "c", "d", "e"] as const;
export const BREADBOARD_RIGHT_COLS = ["f", "g", "h", "i", "j"] as const;
export const BREADBOARD_RAILS = ["tp", "tn", "bn", "bp"] as const;

export type Point = { x: number; y: number };

export type PartPlacement = {
	origin: Point;
	rotate: number;
};

export type PartPinInfo = { name: string; x: number; y: number };

const FALLBACK_PIN_INFO: Record<string, PartPinInfo[]> = {
	"wokwi-led": [
		{ name: "A", x: 25, y: 42 },
		{ name: "C", x: 15, y: 42 },
	],
	"wokwi-resistor": [
		{ name: "1", x: 0, y: 5.65 },
		{ name: "2", x: 58.8, y: 5.65 },
	],
	"wokwi-pushbutton": [
		{ name: "1.l", x: 0, y: 13 },
		{ name: "2.l", x: 0, y: 32 },
		{ name: "1.r", x: 67, y: 13 },
		{ name: "2.r", x: 67, y: 32 },
	],
};

export function breadboardRows(type: string): number {
	if (type === "wokwi-breadboard") {
		return 63;
	}
	if (type === "wokwi-breadboard-mini") {
		return 17;
	}
	return 30;
}

export function breadboardHasRails(type: string): boolean {
	return type !== "wokwi-breadboard-mini";
}

function colX(type: string, col: string): number | null {
	const rails = breadboardHasRails(type);
	const left0 = rails ? 4.5 : 1.5;
	const right0 = rails ? 11.5 : 8.5;
	const leftIndex = (BREADBOARD_LEFT_COLS as readonly string[]).indexOf(col);
	if (leftIndex >= 0) {
		return BREADBOARD_PITCH * (left0 + leftIndex);
	}
	const rightIndex = (BREADBOARD_RIGHT_COLS as readonly string[]).indexOf(col);
	if (rightIndex >= 0) {
		return BREADBOARD_PITCH * (right0 + rightIndex);
	}
	return null;
}

function rowY(row: number): number {
	return BREADBOARD_PITCH * (2.5 + (row - 1));
}

function railX(side: string, polarity: string): number {
	if (side === "t") {
		return BREADBOARD_PITCH * (polarity === "p" ? 1.5 : 2.5);
	}
	return BREADBOARD_PITCH * (polarity === "p" ? 18.5 : 17.5);
}

export function breadboardSize(type: string): {
	width: number;
	height: number;
} {
	const rows = breadboardRows(type);
	return {
		width: BREADBOARD_PITCH * (breadboardHasRails(type) ? 20 : 14.5),
		height: BREADBOARD_PITCH * (rows + 4),
	};
}

export function breadboardPinNames(type: string): string[] {
	const rows = breadboardRows(type);
	const names: string[] = [];
	for (let row = 1; row <= rows; row += 1) {
		for (const col of "abcdefghij") {
			names.push(`${row}${col}`);
		}
	}
	if (breadboardHasRails(type)) {
		for (const rail of BREADBOARD_RAILS) {
			for (let index = 1; index <= rows; index += 1) {
				names.push(`${rail}.${index}`);
			}
		}
	}
	return names;
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
		const x = colX(type, col);
		if (x === null) {
			return null;
		}
		return { x, y: rowY(row) };
	}
	if (!breadboardHasRails(type)) {
		return null;
	}
	const rail = pin.match(/^([tb])([pn])\.(\d+)$/i);
	if (!rail) {
		return null;
	}
	const side = rail[1]?.toLowerCase() ?? "";
	const polarity = rail[2]?.toLowerCase() ?? "";
	const index = Number(rail[3]);
	const rows = breadboardRows(type);
	if (index < 1 || index > rows) {
		return null;
	}
	return { x: railX(side, polarity), y: rowY(index) };
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

export function partPinsFor(
	type: string,
	pinInfo?: PartPinInfo[],
): PartPinInfo[] {
	return pinInfo?.length ? pinInfo : (FALLBACK_PIN_INFO[type] ?? []);
}

export function boardPinAbsolute(board: WokwiPart, pin: string): Point | null {
	const offset = breadboardPinOffset(board.type, pin);
	if (!offset) {
		return null;
	}
	const origin = partOrigin(board);
	const rotated = rotatePoint(offset, board.rotate ?? 0);
	return { x: origin.x + rotated.x, y: origin.y + rotated.y };
}

export function snapPartPlacement(
	part: WokwiPart,
	diagram: WokwiDiagram,
	pinInfo?: PartPinInfo[],
): PartPlacement {
	if (isBreadboardType(part.type) || part.type === GPIO_COMPANION_HEADER_TYPE) {
		return { origin: partOrigin(part), rotate: part.rotate ?? 0 };
	}
	const anchors = breadboardAnchors(part, diagram);
	if (!anchors.length) {
		return { origin: partOrigin(part), rotate: part.rotate ?? 0 };
	}
	const pins = partPinsFor(part.type, pinInfo);
	const first = anchors[0];
	if (!first) {
		return { origin: partOrigin(part), rotate: part.rotate ?? 0 };
	}
	const firstLocal = pins.find((item) => item.name === first.pin) ?? {
		name: first.pin,
		x: 0,
		y: 0,
	};
	let rotate = part.rotate ?? 0;
	const second = anchors.find((item) => item.pin !== first.pin);
	const secondLocal = second
		? pins.find((item) => item.name === second.pin)
		: undefined;
	if (second && secondLocal) {
		const pinAngle = Math.atan2(
			secondLocal.y - firstLocal.y,
			secondLocal.x - firstLocal.x,
		);
		const holeAngle = Math.atan2(
			second.hole.y - first.hole.y,
			second.hole.x - first.hole.x,
		);
		rotate = ((holeAngle - pinAngle) * 180) / Math.PI;
	}
	const rotated = rotatePoint({ x: firstLocal.x, y: firstLocal.y }, rotate);
	return {
		origin: {
			x: first.hole.x - rotated.x,
			y: first.hole.y - rotated.y,
		},
		rotate,
	};
}

function breadboardAnchors(
	part: WokwiPart,
	diagram: WokwiDiagram,
): { pin: string; hole: Point }[] {
	const boards = new Map(
		diagram.parts
			.filter((item) => isBreadboardType(item.type))
			.map((item) => [item.id, item] as const),
	);
	const seen = new Set<string>();
	const anchors: { pin: string; hole: Point }[] = [];
	for (const connection of diagram.connections) {
		const [from, to] = connection;
		if (typeof from !== "string" || typeof to !== "string") {
			continue;
		}
		const start = splitEndpoint(from);
		const end = splitEndpoint(to);
		const hit =
			start.partId === part.id && boards.has(end.partId)
				? { pin: start.pin, board: boards.get(end.partId), holePin: end.pin }
				: end.partId === part.id && boards.has(start.partId)
					? {
							pin: end.pin,
							board: boards.get(start.partId),
							holePin: start.pin,
						}
					: null;
		if (!hit?.board || seen.has(hit.pin)) {
			continue;
		}
		const hole = boardPinAbsolute(hit.board, hit.holePin);
		if (!hole) {
			continue;
		}
		seen.add(hit.pin);
		anchors.push({ pin: hit.pin, hole });
	}
	return anchors;
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
