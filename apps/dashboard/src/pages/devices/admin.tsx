import { GET as listAdminDevices } from "@api/admin/devices";
import { POST as signWifi } from "@api/wifi";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import { TablePagination } from "@shpaw415/mui-lite/Pagination";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Table, {
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
} from "@shpaw415/mui-lite/Table";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { envelopeToPasteText } from "gpio-companion";
import { useEffect, useMemo, useState } from "react";
import CopyBlock from "../../components/CopyBlock.tsx";
import { SectionHeader } from "../../components/Section.tsx";
import T3PairingPanel from "../../components/T3PairingPanel.tsx";
import { useActionError } from "../../hooks/useActionError.tsx";
import { useAuthSession } from "../../hooks/useAuth.ts";
import { unwrapAction } from "../../lib/action.ts";
import { isAdmin } from "../../lib/auth/role.ts";
import {
	deviceDisplayName,
	type PublicPairing,
} from "../../lib/pairing-store.ts";

type DeviceStatus = {
	hardware?: string;
	tunnel?: { configured?: boolean };
	secrets?: { githubReady?: boolean };
	t3?: {
		running?: boolean;
		pairingUrl?: string;
		pairingToken?: string;
		paired?: boolean;
		serviceInstalled?: boolean;
	};
};

type BoardView = {
	device: PublicPairing;
	status: DeviceStatus | null;
};

export default function AdminDevicesPage() {
	const session = useAuthSession();
	const { run } = useActionError();
	const admin = isAdmin(session.data?.role);
	const [boards, setBoards] = useState<BoardView[]>([]);
	const [selected, setSelected] = useState("");
	const [query, setQuery] = useState("");
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState<10 | 25 | 50 | 100>(10);
	const [ssid, setSsid] = useState("");
	const [psk, setPsk] = useState("");
	const [pasteText, setPasteText] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!session.data?.id || !admin) {
			setBoards([]);
			return;
		}
		void run(listAdminDevices()).then((result) => {
			setBoards(
				(result?.devices ?? []).map((item) => ({
					device: item.device,
					status: item.status as DeviceStatus | null,
				})),
			);
		});
	}, [session.data?.id, admin, run]);

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) {
			return boards;
		}
		return boards.filter((board) => {
			const haystack = [
				board.device.uuid,
				board.device.label,
				board.device.userId,
				board.device.email,
				board.device.login,
				board.device.deviceUrl,
			]
				.join(" ")
				.toLowerCase();
			return haystack.includes(needle);
		});
	}, [boards, query]);

	const paged = filtered.slice(
		page * rowsPerPage,
		page * rowsPerPage + rowsPerPage,
	);
	const current = boards.find((board) => board.device.uuid === selected);

	async function sendWifi() {
		if (!selected || !ssid || !psk) {
			return;
		}
		setBusy(true);
		try {
			const envelope = unwrapAction(
				await signWifi({ uuid: selected, ssid, psk }),
			);
			setPasteText(envelopeToPasteText(envelope));
			setPsk("");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Stack spacing={3}>
			<SectionHeader title="Admin devices">
				<Typography color="secondary">
					Debug and maintain every account’s Pi. Status, T3, and WiFi only.
				</Typography>
			</SectionHeader>

			{!session.data?.id && !session.data?.email ? (
				<Alert severity="info">
					<Button href="/login" variant="text">
						Sign in
					</Button>{" "}
					as an admin to see every board.
				</Alert>
			) : null}

			{session.data?.id && !admin ? (
				<Alert severity="error">admin only</Alert>
			) : null}

			{admin ? (
				<>
					<Paper className="p-4" elevation={1}>
						<Stack spacing={2}>
							<TextField
								label="Filter"
								value={query}
								onChange={(event) => {
									setQuery(event.target.value);
									setPage(0);
								}}
								className="max-w-sm"
							/>
							<TableContainer>
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell>Label</TableCell>
											<TableCell>UUID</TableCell>
											<TableCell>Owner</TableCell>
											<TableCell>Device URL</TableCell>
											<TableCell>Status</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{paged.map((board) => (
											<TableRow
												key={board.device.uuid}
												hover
												selected={selected === board.device.uuid}
												onClick={() => {
													setSelected(board.device.uuid);
													setPasteText("");
												}}
											>
												<TableCell>{board.device.label || "—"}</TableCell>
												<TableCell>{board.device.uuid}</TableCell>
												<TableCell>
													{board.device.email ||
														board.device.login ||
														board.device.userId}
												</TableCell>
												<TableCell>{board.device.deviceUrl}</TableCell>
												<TableCell>
													{board.status ? (
														<Stack
															direction="row"
															spacing={1}
															className="flex-wrap"
														>
															{board.status.hardware ? (
																<Chip
																	label={board.status.hardware}
																	variant="outlined"
																/>
															) : null}
															<Chip
																label={
																	board.status.t3?.serviceInstalled
																		? "T3 installed"
																		: board.status.t3?.running
																			? "T3 running"
																			: "T3 idle"
																}
																variant="outlined"
															/>
														</Stack>
													) : (
														<Typography color="secondary" variant="body2">
															offline
														</Typography>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</TableContainer>
							{filtered.length === 0 ? (
								<Typography color="secondary">No boards.</Typography>
							) : (
								<TablePagination
									count={filtered.length}
									page={page}
									rowsPerPage={rowsPerPage}
									onPageChange={(_event, nextPage) => setPage(nextPage)}
									onRowsPerPageChange={(next) => {
										setRowsPerPage(next);
										setPage(0);
									}}
								/>
							)}
						</Stack>
					</Paper>

					{current ? (
						<Paper className="max-w-2xl p-6" elevation={1}>
							<Stack spacing={2}>
								<Typography variant="h6">
									{deviceDisplayName(current.device)}
								</Typography>
								<Typography color="secondary">{current.device.uuid}</Typography>
								<Typography color="secondary">
									{current.device.email ||
										current.device.login ||
										current.device.userId}
								</Typography>
								<T3PairingPanel
									key={current.device.uuid}
									devices={[current.device]}
									uuid={current.device.uuid}
									initialStatus={current.status?.t3}
									skipFetch
								/>
								<TextField
									label="SSID"
									value={ssid}
									onChange={(event) => setSsid(event.target.value)}
									className="w-full"
								/>
								<TextField
									label="WiFi password"
									type="password"
									autoComplete="off"
									value={psk}
									onChange={(event) => setPsk(event.target.value)}
									className="w-full"
								/>
								<Button
									variant="contained"
									disabled={busy || !ssid || !psk}
									onClick={() => void sendWifi()}
								>
									Sign WiFi
								</Button>
								{pasteText ? (
									<CopyBlock
										label="Signed Bluetooth command"
										value={pasteText}
									/>
								) : null}
							</Stack>
						</Paper>
					) : null}
				</>
			) : null}
		</Stack>
	);
}
