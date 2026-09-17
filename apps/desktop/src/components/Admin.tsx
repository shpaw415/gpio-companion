import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { translateError } from "gpio-companion-i18n";
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
import { useT } from "../locale";
import CompanionInfo from "./CompanionInfo";
import DebugLog from "./DebugLog";
import GpioPanel from "./GpioPanel";
import { ListSkeleton } from "./skeletons";

export default function Admin() {
	const t = useT();
	const query = useCachedQuery(CACHE_KEYS.adminDevices, listAdminDevices);
	const { refetch: refetchBoards } = useUserBoards();
	const devices = query.data?.devices ?? [];
	const [filter, setFilter] = useState("");
	const [selected, setSelected] = useState("");
	const [label, setLabel] = useState("");
	const [error, setError] = useState("");
	const [updateNote, setUpdateNote] = useState("");
	const loading = query.loading;
	const shown = translateError(t, error || query.error);

	const visible = devices.filter((item) => {
		const hay =
			`${item.device.label ?? ""} ${item.device.uuid} ${item.device.login} ${item.device.email ?? ""}`.toLowerCase();
		return hay.includes(filter.trim().toLowerCase());
	});
	const current = devices.find((item) => item.device.uuid === selected);

	return (
		<Stack spacing={1.5}>
			{shown ? <Alert severity="error">{shown}</Alert> : null}
			{updateNote ? <Alert severity="success">{updateNote}</Alert> : null}
			{shown ? <DebugLog error={shown} /> : null}
			<TextField
				label={t("admin.filter")}
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
								{item.status ? t("devices.online") : t("devices.offline")}
								{item.device.email ? ` · ${item.device.email}` : ""}
							</Typography>
						</Paper>
					))}
			{current ? (
				<Paper sx={{ p: 1.5 }} elevation={1}>
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
							label={t("devices.label")}
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
							{t("devices.save")}
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
										setUpdateNote(t("debug.updateStarted"));
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
							{t("debug.updateCompanion")}
						</Button>
					</Stack>
					<CompanionInfo key={current.device.uuid} uuid={current.device.uuid} />
					<GpioPanel
						key={`${current.device.uuid}-gpio`}
						uuid={current.device.uuid}
					/>
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
							{t("admin.forceTransferToMe")}
						</Button>
						<Button
							color="error"
							variant="text"
							onClick={() => {
								if (!window.confirm(t("admin.unpairConfirm"))) {
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
							{t("admin.unpairFromOwner")}
						</Button>
					</Stack>
				</Paper>
			) : null}
		</Stack>
	);
}
