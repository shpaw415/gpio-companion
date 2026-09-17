import {
	parseVoiceMicMode,
	VOICE_MIC_STORAGE_KEY,
	type VoiceMicMode,
} from "gpio-companion";
import { useCallback, useState } from "react";

function readStored(): VoiceMicMode {
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

export function useVoiceMic(): {
	mode: VoiceMicMode;
	setMode: (mode: VoiceMicMode) => void;
} {
	const [mode, setModeState] = useState<VoiceMicMode>(readStored);
	const setMode = useCallback((next: VoiceMicMode) => {
		setModeState(next);
		try {
			window.localStorage.setItem(VOICE_MIC_STORAGE_KEY, next);
		} catch {
			return;
		}
	}, []);
	return { mode, setMode };
}
