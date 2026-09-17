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

export type AuthOptions = {
	issuer: string;
	clientId: string;
	redirectUri: string;
};

const native = requireOptionalNativeModule<NativeAuth>("OpenAuthster");

let lastOptions: AuthOptions | null = null;
let configuring: Promise<void> | null = null;

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

export async function configureAuth(options: AuthOptions): Promise<void> {
	lastOptions = options;
	const run = (async () => {
		await getNative().configure(
			options.issuer,
			options.clientId,
			options.redirectUri,
		);
	})();
	configuring = run;
	try {
		await run;
	} finally {
		if (configuring === run) {
			configuring = null;
		}
	}
}

export async function ensureConfigured(): Promise<void> {
	if (configuring) {
		await configuring;
	}
	if (!lastOptions) {
		throw new Error("call configure first");
	}
	await configureAuth(lastOptions);
}

async function waitForConfigure(): Promise<void> {
	if (configuring) {
		await configuring;
	}
}

export async function loginWithGithub(): Promise<string> {
	await ensureConfigured();
	return getNative().login("github");
}

export async function logout(): Promise<void> {
	await waitForConfigure();
	await getNative().logout();
}

export async function getAccessToken(): Promise<string | null> {
	await waitForConfigure();
	return getNative().getAccessToken();
}

export async function isAuthenticated(): Promise<boolean> {
	await waitForConfigure();
	return getNative().isAuthenticated();
}

export async function handleAuthCallback(url: string): Promise<string> {
	await ensureConfigured();
	return getNative().handleCallback(url);
}
