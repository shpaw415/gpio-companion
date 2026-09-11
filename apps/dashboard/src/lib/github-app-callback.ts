export const GITHUB_APP_CALLBACK_KEY = "gpio-companion-github-app-callback";

export type GithubAppCallback = {
	code: string;
	state: string;
	installationId: string;
	redirectUri: string;
};

function isGithubAppCallbackPath(pathname: string): boolean {
	return pathname === "/profile/github" || pathname === "/devices/keys";
}

export function parseGithubAppCallbackSearch(
	pathname: string,
	search: string,
	origin: string,
): GithubAppCallback | null {
	if (!isGithubAppCallbackPath(pathname)) {
		return null;
	}
	const params = new URLSearchParams(
		search.startsWith("?") ? search.slice(1) : search,
	);
	const code = params.get("code") ?? "";
	const state = params.get("state") ?? "";
	const installationId = params.get("installation_id") ?? "";
	if (!(code || installationId) || !state) {
		return null;
	}
	return {
		code,
		state,
		installationId,
		redirectUri: `${origin}${pathname}`,
	};
}

export function peekGithubAppCallback(): GithubAppCallback | null {
	if (typeof window === "undefined") {
		return null;
	}
	try {
		const raw = window.sessionStorage.getItem(GITHUB_APP_CALLBACK_KEY);
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as Partial<GithubAppCallback>;
		const state = typeof parsed.state === "string" ? parsed.state.trim() : "";
		const code = typeof parsed.code === "string" ? parsed.code.trim() : "";
		const installationId =
			typeof parsed.installationId === "string"
				? parsed.installationId.trim()
				: "";
		if (!state || !(code || installationId)) {
			return null;
		}
		return {
			code,
			state,
			installationId,
			redirectUri:
				typeof parsed.redirectUri === "string" ? parsed.redirectUri : "",
		};
	} catch {
		return null;
	}
}

export function takeGithubAppCallback(): GithubAppCallback | null {
	const value = peekGithubAppCallback();
	if (typeof window !== "undefined") {
		window.sessionStorage.removeItem(GITHUB_APP_CALLBACK_KEY);
	}
	return value;
}

export function stashGithubAppCallbackFromLocation(): GithubAppCallback | null {
	if (typeof window === "undefined") {
		return null;
	}
	const existing = peekGithubAppCallback();
	const next = parseGithubAppCallbackSearch(
		window.location.pathname,
		window.location.search,
		window.location.origin,
	);
	if (!next) {
		return existing;
	}
	window.sessionStorage.setItem(GITHUB_APP_CALLBACK_KEY, JSON.stringify(next));
	window.history.replaceState({}, "", window.location.pathname);
	return next;
}
