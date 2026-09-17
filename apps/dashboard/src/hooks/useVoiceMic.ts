import {
	parseVoiceId,
	parseVoiceMicMode,
	VOICE_ID_STORAGE_KEY,
	VOICE_MIC_STORAGE_KEY,
	type VoiceMicMode,
} from "gpio-companion";
import { useCallback, useState } from "react";

function readStoredMode(): VoiceMicMode {
	if (typeof window === "undefined") {
		return "hold";
	}
	try {
		return parseVoiceMicMode(
			window.localStorage.getItem(VOICE_MIC_STORAGE_KEY),
		);
	} catch {
		return "hold";
	}
}

function readStoredVoice(): string {
	if (typeof window === "undefined") {
		return "eve";
	}
	try {
		return parseVoiceId(window.localStorage.getItem(VOICE_ID_STORAGE_KEY));
	} catch {
		return "eve";
	}
}

export function useVoiceMic(): {
	mode: VoiceMicMode;
	setMode: (mode: VoiceMicMode) => void;
	voice: string;
	setVoice: (voice: string) => void;
} {
	const [mode, setModeState] = useState<VoiceMicMode>(readStoredMode);
	const [voice, setVoiceState] = useState(readStoredVoice);
	const setMode = useCallback((next: VoiceMicMode) => {
		setModeState(next);
		try {
			window.localStorage.setItem(VOICE_MIC_STORAGE_KEY, next);
		} catch {
			return;
		}
	}, []);
	const setVoice = useCallback((next: string) => {
		const id = parseVoiceId(next);
		setVoiceState(id);
		try {
			window.localStorage.setItem(VOICE_ID_STORAGE_KEY, id);
		} catch {
			return;
		}
	}, []);
	return { mode, setMode, voice, setVoice };
}
