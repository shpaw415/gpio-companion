import { parseLivePingUuid, redactDebugMessage } from "./debug.ts";

export const LOGS_PATH = "/v1/logs";
export const LOGS_MAX_BYTES = 64 * 1024;
export const LOGS_MAX_LINES = 200;
export const LOGS_SINCE_HOURS = 24;
export const DEBUG_MAINTENANCE_PATH = "/api/debug/maintenance";
export const DEBUG_MAINTENANCE_TTL_SEC = 24 * 60 * 60;
export const LOG_JOURNAL_UNITS = [
	"gpio-companion",
	"gpio-companion-update",
	"gpio-companion-cleanup",
	"cloudflared-gpio",
	"gpio-companion-openviking",
] as const;

export type DiskStats = {
	totalMb: number;
	availMb: number;
};

export type MaintenanceReport = {
	uuid: string;
	at: number;
	diskTotalMb: number;
	diskAvailMb: number;
	reclaimedBytes: number;
	actions: string[];
};

const MAX_ACTIONS = 32;
const MAX_ACTION_LEN = 80;

function finiteNumber(value: unknown): number | null {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return null;
	}
	return value;
}

function nonNegative(value: number): number {
	return value < 0 ? 0 : Math.round(value);
}

export function parseDiskStats(value: unknown): DiskStats | null {
	if (!value || typeof value !== "object") {
		return null;
	}
	const record = value as Record<string, unknown>;
	const totalMb = finiteNumber(record.totalMb);
	const availMb = finiteNumber(record.availMb);
	if (totalMb === null || availMb === null || totalMb <= 0) {
		return null;
	}
	return {
		totalMb: nonNegative(totalMb),
		availMb: nonNegative(availMb),
	};
}

export function parseMaintenanceReport(input: unknown): MaintenanceReport {
	const uuid = parseLivePingUuid(input);
	if (!input || typeof input !== "object") {
		throw new Error("maintenance report is required");
	}
	const record = input as Record<string, unknown>;
	const at = finiteNumber(record.at);
	const diskTotalMb = finiteNumber(record.diskTotalMb);
	const diskAvailMb = finiteNumber(record.diskAvailMb);
	const reclaimedBytes = finiteNumber(record.reclaimedBytes);
	if (at === null || at <= 0) {
		throw new Error("at is required");
	}
	if (diskTotalMb === null || diskAvailMb === null || reclaimedBytes === null) {
		throw new Error("disk stats are required");
	}
	const rawActions = Array.isArray(record.actions) ? record.actions : [];
	const actions = rawActions
		.filter(
			(item): item is string =>
				typeof item === "string" && Boolean(item.trim()),
		)
		.map((item) => item.trim().slice(0, MAX_ACTION_LEN))
		.slice(0, MAX_ACTIONS);
	return {
		uuid,
		at: Math.round(at),
		diskTotalMb: nonNegative(diskTotalMb),
		diskAvailMb: nonNegative(diskAvailMb),
		reclaimedBytes: nonNegative(reclaimedBytes),
		actions,
	};
}

export function redactLogText(text: string): string {
	return redactDebugMessage(text);
}

function utf8Bytes(text: string): number {
	return new TextEncoder().encode(text).byteLength;
}

export function capLogText(
	text: string,
	maxBytes = LOGS_MAX_BYTES,
	maxLines = LOGS_MAX_LINES,
): string {
	const lines = text.replace(/\r\n/g, "\n").split("\n").slice(-maxLines);
	let next = lines.join("\n");
	if (utf8Bytes(next) <= maxBytes) {
		return next;
	}
	while (lines.length > 1 && utf8Bytes(next) > maxBytes) {
		lines.shift();
		next = lines.join("\n");
	}
	if (utf8Bytes(next) <= maxBytes) {
		return next;
	}
	let end = next.length;
	while (end > 0 && utf8Bytes(next.slice(0, end)) > maxBytes) {
		end -= 1;
	}
	return next.slice(0, end);
}

export function formatDiskFree(disk: DiskStats): string {
	const pct = Math.max(
		0,
		Math.min(100, Math.round((disk.availMb / disk.totalMb) * 100)),
	);
	return `${disk.availMb} MB free (${pct}%)`;
}
