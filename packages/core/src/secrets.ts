export type DeviceSecrets = {
	opencodeApiKey: string;
	giteaUrl: string;
	giteaUsername: string;
	giteaToken: string;
};

export function emptyDeviceSecrets(): DeviceSecrets {
	return {
		opencodeApiKey: "",
		giteaUrl: "",
		giteaUsername: "",
		giteaToken: "",
	};
}

export function parseDeviceSecrets(input: unknown): DeviceSecrets {
	if (input === null || typeof input !== "object") {
		throw new Error("secrets must be an object");
	}
	const record = input as Record<string, unknown>;
	return {
		opencodeApiKey: optionalString(record.opencodeApiKey),
		giteaUrl: optionalString(record.giteaUrl),
		giteaUsername: optionalString(record.giteaUsername),
		giteaToken: optionalString(record.giteaToken),
	};
}

export function mergeDeviceSecrets(
	current: DeviceSecrets,
	patch: DeviceSecrets,
): DeviceSecrets {
	return {
		opencodeApiKey: patch.opencodeApiKey || current.opencodeApiKey,
		giteaUrl: patch.giteaUrl || current.giteaUrl,
		giteaUsername: patch.giteaUsername || current.giteaUsername,
		giteaToken: patch.giteaToken || current.giteaToken,
	};
}

export function secretsStatus(secrets: DeviceSecrets) {
	return {
		opencodeApiKey: Boolean(secrets.opencodeApiKey),
		giteaUrl: Boolean(secrets.giteaUrl),
		giteaUsername: Boolean(secrets.giteaUsername),
		giteaToken: Boolean(secrets.giteaToken),
		giteaReady: Boolean(
			secrets.giteaUrl && secrets.giteaUsername && secrets.giteaToken,
		),
		source: "device-api" as const,
	};
}

function optionalString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}
