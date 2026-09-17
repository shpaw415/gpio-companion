export const VOICE_MIC_STORAGE_KEY = "gpio-companion-voice-mic";

export type VoiceMicMode = "hold" | "always" | "wake";

export type VoiceServerMessage = {
	v: 1;
	type: "transcript" | "status" | "error" | "agent";
	text?: string;
	state?: "idle" | "listening" | "talking" | "working";
	billed?: boolean;
};

export function parseVoiceMicMode(value: unknown): VoiceMicMode {
	return value === "always" || value === "wake" || value === "hold"
		? value
		: "hold";
}

export function parseVoiceServerMessage(
	input: unknown,
): VoiceServerMessage | null {
	let value = input;
	if (typeof input === "string") {
		try {
			value = JSON.parse(input) as unknown;
		} catch {
			return null;
		}
	}
	if (!value || typeof value !== "object") {
		return null;
	}
	const record = value as VoiceServerMessage;
	if (record.v !== 1) {
		return null;
	}
	if (
		record.type !== "transcript" &&
		record.type !== "status" &&
		record.type !== "error" &&
		record.type !== "agent"
	) {
		return null;
	}
	return record;
}

export function encodeVoiceClient(message: {
	type: "hello" | "start" | "stop" | "ping";
	locale?: string;
	mode?: VoiceMicMode;
	repo?: string;
	owner?: string;
}): string {
	return JSON.stringify({ v: 1, ...message });
}
