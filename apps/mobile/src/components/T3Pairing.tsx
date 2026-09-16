import { useCallback, useState } from "react";
import { Linking } from "react-native";
import { startT3Pair, type T3Status } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { useBoardSelection } from "../lib/board-selection.tsx";
import { translateError, useT } from "../lib/locale.tsx";
import { tokenFromPairing } from "../lib/t3.ts";
import { useDeviceHub } from "../lib/use-device-hub.ts";
import { ErrorText, Muted, Row, TextButton } from "./ui.tsx";

export default function T3Pairing({
	uuid,
	initial,
}: {
	uuid: string;
	initial?: T3Status;
}) {
	const auth = useAuth();
	const t = useT();
	const { openT3Pair } = useBoardSelection();
	const [status, setStatus] = useState<T3Status | undefined>(initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const token = tokenFromPairing(status);
	const onT3 = useCallback((next: T3Status) => {
		setStatus(next);
		if (next.pairingUrl || next.pairingToken) {
			setError("");
		}
	}, []);
	useDeviceHub(uuid, auth.token, { onT3 });

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
			<ErrorText>{translateError(t, error)}</ErrorText>
			{status?.paired ? <Muted>{t("t3.pairedHint")}</Muted> : null}
			<Row>
				<TextButton
					disabled={busy || !uuid}
					label={
						busy
							? t("t3.minting")
							: status?.pairingUrl || status?.paired
								? t("t3.newLink")
								: t("t3.pairT3")
					}
					onPress={() => void pair()}
				/>
				{status?.pairingUrl ? (
					<TextButton
						label={t("t3.openPairingUrl")}
						onPress={() => void Linking.openURL(status.pairingUrl ?? "")}
					/>
				) : null}
				{token ? (
					<TextButton
						label={t("t3.openInDashboard")}
						onPress={() => openT3Pair(uuid, token)}
					/>
				) : null}
			</Row>
			{token ? <Muted>{t("t3.pairCode", { token })}</Muted> : null}
		</>
	);
}
