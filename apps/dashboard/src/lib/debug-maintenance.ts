import {
	DEBUG_MAINTENANCE_TTL_SEC,
	type MaintenanceReport,
	parseMaintenanceReport,
} from "gpio-companion";
import type { PairingKv } from "./pairing-store.ts";

export const MAINT_PREFIX = "maint:";

export function maintenanceKey(uuid: string): string {
	return `${MAINT_PREFIX}${uuid.trim()}`;
}

export function parseStoredMaintenance(
	raw: string | null,
): MaintenanceReport | null {
	if (!raw) {
		return null;
	}
	try {
		return parseMaintenanceReport(JSON.parse(raw));
	} catch {
		return null;
	}
}

export async function putMaintenance(
	kv: PairingKv,
	input: unknown,
): Promise<MaintenanceReport> {
	const report = parseMaintenanceReport(input);
	await kv.put(maintenanceKey(report.uuid), JSON.stringify(report), {
		expirationTtl: DEBUG_MAINTENANCE_TTL_SEC,
	});
	return report;
}

export async function getMaintenance(
	kv: PairingKv,
	uuid: string,
): Promise<MaintenanceReport | null> {
	return parseStoredMaintenance(await kv.get(maintenanceKey(uuid)));
}

export async function attachMaintenance<T extends { uuid: string }>(
	kv: PairingKv,
	boards: T[],
): Promise<Array<T & { maintenance: MaintenanceReport | null }>> {
	return Promise.all(
		boards.map(async (board) => ({
			...board,
			maintenance: await getMaintenance(kv, board.uuid),
		})),
	);
}
