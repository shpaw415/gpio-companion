import { useEffect } from "react";
import { onGithubAppCallback, saveGithubApp } from "../api";
import { CACHE_KEYS, useApiCache } from "../hooks/useApiCache";
import { parseGithubAppCallbackFromUrl } from "../lib/github-app-callback.ts";

export default function GithubAppCallbackBridge() {
	const { cache } = useApiCache();

	useEffect(() => {
		let unlisten: (() => void) | undefined;
		void onGithubAppCallback((url) => {
			const parsed = parseGithubAppCallbackFromUrl(url);
			if (!parsed) {
				return;
			}
			void saveGithubApp(parsed)
				.then((status) => {
					cache.set(CACHE_KEYS.githubApp, status);
				})
				.catch(() => undefined);
		}).then((fn) => {
			unlisten = fn;
		});
		return () => unlisten?.();
	}, [cache]);

	return null;
}
