import { useState } from "react";
import { Alert, Text } from "react-native";
import {
	type BoardView,
	deviceDisplayName,
	patchDeviceLabel,
} from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { useColors } from "../lib/color-mode.tsx";
import T3Pairing from "./T3Pairing.tsx";
import { Chip, Field, Paper, Row, TextButton } from "./ui.tsx";

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
	const auth = useAuth();
	const colors = useColors();
	const { device, status } = board;
	const online = Boolean(status);
	const [label, setLabel] = useState(device.label ?? "");
	const [saving, setSaving] = useState(false);

	async function saveLabel() {
		if (!auth.token) {
			return;
		}
		setSaving(true);
		try {
			await patchDeviceLabel(auth.token, device.uuid, label);
			onLabelSaved?.(device.uuid, label);
		} finally {
			setSaving(false);
		}
	}

	return (
		<Paper selected={selected}>
			<Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
				{deviceDisplayName(device)}
			</Text>
			<Text style={{ color: colors.muted }} selectable>
				{device.uuid}
			</Text>
			{device.deviceUrl ? (
				<Text style={{ color: colors.muted }} selectable>
					{device.deviceUrl}
				</Text>
			) : null}
			<Field label="Label" value={label} onChangeText={setLabel} placeholder="Optional name" />
			<TextButton
				label={saving ? "Saving…" : "Save"}
				disabled={saving}
				onPress={() => void saveLabel()}
			/>
			<Row>
				<Chip label={online ? "Online" : "Offline"} tone={online ? "success" : "muted"} />
				{selected ? <Chip label="Selected" tone="primary" filled /> : null}
				{status?.model || status?.hardware ? (
					<Chip label={status?.model || status?.hardware || ""} />
				) : null}
				{status ? (
					<>
						<Chip
							label={status.tunnel?.configured ? "tunnel ready" : "tunnel pending"}
							tone={status.tunnel?.configured ? "success" : "muted"}
						/>
						<Chip
							label={status.secrets?.githubReady ? "GitHub ready" : "GitHub keys pending"}
							tone={status.secrets?.githubReady ? "success" : "warning"}
						/>
						<Chip
							label={
								status.t3?.paired
									? "T3 Code paired"
									: status.t3?.running
										? "T3 Code running"
										: "T3 Code idle"
							}
							tone={status.t3?.paired ? "success" : "muted"}
						/>
					</>
				) : null}
			</Row>
			<T3Pairing uuid={device.uuid} initial={status?.t3} />
			<Row>
				{onSelect ? (
					<TextButton
						label={selected ? "Selected" : "Select board"}
						disabled={selected}
						onPress={() => onSelect(device.uuid)}
					/>
				) : null}
				{onUnpair ? (
					<TextButton
						danger
						label="Unpair"
						onPress={() => {
							Alert.alert("Unpair", "Remove this board from your account?", [
								{ text: "Cancel", style: "cancel" },
								{
									text: "Unpair",
									style: "destructive",
									onPress: () => onUnpair(device.uuid),
								},
							]);
						}}
					/>
				) : null}
			</Row>
		</Paper>
	);
}
