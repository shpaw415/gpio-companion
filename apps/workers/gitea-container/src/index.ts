import { Container, getContainer } from "@cloudflare/containers";

export class GiteaContainer extends Container<Env> {
	defaultPort = 3000;
	sleepAfter = "24h";
	enableInternet = true;

	override onStart() {
		console.log("Gitea container started");
	}

	override onStop(params: { exitCode?: number; reason: string }) {
		console.log("Gitea container stopped", params);
	}

	override onError(error: unknown) {
		console.error("Gitea container error:", error);
		throw error;
	}
}

function giteaEnv(request: Request, env: Env): Record<string, string> {
	const url = new URL(request.url);
	const root = new URL(env.GITEA_ROOT_URL || `${url.protocol}//${url.host}/`);
	return {
		USER: "git",
		GITEA__database__DB_TYPE: "sqlite3",
		GITEA__server__PROTOCOL: "http",
		GITEA__server__HTTP_PORT: "3000",
		GITEA__server__DOMAIN: root.hostname,
		GITEA__server__ROOT_URL: root.href,
		GITEA__server__DISABLE_SSH: "true",
		GITEA__server__START_SSH_SERVER: "false",
		GITEA__server__OFFLINE_MODE: "false",
		GITEA__server__LFS_START_SERVER: "true",
		GITEA__log__LEVEL: "Info",
	};
}

function withForwardedHeaders(request: Request): Request {
	const url = new URL(request.url);
	const headers = new Headers(request.headers);
	headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
	headers.set("X-Forwarded-Host", url.host);
	const ip = request.headers.get("CF-Connecting-IP");
	if (ip) {
		headers.set("X-Real-IP", ip);
		headers.set("X-Forwarded-For", ip);
	}
	return new Request(request, { headers });
}

export default {
	async fetch(request, env) {
		const gitea = getContainer(env.GITEA);
		await gitea.startAndWaitForPorts({
			ports: [3000],
			startOptions: {
				envVars: giteaEnv(request, env),
			},
			cancellationOptions: {
				instanceGetTimeoutMS: 30_000,
				portReadyTimeoutMS: 120_000,
			},
		});
		return gitea.fetch(withForwardedHeaders(request));
	},
} satisfies ExportedHandler<Env>;
