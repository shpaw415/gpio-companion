import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { formatNetworkLabel, type NetworkStatus } from "gpio-companion";
import { useDashboardMode } from "../hooks/useDashboardMode.tsx";
import type { ActionResult } from "../lib/action.ts";
import { deviceDisplayName, type StoredPairing } from "../lib/pairing-store.ts";
import DeviceCompanionInfo from "./DeviceCompanionInfo.tsx";
import DeviceLabelField from "./DeviceLabelField.tsx";
import GpioPanel from "./GpioPanel.tsx";
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
	network?: NetworkStatus | null;
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
	loadInfo,
}: {
	device: StoredPairing;
	status: DeviceStatus | null;
	onLabelSaved?: (label: string) => void;
	onUnpair?: (uuid: string) => void;
	unpairing?: boolean;
	t3AutoStart?: boolean;
	selected?: boolean;
	onSelect?: (uuid: string) => void;
	loadInfo?: (uuid: string) => Promise<ActionResult<{ info: unknown }>>;
}) {
	const { isEasy } = useDashboardMode();
	const online = Boolean(status);
	const networkLabel = formatNetworkLabel(status?.network);
	const codeReady = Boolean(status?.t3?.paired);
	const showCodePair = !isEasy || t3AutoStart || !codeReady;

	return (
		<Paper className="w-full max-w-2xl p-4 min-[900px]:p-6" elevation={1}>
			<Stack spacing={2}>
				<Typography variant="h6">{deviceDisplayName(device)}</Typography>
				{isEasy ? null : (
					<>
						<Typography color="secondary" className="break-all">
							{device.uuid}
						</Typography>
						{device.deviceUrl ? (
							<Typography color="secondary" className="break-all">
								{device.deviceUrl}
							</Typography>
						) : null}
					</>
				)}
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
					{networkLabel ? (
						<Chip label={networkLabel} variant="outlined" />
					) : null}
					{status && !isEasy ? (
						<Chip
							label={
								status.tunnel?.configured ? "tunnel ready" : "tunnel pending"
							}
							color={status.tunnel?.configured ? "success" : "secondary"}
							variant="outlined"
						/>
					) : null}
					{status ? (
						<>
							<Chip
								label={
									status.secrets?.githubReady
										? "Projects connected"
										: "Connect GitHub"
								}
								color={status.secrets?.githubReady ? "success" : "warning"}
								variant="outlined"
							/>
							<Chip
								label={
									codeReady
										? "Code ready"
										: status.t3?.running
											? "Code running"
											: "Code idle"
								}
								color={codeReady ? "success" : "secondary"}
								variant="outlined"
							/>
						</>
					) : null}
				</Stack>
				{showCodePair ? (
					<T3PairingPanel
						devices={[device]}
						uuid={device.uuid}
						initialStatus={status?.t3}
						skipFetch={!t3AutoStart}
						autoStart={t3AutoStart}
					/>
				) : null}
				{!isEasy && loadInfo ? (
					<DeviceCompanionInfo
						key={device.uuid}
						uuid={device.uuid}
						loadInfo={loadInfo}
					/>
				) : null}
				{isEasy ? null : <GpioPanel uuid={device.uuid} />}
				<Stack direction="row" spacing={1} className="flex-wrap">
					{isEasy ? (
						<Button href="/devices/t3" variant="contained" size="small">
							Open Code
						</Button>
					) : null}
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
					{!isEasy && onUnpair ? (
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
