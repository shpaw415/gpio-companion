import { GET as getPairing } from "@api/pair";
import Alert from "@shpaw415/mui-lite/Alert";
import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import { useEffect, useRef, useState } from "react";
import DeviceSelect from "../../components/DeviceSelect.tsx";
import { SelectSkeleton } from "../../components/skeletons.tsx";
import { useActionError } from "../../hooks/useActionError.tsx";
import { useAuthSession } from "../../hooks/useAuth.ts";
import { useBoardSelection } from "../../hooks/useBoardSelection.tsx";
import type { StoredPairing } from "../../lib/pairing-store.ts";
import {
	pickT3DeviceUuid,
	readT3PairLocation,
	T3_FRAME_SLOT_ID,
	t3AppUrl,
} from "../../lib/t3-url.ts";

export default function T3Page() {
	const session = useAuthSession();
	const { run } = useActionError();
	const { uuid, setUuid } = useBoardSelection();
	const uuidRef = useRef(uuid);
	uuidRef.current = uuid;
	const loggedIn = Boolean(session.data?.id || session.data?.email);
	const [devices, setDevices] = useState<StoredPairing[]>([]);
	const [loading, setLoading] = useState(true);
	const src = t3AppUrl(uuid);

	useEffect(() => {
		if (!session.data?.id) {
			setDevices([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		void run(getPairing())
			.then((result) => {
				const next = result?.devices ?? [];
				setDevices(next);
				setUuid(
					pickT3DeviceUuid(next, readT3PairLocation().uuid || uuidRef.current),
				);
			})
			.finally(() => {
				setLoading(false);
			});
	}, [session.data?.id, run, setUuid]);

	return (
		<Stack
			spacing={0}
			sx={{
				flex: 1,
				minHeight: 0,
				height: "100%",
				display: "flex",
				overflow: "hidden",
			}}
		>
			<Stack
				spacing={1}
				direction="row"
				sx={{
					alignItems: "center",
					flexShrink: 0,
					px: 1.5,
					py: 0.5,
					minHeight: 0,
				}}
			>
				{!loggedIn ? (
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Alert severity="info">
							<Button href="/login" variant="text" size="small">
								Sign in
							</Button>{" "}
							to open Code on a paired board.
						</Alert>
					</Box>
				) : null}

				{loggedIn && loading ? (
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<SelectSkeleton height={40} />
					</Box>
				) : null}

				{loggedIn && !loading && devices.length === 0 ? (
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Alert severity="info">
							<Button href="/devices" variant="text" size="small">
								Pair a board
							</Button>{" "}
							to load Code here.
						</Alert>
					</Box>
				) : null}

				{loggedIn && devices.length > 0 ? (
					<>
						<Box sx={{ flex: 1, minWidth: 0 }}>
							<DeviceSelect
								devices={devices}
								value={uuid}
								onChange={setUuid}
								label="Board"
							/>
						</Box>
						{src ? (
							<Button
								variant="text"
								size="small"
								onClick={() => {
									window.open(src, "_blank", "noopener,noreferrer");
								}}
							>
								Open
							</Button>
						) : null}
					</>
				) : null}
			</Stack>
			{loggedIn && devices.length > 0 ? (
				<Box
					id={T3_FRAME_SLOT_ID}
					sx={{ flex: 1, minHeight: 0, width: "100%" }}
				/>
			) : null}
		</Stack>
	);
}
