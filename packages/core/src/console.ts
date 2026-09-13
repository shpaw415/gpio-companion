import { debugAuthQuery } from "./debug.ts";
import type { DeviceAuthHeaders } from "./device-auth.ts";

export const CONSOLE_PATH = "/v1/console";
export const CONSOLE_USB_PATH = "/v1/console/usb";
export const CONSOLE_USB_STOP_PATH = "/v1/console/usb/stop";
export const CONSOLE_LOG_MAX = 16 * 1024;
export const CONSOLE_MAX_SOCKETS = 8;
export const CONSOLE_FLUSH_MS = 50;
export const CONSOLE_USB_REOPEN_MS = 2_000;
export const CONSOLE_DEFAULT_BAUD = 115200;
export const CONSOLE_BAUDS = [9600, 19200, 38400, 57600, 115200] as const;

export type ConsoleSource = "host" | "usb";
export type ConsoleBaud = (typeof CONSOLE_BAUDS)[number];

export type ConsoleHostState = {
	running: boolean;
	log: string;
};

export type ConsoleUsbState = {
	open: boolean;
	port: string;
	baud: number;
	log: string;
};

export type ConsoleSnapshot = {
	host: ConsoleHostState;
	usb: ConsoleUsbState;
};

export type ConsoleChunk = {
	source: ConsoleSource;
	chunk: string;
};

export type ConsoleHostRunning = {
	source: "host";
	running: boolean;
};

export type ConsoleUsbOpen = {
	source: "usb";
	open: boolean;
	port: string;
	baud: number;
};

export type ConsoleWsError = {
	error: string;
};

export type ConsoleWsRefresh = {
	op: "refresh";
};

export type ConsoleFrame =
	| ConsoleSnapshot
	| ConsoleChunk
	| ConsoleHostRunning
	| ConsoleUsbOpen
	| ConsoleWsError;

export type ConsoleUsbPut = {
	port: string;
	baud: number;
};

export class ConsoleError extends Error {
	readonly status: 400 | 409;

	constructor(message: string, status: 400 | 409 = 400) {
		super(message);
		this.name = "ConsoleError";
		this.status = status;
	}
}

export function isConsolePath(path: string): boolean {
	return (
		path === CONSOLE_PATH ||
		path === CONSOLE_USB_PATH ||
		path === CONSOLE_USB_STOP_PATH
	);
}

export function consoleWsUrl(deviceUrl: string): string {
	const origin = deviceUrl.replace(/\/+$/, "");
	if (origin.startsWith("https://")) {
		return `wss://${origin.slice("https://".length)}${CONSOLE_PATH}`;
	}
	if (origin.startsWith("http://")) {
		return `ws://${origin.slice("http://".length)}${CONSOLE_PATH}`;
	}
	return `wss://${origin}${CONSOLE_PATH}`;
}

export function consoleWsConnectUrl(
	deviceUrl: string,
	headers: DeviceAuthHeaders,
): string {
	return `${consoleWsUrl(deviceUrl)}?${debugAuthQuery(headers)}`;
}

export function emptyConsoleSnapshot(): ConsoleSnapshot {
	return {
		host: { running: false, log: "" },
		usb: { open: false, port: "", baud: CONSOLE_DEFAULT_BAUD, log: "" },
	};
}

export function capConsoleLog(log: string): string {
	if (log.length <= CONSOLE_LOG_MAX) {
		return log;
	}
	return log.slice(log.length - CONSOLE_LOG_MAX);
}

export function parseConsoleUsbPut(input: unknown): ConsoleUsbPut {
	if (input === null || typeof input !== "object") {
		throw new ConsoleError("console usb must be an object");
	}
	const record = input as Record<string, unknown>;
	const port = requiredPort(record.port);
	return { port, baud: optionalBaud(record.baud) };
}

export function parseConsoleWsCommand(input: unknown): ConsoleWsRefresh {
	if (input === null || typeof input !== "object") {
		throw new ConsoleError("console command must be an object");
	}
	const record = input as Record<string, unknown>;
	if (record.op !== "refresh") {
		throw new ConsoleError("unknown console command");
	}
	return { op: "refresh" };
}

export function isConsoleSnapshot(input: unknown): input is ConsoleSnapshot {
	if (input === null || typeof input !== "object") {
		return false;
	}
	const record = input as Record<string, unknown>;
	return isHostState(record.host) && isUsbState(record.usb);
}

export function asConsoleWsError(input: unknown): string | null {
	if (input === null || typeof input !== "object" || Array.isArray(input)) {
		return null;
	}
	const record = input as Record<string, unknown>;
	if (
		isConsoleSnapshot(record) ||
		record.source === "host" ||
		record.source === "usb"
	) {
		return null;
	}
	return typeof record.error === "string" && record.error.trim()
		? record.error
		: null;
}

export function applyConsoleMessage(
	prev: ConsoleSnapshot | null,
	input: unknown,
): ConsoleSnapshot | null {
	if (isConsoleSnapshot(input)) {
		return {
			host: {
				running: input.host.running,
				log: capConsoleLog(input.host.log),
			},
			usb: {
				open: input.usb.open,
				port: input.usb.port,
				baud: input.usb.baud,
				log: capConsoleLog(input.usb.log),
			},
		};
	}
	if (input === null || typeof input !== "object") {
		return null;
	}
	const record = input as Record<string, unknown>;
	const next = prev ?? emptyConsoleSnapshot();
	if (record.source === "host" && typeof record.chunk === "string") {
		return {
			...next,
			host: {
				...next.host,
				log: capConsoleLog(`${next.host.log}${record.chunk}`),
			},
		};
	}
	if (record.source === "usb" && typeof record.chunk === "string") {
		return {
			...next,
			usb: {
				...next.usb,
				log: capConsoleLog(`${next.usb.log}${record.chunk}`),
			},
		};
	}
	if (record.source === "host" && typeof record.running === "boolean") {
		return {
			...next,
			host: {
				running: record.running,
				log: record.running ? "" : next.host.log,
			},
		};
	}
	if (record.source === "usb" && typeof record.open === "boolean") {
		const port = typeof record.port === "string" ? record.port : next.usb.port;
		const baud =
			typeof record.baud === "number" && Number.isFinite(record.baud)
				? record.baud
				: next.usb.baud;
		return {
			...next,
			usb: {
				open: record.open,
				port,
				baud,
				log: record.open ? "" : next.usb.log,
			},
		};
	}
	return null;
}

function isHostState(input: unknown): input is ConsoleHostState {
	if (input === null || typeof input !== "object") {
		return false;
	}
	const record = input as Record<string, unknown>;
	return typeof record.running === "boolean" && typeof record.log === "string";
}

function isUsbState(input: unknown): input is ConsoleUsbState {
	if (input === null || typeof input !== "object") {
		return false;
	}
	const record = input as Record<string, unknown>;
	return (
		typeof record.open === "boolean" &&
		typeof record.port === "string" &&
		typeof record.baud === "number" &&
		typeof record.log === "string"
	);
}

function requiredPort(value: unknown): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new ConsoleError("port is required");
	}
	const port = value.trim();
	if (!/^\/dev\/tty(USB|ACM)[0-9]+$/.test(port)) {
		throw new ConsoleError("port must be /dev/ttyUSB* or /dev/ttyACM*");
	}
	return port;
}

function optionalBaud(value: unknown): number {
	if (value === undefined || value === "") {
		return CONSOLE_DEFAULT_BAUD;
	}
	if (typeof value !== "number" || !Number.isInteger(value)) {
		throw new ConsoleError("baud must be an integer");
	}
	if (!(CONSOLE_BAUDS as readonly number[]).includes(value)) {
		throw new ConsoleError("baud is not supported");
	}
	return value;
}
