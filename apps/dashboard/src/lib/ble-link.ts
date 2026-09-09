import { PATCH as patchPairing } from "@api/pair";
import { unwrapAction } from "./action.ts";
import { saveWebBleId } from "./ble-devices.ts";
import { looksLikeMac, normalizeBleMac } from "./pairing-store.ts";

export async function rememberPairedBle(
	uuid: string,
	id: string,
): Promise<void> {
	const trimmedUuid = uuid.trim();
	const trimmedId = id.trim();
	if (!trimmedUuid || !trimmedId) {
		return;
	}
	await saveWebBleId(trimmedUuid, trimmedId).catch(() => undefined);
	if (!looksLikeMac(trimmedId)) {
		return;
	}
	try {
		unwrapAction(
			await patchPairing({
				uuid: trimmedUuid,
				bleMac: normalizeBleMac(trimmedId),
			}),
		);
	} catch {
		// best-effort; reconnect still works from the local chrome id
	}
}
