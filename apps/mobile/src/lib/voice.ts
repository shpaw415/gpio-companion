export const VOICE_MIC_STORAGE_KEY = "gpio-companion-voice-mic";
export const VOICE_ID_STORAGE_KEY = "gpio-companion-voice-id";
export const WAKE_PHRASE_LABEL = "Hey Companion";
export const VOICE_VOICE_ID = "eve";

export const VOICE_SPEAKERS = [
	{ id: "eve", name: "Eve" },
	{ id: "altair", name: "Altair" },
	{ id: "ara", name: "Ara" },
	{ id: "rex", name: "Rex" },
	{ id: "sal", name: "Sal" },
	{ id: "leo", name: "Leo" },
] as const;

export type VoiceMicMode = "hold" | "always" | "wake";

export type VoiceServerMessage = {
	v: 1;
	type: "transcript" | "heard" | "status" | "error" | "agent";
	text?: string;
	state?: "idle" | "listening" | "talking" | "working";
	billed?: boolean;
};

export function parseVoiceMicMode(value: unknown): VoiceMicMode {
	return value === "always" || value === "wake" || value === "hold"
		? value
		: "hold";
}

export function parseVoiceId(value: unknown): string {
	if (typeof value !== "string") {
		return VOICE_VOICE_ID;
	}
	const id = value.trim().toLowerCase();
	return VOICE_SPEAKERS.some((speaker) => speaker.id === id)
		? id
		: VOICE_VOICE_ID;
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
		record.type !== "heard" &&
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
	voice?: string;
}): string {
	return JSON.stringify({ v: 1, ...message });
}
