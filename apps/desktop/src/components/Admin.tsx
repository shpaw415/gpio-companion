import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import {
	adminTransfer,
	adminUnpair,
	deviceDisplayName,
	listAdminDevices,
	patchAdminLabel,
	startDeviceUpdate,
} from "../api";
import {
	CACHE_KEYS,
	useCachedQuery,
	useUserBoards,
} from "../hooks/useApiCache";
import CompanionInfo from "./CompanionInfo";
import DebugLog from "./DebugLog";
import { ListSkeleton } from "./skeletons";

export default function Admin() {
	const query = useCachedQuery(CACHE_KEYS.adminDevices, listAdminDevices);
	const { refetch: refetchBoards } = useUserBoards();
	const devices = query.data?.devices ?? [];
	const [filter, setFilter] = useState("");
	const [selected, setSelected] = useState("");
	const [label, setLabel] = useState("");
	const [error, setError] = useState("");
	const [updateNote, setUpdateNote] = useState("");
	const loading = query.loading;

	const visible = devices.filter((item) => {
		const hay =
			`${item.device.label ?? ""} ${item.device.uuid} ${item.device.login} ${item.device.email ?? ""}`.toLowerCase();
		return hay.includes(filter.trim().toLowerCase());
	});
	const current = devices.find((item) => item.device.uuid === selected);

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				Admin
			</Typography>
			{error || query.error ? (
				<Alert severity="error">{error || query.error}</Alert>
			) : null}
			{updateNote ? <Alert severity="success">{updateNote}</Alert> : null}
			{error || query.error ? <DebugLog error={error || query.error} /> : null}
			<TextField
				label="Filter"
				value={filter}
				onChange={(event) => setFilter(event.target.value)}
			/>
			{loading ? <ListSkeleton items={3} /> : null}
			{loading
				? null
				: visible.map((item) => (
						<Paper
							key={item.device.uuid}
							sx={{ p: 2, cursor: "pointer" }}
							elevation={item.device.uuid === selected ? 3 : 1}
							onClick={() => {
								setSelected(item.device.uuid);
								setLabel(item.device.label ?? "");
							}}
						>
							<Typography>{deviceDisplayName(item.device)}</Typography>
							<Typography color="secondary">
								{item.status ? "Online" : "Offline"}
								{item.device.email ? ` · ${item.device.email}` : ""}
							</Typography>
						</Paper>
					))}
			{current ? (
				<Paper sx={{ p: 3 }} elevation={1}>
					<Typography variant="h6">
						{deviceDisplayName(current.device)}
					</Typography>
					<Typography color="secondary" sx={{ wordBreak: "break-all" }}>
						{current.device.uuid}
					</Typography>
					<Stack
						direction="row"
						spacing={1}
						sx={{ mt: 2, alignItems: "flex-end" }}
					>
						<TextField
							label="Label"
							value={label}
							onChange={(event) => setLabel(event.target.value)}
							sx={{ flex: 1 }}
						/>
						<Button
							variant="text"
							onClick={() => {
								void patchAdminLabel(current.device.uuid, label)
									.then(() => {
										query.setData((currentList) => ({
											devices: (currentList?.devices ?? []).map((item) =>
												item.device.uuid === current.device.uuid
													? {
															...item,
															device: { ...item.device, label },
														}
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
						>
							Save
						</Button>
					</Stack>
					<Stack direction="row" spacing={1} sx={{ mt: 2 }}>
						<Button
							variant="text"
							onClick={() => {
								setError("");
								setUpdateNote("");
								void startDeviceUpdate(current.device.uuid)
									.then(() => {
										setUpdateNote("Update started. The board may restart.");
									})
									.catch((caught) => {
										setError(
											caught instanceof Error
												? caught.message
												: "update failed",
										);
									});
							}}
						>
							Update companion
						</Button>
					</Stack>
					<CompanionInfo key={current.device.uuid} uuid={current.device.uuid} />
					<Stack direction="row" spacing={1} sx={{ mt: 2 }}>
						<Button
							variant="text"
							onClick={() => {
								void adminTransfer(current.device.uuid)
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
						>
							Force transfer to me
						</Button>
						<Button
							color="error"
							variant="text"
							onClick={() => {
								if (!window.confirm("Unpair this board from its owner?")) {
									return;
								}
								void adminUnpair(current.device.uuid)
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
											caught instanceof Error
												? caught.message
												: "unpair failed",
										);
									});
							}}
						>
							Unpair from owner
						</Button>
					</Stack>
				</Paper>
			) : null}
		</Stack>
	);
}
