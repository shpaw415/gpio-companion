import { requireOptionalNativeModule } from "expo-modules-core";

type NativeAuth = {
	configure(
		issuer: string,
		clientId: string,
		redirectUri: string,
	): Promise<void>;
	login(provider: string): Promise<string>;
	logout(): Promise<void>;
	getAccessToken(): Promise<string | null>;
	isAuthenticated(): Promise<boolean>;
	handleCallback(url: string): Promise<string>;
};

const native = requireOptionalNativeModule<NativeAuth>("OpenAuthster");

function getNative(): NativeAuth {
	if (!native) {
		throw new Error(
			"OpenAuthster native module is missing. Use a dev build: npx expo run:android or npx expo run:ios (not Expo Go).",
		);
	}
	return native;
}

export function isNativeAuthAvailable(): boolean {
	return native != null;
}

export async function configureAuth(options: {
	issuer: string;
	clientId: string;
	redirectUri: string;
}): Promise<void> {
	await getNative().configure(
		options.issuer,
		options.clientId,
		options.redirectUri,
	);
}

export async function loginWithGithub(): Promise<string> {
	return getNative().login("github");
}

export async function logout(): Promise<void> {
	await getNative().logout();
}

export async function getAccessToken(): Promise<string | null> {
	return getNative().getAccessToken();
}

export async function isAuthenticated(): Promise<boolean> {
	return getNative().isAuthenticated();
}

export async function handleAuthCallback(url: string): Promise<string> {
	return getNative().handleCallback(url);
}
