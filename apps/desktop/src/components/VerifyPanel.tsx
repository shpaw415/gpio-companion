import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import type { CircuitVerifyItem } from "gpio-companion";
import { translateError } from "gpio-companion-i18n";
import { useCallback, useEffect, useState } from "react";
import {
	bleVerify,
	type CircuitVerifyState,
	loadVerify,
	startVerify,
	stopVerify,
} from "../api";
import { useSavedBleId } from "../hooks/useApiCache";
import { useOfflineBleKey } from "../hooks/useOfflineBleKey";
import { verifyStatusLabel } from "../lib/i18n-labels";
import { useT } from "../locale";

export default function VerifyPanel({
	uuid,
	project,
	onResults,
}: {
	uuid: string;
	project?: string;
	onResults?: (results: CircuitVerifyItem[]) => void;
}) {
	const t = useT();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<CircuitVerifyState | null>(null);
	const offline = useOfflineBleKey(uuid);
	const bleId = useSavedBleId(uuid);
	const results = (
		status?.results.length ? status.results : (status?.last?.results ?? [])
	) as CircuitVerifyItem[];

	const applyStatus = useCallback(
		(next: CircuitVerifyState) => {
			setStatus(next);
			onResults?.(
				(next.results.length
					? next.results
					: (next.last?.results ?? [])) as CircuitVerifyItem[],
			);
		},
		[onResults],
	);

	useEffect(() => {
		if (!uuid || !status?.running) {
			return;
		}
		const timer = setInterval(() => {
			void loadVerify(uuid)
				.then(applyStatus)
				.catch(() => undefined);
		}, 400);
		return () => clearInterval(timer);
	}, [uuid, status?.running, applyStatus]);

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
		<Stack spacing={1} sx={{ mt: 1 }}>
			<Typography variant="subtitle2">{t("verify.title")}</Typography>
			<Typography variant="body2" color="secondary">
				{t("verify.hint")}
			</Typography>
			{uuid ? (
				<Typography variant="body2" color="secondary">
					{offline.label}
				</Typography>
			) : null}
			{!project ? (
				<Typography color="secondary" variant="body2">
					{t("verify.selectProject")}
				</Typography>
			) : null}
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Button
					variant="contained"
					size="small"
					disabled={busy || !canStart}
					onClick={() => {
						start(async () => {
							await startVerify({ uuid, repo: project?.trim() ?? "" });
							applyStatus(await loadVerify(uuid));
						});
					}}
				>
					{t("verify.verify")}
				</Button>
				<Button
					variant="outlined"
					size="small"
					disabled={busy}
					onClick={() => {
						start(async () => {
							await stopVerify(uuid);
							applyStatus(await loadVerify(uuid));
						});
					}}
				>
					{t("verify.stop")}
				</Button>
				<Button
					variant="outlined"
					size="small"
					disabled={busy || !canStart}
					onClick={() => {
						start(async () => {
							await bleVerify({
								uuid,
								id: bleId,
								repo: project?.trim() ?? "",
							});
							applyStatus({
								running: true,
								results: status?.results ?? [],
								last: status?.last ?? null,
							});
						});
					}}
				>
					{t("verify.overBle")}
				</Button>
			</Stack>
			{error ? (
				<Alert severity="error">{translateError(t, error)}</Alert>
			) : null}
			<Typography color="secondary" variant="body2">
				{status?.running
					? t("verify.probing")
					: status?.last
						? status.last.ok
							? t("verify.lastOk")
							: t("verify.lastFail")
						: t("verify.usesDiagram")}
			</Typography>
			{results.length ? (
				<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
					{results.map((item) => (
						<Chip
							key={item.id}
							label={`${verifyStatusLabel(item.status, t)} · ${item.detail}`}
							size="small"
							variant="outlined"
							color={
								item.status === "pass"
									? "success"
									: item.status === "fail" || item.status === "unsafe"
										? "error"
										: item.status === "needs-press"
											? "warning"
											: "secondary"
							}
						/>
					))}
				</Stack>
			) : null}
		</Stack>
	);
}
