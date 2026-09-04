import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useRef } from "react";
import { deviceDisplayName, t3AppUrl } from "../api";
import { useUserBoards } from "../hooks/useApiCache";
import { useBoardSelection } from "../hooks/useBoardSelection";
import { useT3Window } from "../hooks/useT3Window";
import { SelectSkeleton } from "./skeletons";

export default function T3() {
	const { uuid, setUuid } = useBoardSelection();
	const uuidRef = useRef(uuid);
	uuidRef.current = uuid;
	const { boards, loading } = useUserBoards();
	const t3 = useT3Window();

	useEffect(() => {
		if (
			boards.length > 0 &&
			!boards.some((board) => board.device.uuid === uuidRef.current)
		) {
			setUuid(boards[0]?.device.uuid ?? "");
		}
	}, [boards, setUuid]);

	function openWindow() {
		void t3.openUrl(t3AppUrl(uuid));
	}

	return (
		<Stack
			spacing={1}
			sx={{ flex: 1, minHeight: 0, height: "100%", display: "flex" }}
		>
			<Stack
				direction="row"
				spacing={1}
				sx={{ alignItems: "center", flexShrink: 0, px: 0.5, py: 0.5 }}
			>
				<Typography
					variant="subtitle1"
					Element="h1"
					sx={{ flexGrow: 1 }}
					noWrap
				>
					T3 Code
				</Typography>
				{loading ? (
					<SelectSkeleton height={40} />
				) : (
					<Select
						name="board"
						label="Board"
						value={uuid}
						onSelect={setUuid}
						disabled={boards.length === 0}
						sx={{ minWidth: 240 }}
					>
						{boards.map((board) => (
							<option key={board.device.uuid} value={board.device.uuid}>
								{deviceDisplayName(board.device)}
							</option>
						))}
					</Select>
				)}
				<Button
					variant="contained"
					disabled={!uuid || t3.busy}
					onClick={openWindow}
				>
					Open in a new window
				</Button>
			</Stack>
			<Paper
				elevation={1}
				sx={{
					flex: 1,
					minHeight: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					p: 4,
				}}
			>
				<Stack
					spacing={2}
					sx={{ alignItems: "center", maxWidth: 420, textAlign: "center" }}
				>
					{loading ? null : !uuid ? (
						<Typography color="secondary">
							Pair a board to open T3 Code.
						</Typography>
					) : t3.open ? (
						<>
							<Typography color="secondary">
								T3 Code is open in a window.
							</Typography>
							<Button variant="outlined" onClick={() => void t3.focus()}>
								Focus window
							</Button>
						</>
					) : (
						<>
							<Typography color="secondary">
								T3 Code runs in its own window.
							</Typography>
							<Button
								variant="contained"
								disabled={t3.busy}
								onClick={openWindow}
							>
								Open in a new window
							</Button>
						</>
					)}
				</Stack>
			</Paper>
		</Stack>
	);
}
