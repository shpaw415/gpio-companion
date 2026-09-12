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
import { useCallback, useState } from "react";
import {
	bleGpio,
	type GpioPinState,
	type GpioSnapshot,
	loadGpio,
	putGpio,
} from "../api";
import { useSavedBleId } from "../hooks/useApiCache";
import { useGpioTunnel } from "../hooks/useGpioTunnel";
import { useOfflineBleKey } from "../hooks/useOfflineBleKey";
import GpioHeader from "./GpioHeader";

function canDriveGpio(pin: GpioPinState): boolean {
	return pin.type === "gpio" && !pin.reserved && !pin.unresolved;
}

export default function GpioPanel({
	uuid,
	connected,
	poll = false,
}: {
	uuid: string;
	connected?: boolean;
	poll?: boolean;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [snapshot, setSnapshot] = useState<GpioSnapshot | null>(null);
	const offline = useOfflineBleKey(uuid);
	const bleId = useSavedBleId(uuid);
	const available = Boolean(uuid) && connected !== false;
	const pins = snapshot?.pins ?? [];
	const gpioPins = pins.filter((pin) => pin.type === "gpio");
	const onGpio = useCallback((next: GpioSnapshot) => {
		setSnapshot(next);
	}, []);
	const tunnel = useGpioTunnel(poll && available ? uuid : "", onGpio, setError);

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

	function drive(command: {
		physical: number;
		dir?: "in" | "out" | "pwm";
		value?: 0 | 1;
		analog?: number;
		op?: "tone" | "notone";
		hz?: number;
	}) {
		if (poll) {
			setError("");
			if (!tunnel.drive(command)) {
				setError("live gpio websocket is not connected");
			}
			return;
		}
		start(() => putGpio({ uuid, ...command }));
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
			<Stack
				direction="row"
				spacing={1}
				sx={{
					flexWrap: "wrap",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<Typography variant="subtitle2">
					{poll ? "Live GPIO" : "GPIO"}
				</Typography>
				{poll ? (
					<Chip
						label={snapshot ? "Live" : "Waiting"}
						size="small"
						color={snapshot ? "success" : "secondary"}
						variant="outlined"
					/>
				) : null}
			</Stack>
			{uuid ? (
				<Typography variant="body2" color="secondary">
					{offline.label}
				</Typography>
			) : null}
			{poll ? (
				<Typography variant="body2" color="secondary">
					{snapshot
						? "Tap a GPIO to toggle output over the board websocket. Set In to watch a pin."
						: "Waiting for live pin state from the board."}
				</Typography>
			) : null}
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Button
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						if (poll) {
							setError("");
							if (!tunnel.refresh()) {
								setError("live gpio websocket is not connected");
							}
							return;
						}
						start(() => loadGpio(uuid));
					}}
				>
					{busy ? "Loading…" : snapshot || poll ? "Refresh" : "Load GPIO"}
				</Button>
				<Button
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						start(() => bleGpio({ uuid, id: bleId }));
					}}
				>
					Load over Bluetooth
				</Button>
			</Stack>
			{error ? <Alert severity="error">{error}</Alert> : null}
			{poll || snapshot ? (
				<GpioHeader
					pins={pins}
					busy={busy}
					interactive={Boolean(snapshot)}
					onToggle={(pin) => {
						drive({
							physical: pin.physical,
							dir: "out",
							value: pin.value === 1 ? 0 : 1,
						});
					}}
				/>
			) : (
				<Typography color="secondary" variant="body2">
					Load GPIO to see live pin status.
				</Typography>
			)}
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
							{gpioPins.map((pin) => (
								<TableRow key={pin.physical}>
									<TableCell>{pin.physical}</TableCell>
									<TableCell>{pin.name}</TableCell>
									<TableCell>
										<PinStatusChip pin={pin} />
									</TableCell>
									<TableCell>
										<Stack
											direction="row"
											spacing={1}
											sx={{ flexWrap: "wrap" }}
										>
											<Button
												size="small"
												variant="outlined"
												disabled={busy || !canDriveGpio(pin)}
												onClick={() =>
													drive({ physical: pin.physical, dir: "in" })
												}
											>
												In
											</Button>
											<Button
												size="small"
												variant="outlined"
												disabled={busy || !canDriveGpio(pin)}
												onClick={() =>
													drive({
														physical: pin.physical,
														dir: "out",
														value: pin.value === 1 ? 0 : 1,
													})
												}
											>
												{pin.value === 1 ? "Set low" : "Set high"}
											</Button>
											<Button
												size="small"
												variant="outlined"
												disabled={busy || !canDriveGpio(pin)}
												onClick={() =>
													drive({
														physical: pin.physical,
														dir: "pwm",
														analog:
															typeof pin.analog === "number" ? pin.analog : 128,
													})
												}
											>
												PWM
											</Button>
											<Button
												size="small"
												variant="outlined"
												disabled={busy || !canDriveGpio(pin)}
												onClick={() =>
													drive(
														typeof pin.hz === "number"
															? { physical: pin.physical, op: "notone" }
															: {
																	physical: pin.physical,
																	op: "tone",
																	hz: 440,
																},
													)
												}
											>
												{typeof pin.hz === "number" ? "Stop tone" : "Tone"}
											</Button>
										</Stack>
										{typeof pin.analog === "number" ? (
											<input
												type="range"
												min={0}
												max={255}
												value={pin.analog}
												disabled={busy || !canDriveGpio(pin)}
												aria-label={`Pin ${pin.physical} PWM`}
												onChange={(event) => {
													drive({
														physical: pin.physical,
														dir: "pwm",
														analog: Number(event.target.value),
													});
												}}
											/>
										) : null}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			) : null}
		</Stack>
	);
}

function PinStatusChip({ pin }: { pin: GpioPinState }) {
	const label = pinStatus(pin);
	if (pin.reserved || pin.unresolved || label === "—") {
		return <Chip label={label} size="small" variant="outlined" />;
	}
	if (typeof pin.hz === "number" || typeof pin.analog === "number") {
		return (
			<Chip label={label} size="small" color="primary" variant="outlined" />
		);
	}
	if (pin.value === 1) {
		return <Chip label={label} size="small" color="success" variant="outlined" />;
	}
	return (
		<Chip label={label} size="small" color="secondary" variant="outlined" />
	);
}

function pinStatus(pin: GpioPinState): string {
	if (pin.reserved) {
		return "Reserved";
	}
	if (pin.unresolved) {
		return "Unresolved";
	}
	if (typeof pin.hz === "number") {
		return `tone ${Math.round(pin.hz)} Hz`;
	}
	if (typeof pin.analog === "number") {
		return `PWM ${Math.round(pin.analog)}/255`;
	}
	if (typeof pin.pwm === "number") {
		return `PWM ${Math.round(pin.pwm)}%`;
	}
	const level =
		pin.value === 1 ? "high" : pin.value === 0 ? "low" : undefined;
	if (pin.dir === "in" || pin.dir === "out") {
		return level ? `${pin.dir} · ${level}` : pin.dir;
	}
	return level ?? "—";
}
