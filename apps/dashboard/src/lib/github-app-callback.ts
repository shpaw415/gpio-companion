import {
	type GithubAppCallback,
	parseGithubAppCallbackSearch,
} from "gpio-companion";

export const GITHUB_APP_CALLBACK_KEY = "gpio-companion-github-app-callback";

export {
	parseGithubAppCallbackFromUrl,
	parseGithubAppCallbackSearch,
} from "gpio-companion";
export type { GithubAppCallback };

function readStored(): GithubAppCallback | null {
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

export function peekGithubAppCallback(): GithubAppCallback | null {
	return readStored();
}

export function takeGithubAppCallback(): GithubAppCallback | null {
	const value = readStored();
	if (typeof window !== "undefined") {
		window.sessionStorage.removeItem(GITHUB_APP_CALLBACK_KEY);
	}
	return value;
}

export function stashGithubAppCallbackFromLocation(): GithubAppCallback | null {
	if (typeof window === "undefined") {
		return null;
	}
	const existing = readStored();
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
