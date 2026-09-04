import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import {
	type BoardView,
	deviceDisplayName,
	patchDeviceLabel,
} from "../api";
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
	const { device, status } = board;
	const online = Boolean(status);
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
						label="Label"
						placeholder="Optional name"
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
						Save
					</Button>
				</Stack>
				<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
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
				<T3Pairing uuid={device.uuid} initial={status?.t3} />
				<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
					{onSelect ? (
						<Button
							variant={selected ? "contained" : "outlined"}
							size="small"
							disabled={selected}
							onClick={() => onSelect(device.uuid)}
						>
							{selected ? "Selected" : "Select board"}
						</Button>
					) : null}
					{onUnpair ? (
						<Button
							color="error"
							variant="text"
							size="small"
							onClick={() => {
								if (
									!window.confirm("Remove this board from your account?")
								) {
									return;
								}
								onUnpair(device.uuid);
							}}
						>
							Unpair
						</Button>
					) : null}
				</Stack>
			</Stack>
		</Paper>
	);
}
