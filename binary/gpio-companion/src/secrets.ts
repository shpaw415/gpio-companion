import { dirname, join } from "node:path";
import {
	DEFAULT_GITHUB_URL,
	type DeviceSecrets,
	emptyDeviceSecrets,
	parseDeviceSecrets,
} from "gpio-companion";

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
	const credPath = gitCredentialsPath ?? join(dirname(path), "git-credentials");
	const gitconfigPath = join(dirname(path), "gitconfig");
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
				await Bun.write(gitconfigPath, gitconfigContents(credPath));
			} else {
				await Bun.write(credPath, "");
				await Bun.write(gitconfigPath, "");
			}
		},
	};
}

export function secretsEnvContents(secrets: DeviceSecrets): string {
	return `OPENCODE_API_KEY=${secrets.opencodeApiKey}\nGITHUB_URL=${secrets.githubUrl}\nGITHUB_USERNAME=${secrets.githubUsername}\nGITHUB_TOKEN=${secrets.githubToken}\n`;
}

export function gitCredentialLine(secrets: DeviceSecrets): string | null {
	if (!secrets.githubUsername || !secrets.githubToken) {
		return null;
	}
	try {
		const url = new URL(secrets.githubUrl || DEFAULT_GITHUB_URL);
		url.username = secrets.githubUsername;
		url.password = secrets.githubToken;
		url.pathname = "/";
		url.search = "";
		url.hash = "";
		return url.toString().replace(/\/$/, "");
	} catch {
		return null;
	}
}

export function gitconfigContents(credentialsPath: string): string {
	return `[credential]\n\thelper = store --file ${credentialsPath}\n`;
}

function parseEnvSecrets(text: string): DeviceSecrets {
	const record: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const match = line.match(
			/^(OPENCODE_API_KEY|GITHUB_URL|GITHUB_USERNAME|GITHUB_TOKEN|GITEA_URL|GITEA_USERNAME|GITEA_TOKEN)=(.*)$/,
		);
		if (!match) {
			continue;
		}
		const key = match[1];
		const value = match[2] ?? "";
		if (key === "OPENCODE_API_KEY") {
			record.opencodeApiKey = value;
		}
		if (key === "GITHUB_URL" || key === "GITEA_URL") {
			record.githubUrl = record.githubUrl || value;
		}
		if (key === "GITHUB_USERNAME" || key === "GITEA_USERNAME") {
			record.githubUsername = record.githubUsername || value;
		}
		if (key === "GITHUB_TOKEN" || key === "GITEA_TOKEN") {
			record.githubToken = record.githubToken || value;
		}
	}
	return parseDeviceSecrets(record);
}
