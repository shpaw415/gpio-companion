import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mintVoiceTicket, transcribeWake } from "../api";
import {
	encodeVoiceClient,
	matchesWakePhrase,
	parseVoiceId,
	parseVoiceMicMode,
	parseVoiceServerMessage,
	pcmToWav,
	VOICE_ID_STORAGE_KEY,
	VOICE_MIC_STORAGE_KEY,
	VOICE_SAMPLE_RATE,
	VOICE_SPEAKERS,
	WAKE_PHRASE_LABEL,
} from "../lib/voice";
import { useLocale, useT } from "../locale";

export default function TalkPanel({
	uuid,
	repo,
	owner,
}: {
	uuid: string;
	repo: string;
	owner?: string;
}) {
	const t = useT();
	const { locale } = useLocale();
	const mode = parseVoiceMicMode(
		typeof window === "undefined"
			? "hold"
			: window.localStorage.getItem(VOICE_MIC_STORAGE_KEY),
	);
	const [voice, setVoiceState] = useState(() =>
		parseVoiceId(
			typeof window === "undefined"
				? "eve"
				: window.localStorage.getItem(VOICE_ID_STORAGE_KEY),
		),
	);
	const [state, setState] = useState<
		"idle" | "listening" | "talking" | "working"
	>("idle");
	const [billed, setBilled] = useState(false);
	const [error, setError] = useState("");
	const [heard, setHeard] = useState("");
	const socketRef = useRef<WebSocket | null>(null);
	const audioRef = useRef<AudioContext | null>(null);
	const streamRef = useRef<MediaStream | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: unmount only
	useEffect(() => () => stopAll(), []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: arm always-listen once per board
	useEffect(() => {
		if (mode !== "always" || !uuid) {
			return;
		}
		void startSession();
		return () => stopAll();
	}, [mode, uuid]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: local wake listener
	useEffect(() => {
		if (mode !== "wake" || !uuid) {
			return;
		}
		let closed = false;
		setState("listening");
		const stopSpeech = startSpeechWake(() => {
			if (!closed && !socketRef.current) {
				void startSession();
			}
		});
		const stopVad = startVadWake(() => {
			if (!closed && !socketRef.current) {
				void startSession();
			}
		});
		return () => {
			closed = true;
			stopSpeech();
			stopVad();
		};
	}, [mode, uuid]);

	async function startSession() {
		if (!uuid || socketRef.current) {
			return;
		}
		setError("");
		setHeard("");
		const ticket = await mintVoiceTicket(uuid);
		const socket = new WebSocket(ticket.wsUrl);
		socket.binaryType = "arraybuffer";
		socketRef.current = socket;
		socket.onmessage = (event) => {
			if (typeof event.data !== "string") {
				void playPcm(event.data as ArrayBuffer);
				return;
			}
			const message = parseVoiceServerMessage(event.data);
			if (!message) {
				return;
			}
			if (message.type === "heard" && message.text) {
				setHeard(message.text.trim());
			}
			if (message.state) {
				setState(message.state);
			}
			if (typeof message.billed === "boolean") {
				setBilled(message.billed);
			}
			if (message.type === "error" && message.text) {
				setError(message.text);
			}
		};
		socket.onclose = () => {
			socketRef.current = null;
			setBilled(false);
			setState(mode === "wake" ? "listening" : "idle");
		};
		await new Promise<void>((resolve, reject) => {
			socket.onopen = () => resolve();
			socket.onerror = () => reject(new Error("voice connect failed"));
		});
		socket.send(
			encodeVoiceClient({
				type: "hello",
				locale,
				mode,
				repo,
				owner,
				voice,
			}),
		);
		socket.send(
			encodeVoiceClient({ type: "start", repo, owner, locale, mode, voice }),
		);
		try {
			await startMic(socket);
			setState("talking");
			setBilled(true);
		} catch {
			setError(t("talk.micDenied"));
			stopAll();
		}
	}

	async function startMic(socket: WebSocket) {
		const media = navigator.mediaDevices;
		if (!media?.getUserMedia) {
			throw new Error("mic");
		}
		let stream: MediaStream;
		try {
			stream = await media.getUserMedia({ audio: true });
		} catch {
			stream = await media.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true },
			});
		}
		streamRef.current = stream;
		const context = new AudioContext({ sampleRate: VOICE_SAMPLE_RATE });
		audioRef.current = context;
		if (context.state === "suspended") {
			await context.resume();
		}
		const source = context.createMediaStreamSource(stream);
		const processor = context.createScriptProcessor(4096, 1, 1);
		processor.onaudioprocess = (event) => {
			if (socket.readyState !== WebSocket.OPEN) {
				return;
			}
			const input = event.inputBuffer.getChannelData(0);
			const pcm = new Int16Array(input.length);
			for (let i = 0; i < input.length; i += 1) {
				const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
				pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
			}
			socket.send(pcm.buffer);
		};
		source.connect(processor);
		processor.connect(context.destination);
	}

	async function playPcm(buffer: ArrayBuffer) {
		const context =
			audioRef.current ?? new AudioContext({ sampleRate: VOICE_SAMPLE_RATE });
		audioRef.current = context;
		const pcm = new Int16Array(buffer);
		const floats = new Float32Array(pcm.length);
		for (let i = 0; i < pcm.length; i += 1) {
			floats[i] = (pcm[i] ?? 0) / 32768;
		}
		const audio = context.createBuffer(1, floats.length, VOICE_SAMPLE_RATE);
		audio.copyToChannel(floats, 0);
		const node = context.createBufferSource();
		node.buffer = audio;
		node.connect(context.destination);
		node.start();
	}

	function stopAll() {
		const socket = socketRef.current;
		if (socket) {
			if (socket.readyState === WebSocket.OPEN) {
				socket.send(encodeVoiceClient({ type: "stop" }));
			}
			socket.close();
		}
		socketRef.current = null;
		for (const track of streamRef.current?.getTracks() ?? []) {
			track.stop();
		}
		streamRef.current = null;
		void audioRef.current?.close();
		audioRef.current = null;
		setBilled(false);
		setHeard("");
		setState("idle");
	}

	const active = billed || state === "talking" || state === "working";

	const chip =
		state === "working"
			? t("talk.working")
			: billed
				? t("talk.talking")
				: state === "listening"
					? t("talk.listening")
					: t("talk.title");

	return (
		<Paper sx={{ p: 1.5, minWidth: 0 }} elevation={1}>
			<Stack spacing={1}>
				<Stack
					direction="row"
					spacing={1}
					sx={{ alignItems: "center", justifyContent: "space-between" }}
				>
					<Typography variant="subtitle1">{t("talk.title")}</Typography>
					<Chip label={chip} size="small" variant="outlined" />
				</Stack>
				<Typography color="secondary">{t("talk.hint")}</Typography>
				<Typography>
					{t("talk.sayWake", { phrase: WAKE_PHRASE_LABEL })}
				</Typography>
				<Select
					name="talk-voice"
					label={t("talk.voice")}
					value={voice}
					onSelect={(next) => {
						const id = parseVoiceId(next);
						setVoiceState(id);
						try {
							window.localStorage.setItem(VOICE_ID_STORAGE_KEY, id);
						} catch {
							undefined;
						}
					}}
					sx={{ maxWidth: 280 }}
				>
					{VOICE_SPEAKERS.map((speaker) => (
						<option key={speaker.id} value={speaker.id}>
							{speaker.name}
						</option>
					))}
				</Select>
				{error ? <Typography color="error">{error}</Typography> : null}
				{!active ? (
					<Stack direction="row" spacing={1}>
						{mode === "hold" ? (
							<Button
								variant="contained"
								size="small"
								onPointerDown={() => void startSession()}
								onPointerUp={() => stopAll()}
								onPointerLeave={() => stopAll()}
							>
								{t("talk.press")}
							</Button>
						) : (
							<Button
								variant="contained"
								size="small"
								onClick={() => void startSession()}
							>
								{t("talk.title")}
							</Button>
						)}
					</Stack>
				) : null}
			</Stack>
			{active
				? createPortal(
						<div className="talk-float">
							{heard ? <div className="talk-heard">{heard}</div> : null}
							<button
								type="button"
								className="talk-mic"
								onClick={() => stopAll()}
								aria-label={t("talk.stop")}
							>
								<span className="talk-mic-pulse" />
								<svg
									width="28"
									height="28"
									viewBox="0 0 24 24"
									aria-hidden
									style={{ position: "relative", fill: "currentColor" }}
								>
									<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
								</svg>
							</button>
						</div>,
						document.body,
					)
				: null}
		</Paper>
	);
}

function startSpeechWake(onWake: () => void): () => void {
	const Speech =
		(
			window as unknown as {
				SpeechRecognition?: new () => SpeechRec;
				webkitSpeechRecognition?: new () => SpeechRec;
			}
		).SpeechRecognition ||
		(
			window as unknown as {
				webkitSpeechRecognition?: new () => SpeechRec;
			}
		).webkitSpeechRecognition;
	if (!Speech) {
		return () => undefined;
	}
	let closed = false;
	const rec = new Speech();
	rec.continuous = true;
	rec.interimResults = true;
	rec.lang = "en-US";
	rec.maxAlternatives = 3;
	rec.onresult = (event) => {
		for (let i = event.resultIndex; i < event.results.length; i += 1) {
			const row = event.results[i];
			if (!row) {
				continue;
			}
			for (let j = 0; j < row.length; j += 1) {
				if (matchesWakePhrase(row[j]?.transcript ?? "")) {
					onWake();
					return;
				}
			}
		}
	};
	rec.onend = () => {
		if (!closed) {
			try {
				rec.start();
			} catch {
				undefined;
			}
		}
	};
	try {
		rec.start();
	} catch {
		undefined;
	}
	return () => {
		closed = true;
		try {
			rec.stop();
		} catch {
			undefined;
		}
	};
}

function startVadWake(onWake: () => void): () => void {
	let closed = false;
	let context: AudioContext | null = null;
	let stream: MediaStream | null = null;
	let busy = false;
	void (async () => {
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			if (closed) {
				for (const track of stream.getTracks()) {
					track.stop();
				}
				return;
			}
			context = new AudioContext();
			const source = context.createMediaStreamSource(stream);
			const processor = context.createScriptProcessor(4096, 1, 1);
			const rate = context.sampleRate;
			let speaking = false;
			let silence = 0;
			let chunks: Float32Array[] = [];
			processor.onaudioprocess = (event) => {
				if (closed || busy) {
					return;
				}
				const input = event.inputBuffer.getChannelData(0);
				let sum = 0;
				for (let i = 0; i < input.length; i += 1) {
					const sample = input[i] ?? 0;
					sum += sample * sample;
				}
				const rms = Math.sqrt(sum / input.length);
				if (rms > 0.025) {
					speaking = true;
					silence = 0;
					chunks.push(new Float32Array(input));
					return;
				}
				if (!speaking) {
					return;
				}
				silence += input.length / rate;
				chunks.push(new Float32Array(input));
				if (silence < 0.4 || chunks.length < 6) {
					return;
				}
				const blob = pcmToWav(chunks, rate);
				chunks = [];
				speaking = false;
				silence = 0;
				busy = true;
				void transcribeWake(blob)
					.then((text) => {
						if (!closed && matchesWakePhrase(text)) {
							onWake();
						}
					})
					.catch(() => undefined)
					.finally(() => {
						busy = false;
					});
			};
			source.connect(processor);
			const mute = context.createGain();
			mute.gain.value = 0;
			processor.connect(mute);
			mute.connect(context.destination);
		} catch {
			undefined;
		}
	})();
	return () => {
		closed = true;
		for (const track of stream?.getTracks() ?? []) {
			track.stop();
		}
		void context?.close();
	};
}

type SpeechRec = {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	maxAlternatives: number;
	resultIndex: number;
	onresult:
		| ((event: {
				resultIndex: number;
				results: ArrayLike<ArrayLike<{ transcript: string }>>;
		  }) => void)
		| null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
};
