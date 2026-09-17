import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import type { NetworkStatus } from "gpio-companion";
import { useState } from "react";
import { useDashboardMode } from "../hooks/useDashboardMode.tsx";
import { useT } from "../hooks/useLocale.tsx";
import type { ActionResult } from "../lib/action.ts";
import { deviceDisplayName, type StoredPairing } from "../lib/pairing-store.ts";
import DeviceCompanionInfo from "./DeviceCompanionInfo.tsx";
import DeviceLabelField from "./DeviceLabelField.tsx";
import FlashProxyButton from "./FlashProxyButton.tsx";
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
	const t = useT();
	const [open, setOpen] = useState(Boolean(t3AutoStart));
	const expanded = Boolean(t3AutoStart) || (onSelect ? selected : open);
	const online = Boolean(status);
	const networkLabel =
		status?.network?.type === "ethernet"
			? t("devices.ethernet")
			: status?.network?.type === "wifi"
				? status.network.ssid.trim()
					? t("devices.wifiSsid", { ssid: status.network.ssid.trim() })
					: t("nav.wifi")
				: "";
	const codeReady = Boolean(status?.t3?.paired);
	const showCodePair = !isEasy || t3AutoStart || !codeReady;

	function toggle() {
		if (onSelect) {
			onSelect(device.uuid);
			return;
		}
		setOpen((current) => !current);
	}

	return (
		<Paper className="w-full p-2" elevation={1}>
			<Stack spacing={expanded ? 1.5 : 0}>
				<Stack
					direction="row"
					spacing={1}
					className="cursor-pointer items-center"
					sx={{ minHeight: 48, px: 0.5 }}
					onClick={toggle}
				>
					<Typography variant="subtitle1" className="min-w-0 flex-1" noWrap>
						{deviceDisplayName(device)}
					</Typography>
					<Chip
						label={online ? t("devices.online") : t("devices.offline")}
						color={online ? "success" : "secondary"}
						variant="outlined"
						size="small"
					/>
					{selected ? (
						<Chip
							label={t("devices.selected")}
							color="primary"
							variant="outlined"
							size="small"
						/>
					) : null}
				</Stack>
				{expanded ? (
					<>
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
							{status?.model || status?.hardware ? (
								<Chip
									label={status?.model || status?.hardware}
									variant="outlined"
									size="small"
								/>
							) : null}
							{networkLabel ? (
								<Chip label={networkLabel} variant="outlined" size="small" />
							) : null}
							{status && !isEasy ? (
								<Chip
									label={
										status.tunnel?.configured
											? t("devices.tunnelReady")
											: t("devices.tunnelPending")
									}
									color={status.tunnel?.configured ? "success" : "secondary"}
									variant="outlined"
									size="small"
								/>
							) : null}
							{status ? (
								<>
									<Chip
										label={
											status.secrets?.githubReady
												? t("devices.projectsConnected")
												: t("devices.connectGithubChip")
										}
										color={status.secrets?.githubReady ? "success" : "warning"}
										variant="outlined"
										size="small"
									/>
									<Chip
										label={
											codeReady
												? t("devices.codeReady")
												: status.t3?.running
													? t("devices.codeRunning")
													: t("devices.codeIdle")
										}
										color={codeReady ? "success" : "secondary"}
										variant="outlined"
										size="small"
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
						<FlashProxyButton uuid={device.uuid} connected={online} />
						{isEasy ? null : (
							<GpioPanel uuid={device.uuid} connected={online} />
						)}
						<Stack direction="row" spacing={1} className="flex-wrap">
							{isEasy ? (
								<Button href="/devices/t3" variant="contained" size="small">
									{t("project.openCode")}
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
									{t("devices.unpairRevokes")}
								</Button>
							) : null}
						</Stack>
					</>
				) : null}
			</Stack>
		</Paper>
	);
}
