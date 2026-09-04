import { useState } from "react";
import { Alert } from "react-native";
import {
	adminTransfer,
	adminUnpair,
	deviceDisplayName,
	listAdminDevices,
	patchAdminLabel,
	startDeviceUpdate,
} from "../lib/api.ts";
import { CACHE_KEYS, useCachedQuery, useUserBoards } from "../lib/api-cache.tsx";
import { useAuth } from "../lib/auth.tsx";
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

export default function Admin() {
	const auth = useAuth();
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
			<Title>Admin</Title>
			<ErrorText>{error || query.error}</ErrorText>
			{updateNote ? <Muted>{updateNote}</Muted> : null}
			<Field label="Filter" value={filter} onChangeText={setFilter} placeholder="Name, uuid, email" />
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
							{item.status ? "Online" : "Offline"}
							{item.device.email ? ` · ${item.device.email}` : ""}
						</Muted>
					</Paper>
				))
			)}
			{current && token ? (
				<Paper>
					<Body>{deviceDisplayName(current.device)}</Body>
					<Muted>{current.device.uuid}</Muted>
					<Field label="Label" value={label} onChangeText={setLabel} />
					<TextButton
						label="Save"
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
									setError(caught instanceof Error ? caught.message : "save failed");
								});
						}}
					/>
					<TextButton
						label="Update companion"
						onPress={() => {
							setError("");
							setUpdateNote("");
							void startDeviceUpdate(token, current.device.uuid)
								.then(() => {
									setUpdateNote("Update started. The board may restart.");
								})
								.catch((caught) => {
									setError(caught instanceof Error ? caught.message : "update failed");
								});
						}}
					/>
					<TextButton
						label="Force transfer to me"
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
										caught instanceof Error ? caught.message : "transfer failed",
									);
								});
						}}
					/>
					<TextButton
						danger
						label="Unpair from owner"
						onPress={() => {
							Alert.alert("Unpair", "Unpair this board from its owner?", [
								{ text: "Cancel", style: "cancel" },
								{
									text: "Unpair",
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
												void refetchBoards({ force: true }).catch(() => undefined);
											})
											.catch((caught) => {
												setError(
													caught instanceof Error ? caught.message : "unpair failed",
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
