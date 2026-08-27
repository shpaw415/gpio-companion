export type DeviceSecrets = {
	opencodeApiKey: string;
	giteaToken: string;
};

export function emptyDeviceSecrets(): DeviceSecrets {
	return {
		opencodeApiKey: "",
		giteaToken: "",
	};
}

export function parseDeviceSecrets(input: unknown): DeviceSecrets {
	if (input === null || typeof input !== "object") {
		throw new Error("secrets must be an object");
	}
	const record = input as Record<string, unknown>;
	return {
		opencodeApiKey:
			typeof record.opencodeApiKey === "string"
				? record.opencodeApiKey.trim()
				: "",
		giteaToken:
			typeof record.giteaToken === "string" ? record.giteaToken.trim() : "",
	};
}

export function secretsStatus(secrets: DeviceSecrets) {
	return {
		opencodeApiKey: Boolean(secrets.opencodeApiKey),
		giteaToken: Boolean(secrets.giteaToken),
		source: "dashboard" as const,
	};
}
