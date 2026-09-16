import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import { type BoardView, deviceDisplayName, patchDeviceLabel } from "../api";
import { formatNetworkLabel } from "../device-info";
import { useT } from "../locale";
import CompanionInfo from "./CompanionInfo";
import FlashProxyButton from "./FlashProxyButton";
import GpioPanel from "./GpioPanel";
import T3Pairing from "./T3Pairing";

export default function BoardCard({
	board,
	selected,
	onSelect,
	onUnpair,
	onLabelSaved,
}: {
	board: BoardView;
	selected?: boolean;
	onSelect?: (uuid: string) => void;
	onUnpair?: (uuid: string) => void;
	onLabelSaved?: (uuid: string, label: string) => void;
}) {
	const t = useT();
	const { device, status } = board;
	const online = Boolean(status);
	const networkLabel = formatNetworkLabel(status?.network, t);
	const [label, setLabel] = useState(device.label ?? "");
	const [saving, setSaving] = useState(false);

	async function saveLabel() {
		setSaving(true);
		try {
			await patchDeviceLabel(device.uuid, label);
			onLabelSaved?.(device.uuid, label);
		} finally {
			setSaving(false);
		}
	}

	return (
		<Paper sx={{ p: 3 }} elevation={1}>
			<Stack spacing={2}>
				<Typography variant="h6">{deviceDisplayName(device)}</Typography>
				<Typography color="secondary" sx={{ wordBreak: "break-all" }}>
					{device.uuid}
				</Typography>
				{device.deviceUrl ? (
					<Typography color="secondary" sx={{ wordBreak: "break-all" }}>
						{device.deviceUrl}
					</Typography>
				) : null}
				<Stack
					direction="row"
					spacing={1}
					sx={{ alignItems: "flex-end", flexWrap: "wrap" }}
				>
					<TextField
						label={t("devices.label")}
						placeholder={t("devices.optionalName")}
						value={label}
						onChange={(event) => setLabel(event.target.value)}
						sx={{ flex: 1, minWidth: 180 }}
					/>
					<Button
						variant="outlined"
						size="small"
						disabled={saving}
						onClick={() => void saveLabel()}
					>
						{t("devices.save")}
					</Button>
				</Stack>
				<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
					<Chip
						label={online ? t("devices.online") : t("devices.offline")}
						color={online ? "success" : "secondary"}
						variant="outlined"
					/>
					{selected ? (
						<Chip
							label={t("devices.selected")}
							color="primary"
							variant="outlined"
						/>
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
					{status ? (
						<>
							<Chip
								label={
									status.tunnel?.configured
										? t("devices.tunnelReady")
										: t("devices.tunnelPending")
								}
								color={status.tunnel?.configured ? "success" : "secondary"}
								variant="outlined"
							/>
							<Chip
								label={
									status.secrets?.githubReady
										? t("devices.githubReady")
										: t("devices.githubKeysPending")
								}
								color={status.secrets?.githubReady ? "success" : "warning"}
								variant="outlined"
							/>
							<Chip
								label={
									status.t3?.paired
										? t("devices.t3Paired")
										: status.t3?.running
											? t("devices.t3Running")
											: t("devices.t3Idle")
								}
								color={status.t3?.paired ? "success" : "secondary"}
								variant="outlined"
							/>
						</>
					) : null}
				</Stack>
				<T3Pairing uuid={device.uuid} initial={status?.t3} />
				<CompanionInfo key={device.uuid} uuid={device.uuid} />
				<FlashProxyButton uuid={device.uuid} connected={online} />
				<GpioPanel
					key={`${device.uuid}-gpio`}
					uuid={device.uuid}
					connected={Boolean(status)}
				/>
				<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
					{onSelect ? (
						<Button
							variant={selected ? "contained" : "outlined"}
							size="small"
							disabled={selected}
							onClick={() => onSelect(device.uuid)}
						>
							{selected ? t("devices.selected") : t("devices.selectBoard")}
						</Button>
					) : null}
					{onUnpair ? (
						<Button
							color="error"
							variant="text"
							size="small"
							onClick={() => {
								if (!window.confirm(t("devices.unpairConfirm"))) {
									return;
								}
								onUnpair(device.uuid);
							}}
						>
							{t("devices.unpair")}
						</Button>
					) : null}
				</Stack>
			</Stack>
		</Paper>
	);
}
