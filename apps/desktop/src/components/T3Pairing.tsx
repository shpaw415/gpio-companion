import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import {
	DASHBOARD_URL,
	openExternal,
	startT3Pair,
	type T3Status,
} from "../api";

function tokenFrom(status?: T3Status): string {
	const direct = status?.pairingToken?.trim() ?? "";
	if (direct) {
		return direct;
	}
	const url = status?.pairingUrl ?? "";
	const match = url.match(/[#?&]token=([^&\s#]+)/);
	if (!match?.[1]) {
		return "";
	}
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return match[1];
	}
}

function dashboardPairUrl(uuid: string, token: string): string {
	if (!uuid.trim() || !token.trim()) {
		return "";
	}
	return `${DASHBOARD_URL}/devices/t3?uuid=${encodeURIComponent(uuid.trim())}#token=${encodeURIComponent(token.trim())}`;
}

export default function T3Pairing({
	uuid,
	initial,
}: {
	uuid: string;
	initial?: T3Status;
}) {
	const [status, setStatus] = useState<T3Status | undefined>(initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const token = tokenFrom(status);
	const dashboardUrl = dashboardPairUrl(uuid, token);

	async function pair() {
		setBusy(true);
		setError("");
		try {
			const next = await startT3Pair(uuid);
			setStatus(next);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "T3 pair failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Stack spacing={1}>
			{error ? <Alert severity="error">{error}</Alert> : null}
			{status?.paired ? (
				<Typography color="secondary">
					T3 Code is paired. Mint a new link anytime to pair another session.
				</Typography>
			) : null}
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Button
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => void pair()}
				>
					{busy
						? "Minting T3 link…"
						: status?.pairingUrl || status?.paired
							? "New pairing link"
							: "Pair T3 Code"}
				</Button>
				{status?.pairingUrl ? (
					<Button
						variant="text"
						size="small"
						onClick={() => void openExternal(status.pairingUrl ?? "")}
					>
						Open pairing URL
					</Button>
				) : null}
				{dashboardUrl ? (
					<Button
						variant="contained"
						size="small"
						onClick={() => void openExternal(dashboardUrl)}
					>
						Open in dashboard
					</Button>
				) : null}
			</Stack>
			{token ? (
				<Typography color="secondary" sx={{ wordBreak: "break-all" }}>
					Pair code: {token}
				</Typography>
			) : null}
		</Stack>
	);
}
