import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import {
	type BoardView,
	deviceDisplayName,
	patchDeviceLabel,
} from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { useColors } from "../lib/color-mode.tsx";
import { useDashboardMode } from "../lib/dashboard-mode.tsx";
import { useDeviceHub } from "../lib/device-hub.tsx";
import { useT } from "../lib/locale.tsx";
import CompanionInfo from "./CompanionInfo.tsx";
import FlashProxyButton from "./FlashProxyButton.tsx";
import GpioPanel from "./GpioPanel.tsx";
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
	const t = useT();
	const colors = useColors();
	const { isEasy } = useDashboardMode();
	const { setTab } = useDeviceHub();
	const { device, status } = board;
	const online = Boolean(status);
	const networkLabel =
		status?.network?.type === "ethernet"
			? t("devices.ethernet")
			: status?.network?.type === "wifi"
				? status.network.ssid?.trim()
					? t("devices.wifiSsid", { ssid: status.network.ssid.trim() })
					: t("nav.wifi")
				: "";
	const [label, setLabel] = useState(device.label ?? "");
	const [saving, setSaving] = useState(false);
	const [open, setOpen] = useState(false);
	const expanded = onSelect ? Boolean(selected) : open;

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

	function toggle() {
		if (onSelect) {
			onSelect(device.uuid);
			return;
		}
		setOpen((current) => !current);
	}

	return (
		<Paper selected={selected}>
			<Pressable
				onPress={toggle}
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					minHeight: 44,
				}}
			>
				<Text
					style={{
						color: colors.text,
						fontWeight: "700",
						fontSize: 16,
						flex: 1,
					}}
					numberOfLines={1}
				>
					{deviceDisplayName(device)}
				</Text>
				<Chip
					label={online ? t("devices.online") : t("devices.offline")}
					tone={online ? "success" : "muted"}
				/>
				{selected ? (
					<Chip label={t("devices.selected")} tone="primary" filled />
				) : null}
			</Pressable>
			{expanded ? (
				<View style={{ gap: 8 }}>
					{isEasy ? null : (
						<>
							<Text style={{ color: colors.muted }} selectable>
								{device.uuid}
							</Text>
							{device.deviceUrl ? (
								<Text style={{ color: colors.muted }} selectable>
									{device.deviceUrl}
								</Text>
							) : null}
						</>
					)}
					<Field
						label={t("devices.label")}
						value={label}
						onChangeText={setLabel}
						placeholder={t("devices.optionalName")}
					/>
					<TextButton
						label={saving ? t("project.saving") : t("devices.save")}
						disabled={saving}
						onPress={() => void saveLabel()}
					/>
					<Row>
						{status?.model || status?.hardware ? (
							<Chip label={status?.model || status?.hardware || ""} />
						) : null}
						{networkLabel ? <Chip label={networkLabel} /> : null}
						{status && !isEasy ? (
							<Chip
								label={
									status.tunnel?.configured
										? t("devices.tunnelReady")
										: t("devices.tunnelPending")
								}
								tone={status.tunnel?.configured ? "success" : "muted"}
							/>
						) : null}
						{status ? (
							<>
								<Chip
									label={
										status.secrets?.githubReady
											? t("devices.githubReady")
											: t("devices.githubKeysPending")
									}
									tone={status.secrets?.githubReady ? "success" : "warning"}
								/>
								<Chip
									label={
										status.t3?.paired
											? t("devices.t3Paired")
											: status.t3?.running
												? t("devices.t3Running")
												: t("devices.t3Idle")
									}
									tone={status.t3?.paired ? "success" : "muted"}
								/>
							</>
						) : null}
					</Row>
					{isEasy && status?.t3?.paired ? null : (
						<T3Pairing uuid={device.uuid} initial={status?.t3} />
					)}
					{isEasy ? null : (
						<CompanionInfo key={device.uuid} uuid={device.uuid} />
					)}
					<FlashProxyButton uuid={device.uuid} connected={online} />
					{isEasy ? null : (
						<GpioPanel
							key={`${device.uuid}-gpio`}
							uuid={device.uuid}
							connected={Boolean(status)}
						/>
					)}
					<Row>
						{isEasy ? (
							<TextButton
								label={t("project.openCode")}
								onPress={() => setTab("t3")}
							/>
						) : null}
						{onUnpair ? (
							<TextButton
								danger
								label={t("devices.unpair")}
								onPress={() => {
									Alert.alert(
										t("devices.unpairTitle"),
										t("devices.unpairConfirm"),
										[
											{ text: t("admin.cancel"), style: "cancel" },
											{
												text: t("devices.unpair"),
												style: "destructive",
												onPress: () => onUnpair(device.uuid),
											},
										],
									);
								}}
							/>
						) : null}
					</Row>
				</View>
			) : null}
		</Paper>
	);
}
