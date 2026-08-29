import { dirname, join } from "node:path";
import { type DeviceSecrets, emptyDeviceSecrets } from "gpio-companion";

export const DEFAULT_SECRETS_PATH = "/etc/gpio-companion/secrets.env";
export const DEFAULT_GIT_CREDENTIALS_PATH =
	"/etc/gpio-companion/git-credentials";

export type SecretsStore = {
	read(): Promise<DeviceSecrets>;
	write(secrets: DeviceSecrets): Promise<void>;
};

export function fileSecretsStore(
	path: string,
	gitCredentialsPath?: string,
): SecretsStore {
	const credPath =
		gitCredentialsPath ?? join(dirname(path), "git-credentials");
	return {
		async read() {
			const file = Bun.file(path);
			if (!(await file.exists())) {
				return emptyDeviceSecrets();
			}
			return parseEnvSecrets(await file.text());
		},
		async write(secrets) {
			await Bun.write(path, secretsEnvContents(secrets));
			const cred = gitCredentialLine(secrets);
			if (cred) {
				await Bun.write(credPath, `${cred}\n`);
			} else {
				await Bun.write(credPath, "");
			}
		},
	};
}

export function secretsEnvContents(secrets: DeviceSecrets): string {
	return `OPENCODE_API_KEY=${secrets.opencodeApiKey}\nGITEA_URL=${secrets.giteaUrl}\nGITEA_USERNAME=${secrets.giteaUsername}\nGITEA_TOKEN=${secrets.giteaToken}\n`;
}

export function gitCredentialLine(secrets: DeviceSecrets): string | null {
	if (!secrets.giteaUrl || !secrets.giteaUsername || !secrets.giteaToken) {
		return null;
	}
	try {
		const url = new URL(secrets.giteaUrl);
		url.username = secrets.giteaUsername;
		url.password = secrets.giteaToken;
		url.pathname = "/";
		url.search = "";
		url.hash = "";
		return url.toString().replace(/\/$/, "");
	} catch {
		return null;
	}
}

function parseEnvSecrets(text: string): DeviceSecrets {
	const secrets = emptyDeviceSecrets();
	for (const line of text.split("\n")) {
		const match = line.match(
			/^(OPENCODE_API_KEY|GITEA_URL|GITEA_USERNAME|GITEA_TOKEN)=(.*)$/,
		);
		if (!match) {
			continue;
		}
		const key = match[1];
		const value = match[2] ?? "";
		if (key === "OPENCODE_API_KEY") {
			secrets.opencodeApiKey = value;
		}
		if (key === "GITEA_URL") {
			secrets.giteaUrl = value;
		}
		if (key === "GITEA_USERNAME") {
			secrets.giteaUsername = value;
		}
		if (key === "GITEA_TOKEN") {
			secrets.giteaToken = value;
		}
	}
	return secrets;
}
