import { useState } from "react";
import { Alert } from "react-native";
import CompanionInfo from "../components/CompanionInfo.tsx";
import GpioPanel from "../components/GpioPanel.tsx";
import {
	Body,
	ErrorText,
	Field,
	Muted,
	Paper,
	Screen,
	Skeleton,
	TextButton,
	Title,
} from "../components/ui.tsx";
import {
	adminTransfer,
	adminUnpair,
	deviceDisplayName,
	listAdminDevices,
	patchAdminLabel,
	startDeviceUpdate,
} from "../lib/api.ts";
import {
	CACHE_KEYS,
	useCachedQuery,
	useUserBoards,
} from "../lib/api-cache.tsx";
import { useAuth } from "../lib/auth.tsx";
import { translateError, useT } from "../lib/locale.tsx";

export default function Admin() {
	const auth = useAuth();
	const t = useT();
	const token = auth.token;
	const query = useCachedQuery(CACHE_KEYS.adminDevices, () => {
		if (!token) {
			return Promise.reject(new Error("sign in first"));
		}
		return listAdminDevices(token);
	});
	const { refetch: refetchBoards } = useUserBoards();
	const devices = query.data?.devices ?? [];
	const [filter, setFilter] = useState("");
	const [selected, setSelected] = useState("");
	const [label, setLabel] = useState("");
	const [error, setError] = useState("");
	const [updateNote, setUpdateNote] = useState("");

	const visible = devices.filter((item) => {
		const hay =
			`${item.device.label ?? ""} ${item.device.uuid} ${item.device.login} ${item.device.email ?? ""}`.toLowerCase();
		return hay.includes(filter.trim().toLowerCase());
	});
	const current = devices.find((item) => item.device.uuid === selected);

	return (
		<Screen>
			<Title>{t("admin.title")}</Title>
			<ErrorText>{translateError(t, error || query.error || "")}</ErrorText>
			{updateNote ? <Muted>{updateNote}</Muted> : null}
			<Field
				label={t("admin.filter")}
				value={filter}
				onChangeText={setFilter}
				placeholder={t("admin.filterPlaceholder")}
			/>
			{query.loading ? (
				<>
					<Skeleton />
					<Skeleton />
				</>
			) : (
				visible.map((item) => (
					<Paper
						key={item.device.uuid}
						selected={item.device.uuid === selected}
						onPress={() => {
							setSelected(item.device.uuid);
							setLabel(item.device.label ?? "");
						}}
					>
						<Body>{deviceDisplayName(item.device)}</Body>
						<Muted>
							{item.status ? t("devices.online") : t("devices.offline")}
							{item.device.email ? ` · ${item.device.email}` : ""}
						</Muted>
					</Paper>
				))
			)}
			{current && token ? (
				<Paper>
					<Body>{deviceDisplayName(current.device)}</Body>
					<Muted>{current.device.uuid}</Muted>
					<Field
						label={t("devices.label")}
						value={label}
						onChangeText={setLabel}
					/>
					<TextButton
						label={t("devices.save")}
						onPress={() => {
							void patchAdminLabel(token, current.device.uuid, label)
								.then(() => {
									query.setData((currentList) => ({
										devices: (currentList?.devices ?? []).map((item) =>
											item.device.uuid === current.device.uuid
												? { ...item, device: { ...item.device, label } }
												: item,
										),
									}));
									void refetchBoards({ force: true }).catch(() => undefined);
								})
								.catch((caught) => {
									setError(
										caught instanceof Error ? caught.message : "save failed",
									);
								});
						}}
					/>
					<CompanionInfo key={current.device.uuid} uuid={current.device.uuid} />
					<GpioPanel
						key={`${current.device.uuid}-gpio`}
						uuid={current.device.uuid}
					/>
					<TextButton
						label={t("debug.updateCompanion")}
						onPress={() => {
							setError("");
							setUpdateNote("");
							void startDeviceUpdate(token, current.device.uuid)
								.then(() => {
									setUpdateNote(t("debug.updateStarted"));
								})
								.catch((caught) => {
									setError(
										caught instanceof Error ? caught.message : "update failed",
									);
								});
						}}
					/>
					<TextButton
						label={t("admin.forceTransferToMe")}
						onPress={() => {
							void adminTransfer(token, current.device.uuid)
								.then((result) => {
									query.setData((currentList) => ({
										devices: (currentList?.devices ?? []).map((item) =>
											item.device.uuid === current.device.uuid
												? { ...item, device: result.device }
												: item,
										),
									}));
									void refetchBoards({ force: true }).catch(() => undefined);
								})
								.catch((caught) => {
									setError(
										caught instanceof Error
											? caught.message
											: "transfer failed",
									);
								});
						}}
					/>
					<TextButton
						danger
						label={t("admin.unpairFromOwner")}
						onPress={() => {
							Alert.alert(t("devices.unpairTitle"), t("admin.unpairConfirm"), [
								{ text: t("admin.cancel"), style: "cancel" },
								{
									text: t("devices.unpair"),
									style: "destructive",
									onPress: () => {
										void adminUnpair(token, current.device.uuid)
											.then(() => {
												query.setData((currentList) => ({
													devices: (currentList?.devices ?? []).filter(
														(item) => item.device.uuid !== current.device.uuid,
													),
												}));
												setSelected("");
												void refetchBoards({ force: true }).catch(
													() => undefined,
												);
											})
											.catch((caught) => {
												setError(
													caught instanceof Error
														? caught.message
														: "unpair failed",
												);
											});
									},
								},
							]);
						}}
					/>
				</Paper>
			) : null}
		</Screen>
	);
}
