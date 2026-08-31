import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

export const dashboardUrl = String(
	extra.dashboardUrl ?? "https://gpio-companion.com",
).replace(/\/+$/, "");
export const issuerUrl = String(
	extra.issuerUrl ?? "https://auth.gpio-companion.com",
).replace(/\/+$/, "");
export const authClientId = String(extra.authClientId ?? "gpio_companion");
export const authRedirectUri = String(
	extra.authRedirectUri ?? "gpio-companion://auth/callback",
);
