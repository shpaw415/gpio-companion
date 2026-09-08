import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Stack from "@shpaw415/mui-lite/Stack";
import Table, {
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
} from "@shpaw415/mui-lite/Table";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import {
	bleGpio,
	type GpioPinState,
	type GpioSnapshot,
	loadGpio,
	putGpio,
} from "../api";
import { useOfflineBleKey } from "../hooks/useOfflineBleKey";

export default function GpioPanel({
	uuid,
	connected,
}: {
	uuid: string;
	connected?: boolean;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [snapshot, setSnapshot] = useState<GpioSnapshot | null>(null);
	const offline = useOfflineBleKey(uuid);
	const available = Boolean(uuid) && connected !== false;
	const pins = snapshot?.pins.filter((pin) => pin.type === "gpio") ?? [];

	function start(task: () => Promise<GpioSnapshot>) {
		setBusy(true);
		setError("");
		void task()
			.then(setSnapshot)
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "request failed");
			})
			.finally(() => setBusy(false));
	}

	if (!available) {
		return (
			<Stack spacing={1} sx={{ mt: 1 }}>
				<Typography variant="subtitle2">GPIO</Typography>
				<Alert severity="info">Board not connected</Alert>
			</Stack>
		);
	}

	return (
		<Stack spacing={1} sx={{ mt: 1 }}>
			<Typography variant="subtitle2">GPIO</Typography>
			{uuid ? (
				<Typography variant="body2" color="secondary">
					{offline.label}
				</Typography>
			) : null}
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Button
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						start(() => loadGpio(uuid));
					}}
				>
					{busy ? "Loading…" : "Load GPIO"}
				</Button>
				<Button
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						start(() => bleGpio({ uuid }));
					}}
				>
					Load over Bluetooth
				</Button>
			</Stack>
			{error ? <Alert severity="error">{error}</Alert> : null}
			{snapshot ? (
				<TableContainer>
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>Pin</TableCell>
								<TableCell>Name</TableCell>
								<TableCell>Status</TableCell>
								<TableCell>Action</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{pins.map((pin) => (
								<TableRow key={pin.physical}>
									<TableCell>{pin.physical}</TableCell>
									<TableCell>{pin.name}</TableCell>
									<TableCell>
										<PinStatusChip pin={pin} />
									</TableCell>
									<TableCell>
										<Button
											size="small"
											variant="outlined"
											disabled={busy || pin.reserved || pin.unresolved}
											onClick={() => {
												start(() =>
													putGpio({
														uuid,
														physical: pin.physical,
														dir: "out",
														value: pin.value === 1 ? 0 : 1,
													}),
												);
											}}
										>
											Toggle
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			) : (
				<Typography color="secondary" variant="body2">
					Load GPIO to see live pin status.
				</Typography>
			)}
		</Stack>
	);
}

function PinStatusChip({ pin }: { pin: GpioPinState }) {
	if (pin.reserved) {
		return <Chip label="Reserved" size="small" variant="outlined" />;
	}
	if (pin.unresolved) {
		return <Chip label="Unresolved" size="small" variant="outlined" />;
	}
	if (pin.value === 1) {
		return (
			<Chip label="High" size="small" color="success" variant="outlined" />
		);
	}
	if (pin.value === 0) {
		return (
			<Chip label="Low" size="small" color="secondary" variant="outlined" />
		);
	}
	return <Chip label="—" size="small" variant="outlined" />;
}
