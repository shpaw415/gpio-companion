export const DEFAULT_GITHUB_URL = "https://github.com";

export type DeviceSecrets = {
	opencodeApiKey: string;
	githubUsername: string;
	githubToken: string;
	githubUrl: string;
};

export function emptyDeviceSecrets(): DeviceSecrets {
	return {
		opencodeApiKey: "",
		githubUsername: "",
		githubToken: "",
		githubUrl: "",
	};
}

export function parseDeviceSecrets(input: unknown): DeviceSecrets {
	if (input === null || typeof input !== "object") {
		throw new Error("secrets must be an object");
	}
	const record = input as Record<string, unknown>;
	return withGithubUrl({
		opencodeApiKey: optionalString(record.opencodeApiKey),
		githubUsername:
			optionalString(record.githubUsername) ||
			optionalString(record.giteaUsername),
		githubToken:
			optionalString(record.githubToken) || optionalString(record.giteaToken),
		githubUrl:
			optionalString(record.githubUrl) || optionalString(record.giteaUrl),
	});
}

export function mergeDeviceSecrets(
	current: DeviceSecrets,
	patch: DeviceSecrets,
): DeviceSecrets {
	return withGithubUrl({
		opencodeApiKey: patch.opencodeApiKey || current.opencodeApiKey,
		githubUsername: patch.githubUsername || current.githubUsername,
		githubToken: patch.githubToken || current.githubToken,
		githubUrl: patch.githubUrl || current.githubUrl,
	});
}

export function secretsStatus(secrets: DeviceSecrets) {
	return {
		opencodeApiKey: Boolean(secrets.opencodeApiKey),
		githubUsername: Boolean(secrets.githubUsername),
		githubToken: Boolean(secrets.githubToken),
		githubUrl: Boolean(secrets.githubUrl),
		githubReady: Boolean(secrets.githubUsername && secrets.githubToken),
		source: "device-api" as const,
	};
}

function withGithubUrl(secrets: DeviceSecrets): DeviceSecrets {
	if (secrets.githubUsername && secrets.githubToken && !secrets.githubUrl) {
		return { ...secrets, githubUrl: DEFAULT_GITHUB_URL };
	}
	return secrets;
}

function optionalString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}
