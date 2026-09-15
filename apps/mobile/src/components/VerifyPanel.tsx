import { useEffect, useState } from "react";
import { View } from "react-native";
import {
	type CircuitVerifyState,
	loadVerify,
	signVerify,
	startVerify,
	stopVerify,
} from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { sendEnvelope } from "../lib/ble.ts";
import { openPairedBoard } from "../lib/paired-ble.ts";
import { useOfflineBleKey } from "../lib/use-offline-ble-key.ts";
import { Body, Chip, ErrorText, Muted, TextButton } from "./ui.tsx";

export default function VerifyPanel({
	uuid,
	project,
}: {
	uuid: string;
	project?: string;
}) {
	const auth = useAuth();
	const token = auth.token;
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<CircuitVerifyState | null>(null);
	const offline = useOfflineBleKey(uuid);
	const results = status?.results.length
		? status.results
		: (status?.last?.results ?? []);

	useEffect(() => {
		if (!uuid || !token || !status?.running) {
			return;
		}
		const timer = setInterval(() => {
			void loadVerify(token, uuid)
				.then(setStatus)
				.catch(() => undefined);
		}, 400);
		return () => clearInterval(timer);
	}, [uuid, token, status?.running]);

	function start(task: () => Promise<void>) {
		setBusy(true);
		setError("");
		void task()
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "request failed");
			})
			.finally(() => setBusy(false));
	}

	const canStart = Boolean(project);

	return (
		<View style={{ gap: 8 }}>
			<Body>Verify circuit</Body>
			<Muted>
				Pulse declared jumpers on the board. LED on/off needs a second GPIO or
				ADC (not on this header).
			</Muted>
			{uuid ? <Muted>{offline.label}</Muted> : null}
			{!project ? (
				<Muted>Select a project with breadboard/diagram.json.</Muted>
			) : null}
			<TextButton
				label="Verify"
				disabled={busy || !token || !canStart}
				onPress={() => {
					if (!token) {
						return;
					}
					start(async () => {
						await startVerify(token, { uuid, repo: project?.trim() ?? "" });
						setStatus(await loadVerify(token, uuid));
					});
				}}
			/>
			<TextButton
				label="Stop"
				disabled={busy || !token}
				onPress={() => {
					if (!token) {
						return;
					}
					start(async () => {
						await stopVerify(token, uuid);
						setStatus(await loadVerify(token, uuid));
					});
				}}
			/>
			<TextButton
				label="Verify over Bluetooth"
				disabled={busy || !token || !canStart}
				onPress={() => {
					if (!token) {
						return;
					}
					start(async () => {
						const envelope = await signVerify(token, {
							uuid,
							repo: project?.trim() ?? "",
							sign: true,
						});
						const paired = await openPairedBoard(uuid, { token });
						try {
							await sendEnvelope(paired.session.device, envelope, paired.loss);
						} finally {
							await paired.session.close();
						}
						setStatus({
							running: true,
							results: status?.results ?? [],
							last: status?.last ?? null,
						});
					});
				}}
			/>
			{error ? <ErrorText>{error}</ErrorText> : null}
			<Muted>
				{status?.running
					? "Probing jumpers…"
					: status?.last
						? status.last.ok
							? "Last verify had no fails"
							: "Last verify found a problem"
						: "Uses breadboard/diagram.json on the board."}
			</Muted>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				{results.map((item) => (
					<Chip
						key={item.id}
						label={`${item.status} · ${item.detail}`}
						tone={
							item.status === "pass"
								? "success"
								: item.status === "fail" || item.status === "unsafe"
									? "danger"
									: item.status === "needs-press"
										? "warning"
										: "muted"
						}
					/>
				))}
			</View>
		</View>
	);
}
