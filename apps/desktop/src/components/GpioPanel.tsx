import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import {
	bleGpio,
	type GpioPinState,
	type GpioSnapshot,
	loadGpio,
	putGpio,
} from "../api";

export default function GpioPanel({ uuid }: { uuid: string }) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [snapshot, setSnapshot] = useState<GpioSnapshot | null>(null);
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

	return (
		<Stack spacing={1} sx={{ mt: 1 }}>
			<Typography variant="subtitle2">GPIO</Typography>
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
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				{pins.map((pin) => (
					<Button
						key={pin.physical}
						size="small"
						variant={pin.value === 1 ? "contained" : "outlined"}
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
						{pinLabel(pin)}
					</Button>
				))}
			</Stack>
		</Stack>
	);
}

function pinLabel(pin: GpioPinState): string {
	if (pin.reserved) {
		return `${pin.physical} reserved`;
	}
	if (pin.unresolved) {
		return `${pin.physical} ?`;
	}
	return `${pin.physical} ${pin.value ?? "-"}`;
}
