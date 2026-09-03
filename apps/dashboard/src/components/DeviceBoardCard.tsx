import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { deviceDisplayName, type StoredPairing } from "../lib/pairing-store.ts";
import DeviceLabelField from "./DeviceLabelField.tsx";
import T3PairingPanel from "./T3PairingPanel.tsx";

export type DeviceStatus = {
	hardware?: string;
	model?: string;
	tunnel?: { configured?: boolean; apiHostname?: string };
	secrets?: { githubReady?: boolean; gpioAiKey?: boolean };
	t3?: {
		running?: boolean;
		pairingUrl?: string;
		pairingToken?: string;
		paired?: boolean;
		serviceInstalled?: boolean;
	};
};

export type BoardView = {
	device: StoredPairing;
	status: DeviceStatus | null;
};

export default function DeviceBoardCard({
	device,
	status,
	onLabelSaved,
	onUnpair,
	unpairing,
	t3AutoStart,
	selected,
	onSelect,
}: {
	device: StoredPairing;
	status: DeviceStatus | null;
	onLabelSaved?: (label: string) => void;
	onUnpair?: (uuid: string) => void;
	unpairing?: boolean;
	t3AutoStart?: boolean;
	selected?: boolean;
	onSelect?: (uuid: string) => void;
}) {
	const online = Boolean(status);

	return (
		<Paper className="w-full max-w-2xl p-4 min-[900px]:p-6" elevation={1}>
			<Stack spacing={2}>
				<Typography variant="h6">{deviceDisplayName(device)}</Typography>
				<Typography color="secondary" className="break-all">
					{device.uuid}
				</Typography>
				{device.deviceUrl ? (
					<Typography color="secondary" className="break-all">
						{device.deviceUrl}
					</Typography>
				) : null}
				<DeviceLabelField
					key={device.uuid}
					uuid={device.uuid}
					label={device.label}
					onSaved={onLabelSaved}
				/>
				<Stack direction="row" spacing={1} className="flex-wrap">
					<Chip
						label={online ? "Online" : "Offline"}
						color={online ? "success" : "secondary"}
						variant="outlined"
					/>
					{selected ? (
						<Chip label="Selected" color="primary" variant="outlined" />
					) : null}
					{status?.model || status?.hardware ? (
						<Chip
							label={status?.model || status?.hardware}
							variant="outlined"
						/>
					) : null}
					{status ? (
						<>
							<Chip
								label={
									status.tunnel?.configured ? "tunnel ready" : "tunnel pending"
								}
								color={status.tunnel?.configured ? "success" : "secondary"}
								variant="outlined"
							/>
							<Chip
								label={
									status.secrets?.githubReady
										? "GitHub ready"
										: "GitHub keys pending"
								}
								color={status.secrets?.githubReady ? "success" : "warning"}
								variant="outlined"
							/>
							<Chip
								label={
									status.t3?.paired
										? "T3 Code paired"
										: status.t3?.running
											? "T3 Code running"
											: "T3 Code idle"
								}
								color={status.t3?.paired ? "success" : "secondary"}
								variant="outlined"
							/>
						</>
					) : null}
				</Stack>
				<T3PairingPanel
					devices={[device]}
					uuid={device.uuid}
					initialStatus={status?.t3}
					skipFetch={!t3AutoStart}
					autoStart={t3AutoStart}
				/>
				<Stack direction="row" spacing={1} className="flex-wrap">
					{onSelect ? (
						<Button
							type="button"
							variant={selected ? "contained" : "outlined"}
							size="small"
							disabled={selected}
							onClick={() => onSelect(device.uuid)}
						>
							{selected ? "Selected board" : "Select board"}
						</Button>
					) : null}
					{onUnpair ? (
						<Button
							type="button"
							variant="outlined"
							size="small"
							disabled={unpairing}
							onClick={() => onUnpair(device.uuid)}
						>
							Unpair (revokes T3 Code)
						</Button>
					) : null}
				</Stack>
			</Stack>
		</Paper>
	);
}
