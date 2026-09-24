export const HOTSPOT_SETTINGS_FAILED = "could not open hotspot settings";

export const ANDROID_HOTSPOT_INTENTS = [
	"android.settings.WIFI_TETHER_SETTINGS",
	"android.settings.TETHER_SETTINGS",
	"android.settings.WIRELESS_SETTINGS",
] as const;

export async function openAndroidHotspotSettings(
	sendIntent: (action: string) => Promise<void>,
): Promise<void> {
	let lastError: unknown;
	for (const action of ANDROID_HOTSPOT_INTENTS) {
		try {
			await sendIntent(action);
			return;
		} catch (caught) {
			lastError = caught;
		}
	}
	throw lastError instanceof Error
		? lastError
		: new Error(HOTSPOT_SETTINGS_FAILED);
}
