import { useState } from "react";
import { Linking } from "react-native";
import { startT3Pair, type T3Status } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { useBoardSelection } from "../lib/board-selection.tsx";
import { tokenFromPairing } from "../lib/t3.ts";
import { ErrorText, Muted, Row, TextButton } from "./ui.tsx";

export default function T3Pairing({
	uuid,
	initial,
}: {
	uuid: string;
	initial?: T3Status;
}) {
	const auth = useAuth();
	const { openT3Pair } = useBoardSelection();
	const [status, setStatus] = useState<T3Status | undefined>(initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const token = tokenFromPairing(status);

	async function pair() {
		if (!auth.token) {
			setError("sign in first");
			return;
		}
		setBusy(true);
		setError("");
		try {
			const next = await startT3Pair(auth.token, uuid);
			setStatus(next);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "T3 pair failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<ErrorText>{error}</ErrorText>
			{status?.paired ? (
				<Muted>T3 Code is paired. Mint a new link anytime to pair another session.</Muted>
			) : null}
			<Row>
				<TextButton
					disabled={busy || !uuid}
					label={
						busy
							? "Minting T3 link…"
							: status?.pairingUrl || status?.paired
								? "New pairing link"
								: "Pair T3 Code"
					}
					onPress={() => void pair()}
				/>
				{status?.pairingUrl ? (
					<TextButton
						label="Open pairing URL"
						onPress={() => void Linking.openURL(status.pairingUrl ?? "")}
					/>
				) : null}
				{token ? (
					<TextButton
						label="Open in dashboard"
						onPress={() => openT3Pair(uuid, token)}
					/>
				) : null}
			</Row>
			{token ? <Muted>Pair code: {token}</Muted> : null}
		</>
	);
}
