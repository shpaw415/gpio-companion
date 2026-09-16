import type { Messages } from "./en.ts";
import type { MessageKey, Translate } from "./types.ts";

const ERROR_KEYS = {
	"T3 pair failed": "errors.t3PairFailed",
	"request failed": "errors.requestFailed",
	"save failed": "errors.saveFailed",
	"update failed": "errors.updateFailed",
	"logs failed": "errors.logsFailed",
	"flash failed": "errors.flashFailed",
	"wifi failed": "errors.wifiFailed",
	"scan failed": "errors.scanFailed",
	"pair failed": "errors.pairFailed",
	"unpair failed": "errors.unpairFailed",
	"transfer failed": "errors.transferFailed",
	"accept failed": "errors.acceptFailed",
	"reject failed": "errors.rejectFailed",
	"login failed": "errors.loginFailed",
	"callback failed": "errors.callbackFailed",
	"auth unavailable": "errors.authUnavailable",
	"could not open credits": "errors.couldNotOpenCredits",
	"failed to list project": "errors.failedListProject",
	"failed to create project": "errors.failedCreateProject",
	"failed to load project": "errors.failedLoadProject",
	"failed to save project": "errors.failedSaveProject",
	"failed to load branch": "errors.failedLoadBranch",
	"failed to stop sketch": "errors.failedStopSketch",
	"board did not return pairing credentials": "errors.noPairingCredentials",
	"this board is not the selected paired device": "errors.wrongBoard",
	"Go online once to issue a 24h Bluetooth key": "errors.goOnlineBle",
	"sign in first": "common.signInFirst",
} as const satisfies Record<string, MessageKey<Messages>>;

export function translateError(
	t: Translate<Messages>,
	message: string,
): string {
	const key = ERROR_KEYS[message as keyof typeof ERROR_KEYS];
	return key ? t(key) : message;
}
