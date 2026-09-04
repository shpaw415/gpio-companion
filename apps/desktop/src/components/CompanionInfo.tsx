import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import { bleInfo, loadDeviceInfo } from "../api";
import { flattenDeviceInfo } from "../device-info";

export default function CompanionInfo({ uuid }: { uuid: string }) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [info, setInfo] = useState<unknown>(null);
	const rows = info ? flattenDeviceInfo(info) : [];

	function start(task: () => Promise<unknown>) {
		setBusy(true);
		setError("");
		void task()
			.then((result) => {
				setInfo(result);
			})
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "request failed");
				setInfo(null);
			})
			.finally(() => setBusy(false));
	}

	return (
		<Stack spacing={1} sx={{ mt: 1 }}>
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Button
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						start(async () => (await loadDeviceInfo(uuid)).info);
					}}
				>
					{busy ? "Loading…" : "Load companion info"}
				</Button>
				<Button
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						start(() => bleInfo({ uuid }));
					}}
				>
					Load over Bluetooth
				</Button>
			</Stack>
			{error ? <Alert severity="error">{error}</Alert> : null}
			{rows.map((row) => (
				<Typography
					key={row.key}
					variant="body2"
					sx={{ wordBreak: "break-all" }}
				>
					{row.key}: {row.value}
				</Typography>
			))}
		</Stack>
	);
}
