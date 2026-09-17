export const VOICE_MIC_STORAGE_KEY = "gpio-companion-voice-mic";
export const VOICE_ID_STORAGE_KEY = "gpio-companion-voice-id";
export const VOICE_SAMPLE_RATE = 16_000;
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

export function foldWakeText(text: string): string {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function matchesWakePhrase(text: string): boolean {
	const normalized = foldWakeText(text);
	if (!normalized) {
		return false;
	}
	if (
		normalized.includes("hey companion") ||
		normalized.includes("hey compagnon") ||
		normalized.includes("hi companion") ||
		normalized.includes("ok companion") ||
		normalized.includes("dis companion")
	) {
		return true;
	}
	const words = normalized.split(" ");
	let hey = -1;
	let companion = -1;
	for (let i = 0; i < words.length; i += 1) {
		const word = words[i] ?? "";
		if (
			hey < 0 &&
			(word === "hey" ||
				word === "he" ||
				word === "hi" ||
				word === "ok" ||
				word === "dis")
		) {
			hey = i;
		}
		if (word.startsWith("companion") || word.startsWith("compagnon")) {
			companion = i;
		}
	}
	return hey >= 0 && companion > hey;
}

export function pcmToWav(chunks: Float32Array[], sampleRate: number): Blob {
	let length = 0;
	for (const chunk of chunks) {
		length += chunk.length;
	}
	const pcm = new Int16Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		for (let i = 0; i < chunk.length; i += 1) {
			const sample = Math.max(-1, Math.min(1, chunk[i] ?? 0));
			pcm[offset] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
			offset += 1;
		}
	}
	const bytes = pcm.byteLength;
	const buffer = new ArrayBuffer(44 + bytes);
	const view = new DataView(buffer);
	const ascii = (index: number, value: string) => {
		for (let i = 0; i < value.length; i += 1) {
			view.setUint8(index + i, value.charCodeAt(i));
		}
	};
	ascii(0, "RIFF");
	view.setUint32(4, 36 + bytes, true);
	ascii(8, "WAVE");
	ascii(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	ascii(36, "data");
	view.setUint32(40, bytes, true);
	new Uint8Array(buffer, 44).set(new Uint8Array(pcm.buffer));
	return new Blob([buffer], { type: "audio/wav" });
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
