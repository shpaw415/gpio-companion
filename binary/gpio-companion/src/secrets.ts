import { type DeviceSecrets, emptyDeviceSecrets } from "gpio-companion";

export const DEFAULT_SECRETS_PATH = "/etc/gpio-companion/secrets.env";

export type SecretsStore = {
	read(): Promise<DeviceSecrets>;
	write(secrets: DeviceSecrets): Promise<void>;
};

export function fileSecretsStore(path: string): SecretsStore {
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
		},
	};
}

export function secretsEnvContents(secrets: DeviceSecrets): string {
	return `OPENCODE_API_KEY=${secrets.opencodeApiKey}\nGITEA_TOKEN=${secrets.giteaToken}\n`;
}

function parseEnvSecrets(text: string): DeviceSecrets {
	const secrets = emptyDeviceSecrets();
	for (const line of text.split("\n")) {
		const match = line.match(/^(OPENCODE_API_KEY|GITEA_TOKEN)=(.*)$/);
		if (!match) {
			continue;
		}
		const key = match[1];
		const value = match[2] ?? "";
		if (key === "OPENCODE_API_KEY") {
			secrets.opencodeApiKey = value;
		}
		if (key === "GITEA_TOKEN") {
			secrets.giteaToken = value;
		}
	}
	return secrets;
}
