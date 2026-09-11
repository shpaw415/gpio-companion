export type GithubAppCallback = {
	code: string;
	state: string;
	installationId: string;
	redirectUri: string;
};

export function isGithubAppOAuthIssuer(
	iss: string | null | undefined,
): boolean {
	return (iss ?? "").includes("github.com/login/oauth");
}

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

function callbackRedirectUri(url: URL, raw: string): string {
	if (url.protocol === "http:" || url.protocol === "https:") {
		return `${url.origin}${url.pathname}`;
	}
	return raw.replace(/[?#].*$/, "");
}

export function parseGithubAppCallbackFromUrl(
	raw: string,
): GithubAppCallback | null {
	try {
		const url = new URL(raw);
		const fromPath = parseGithubAppCallbackSearch(
			url.pathname,
			url.search,
			url.origin,
		);
		if (fromPath) {
			return fromPath;
		}
		if (!isGithubAppOAuthIssuer(url.searchParams.get("iss"))) {
			return null;
		}
		const code = url.searchParams.get("code") ?? "";
		const state = url.searchParams.get("state") ?? "";
		const installationId = url.searchParams.get("installation_id") ?? "";
		if (!(code || installationId) || !state) {
			return null;
		}
		return {
			code,
			state,
			installationId,
			redirectUri: callbackRedirectUri(url, raw),
		};
	} catch {
		return null;
	}
}
