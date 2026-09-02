import { GET as getPairing } from "@api/pair";
import Alert from "@shpaw415/mui-lite/Alert";
import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useRef, useState } from "react";
import DeviceSelect from "../../components/DeviceSelect.tsx";
import { SectionHeader } from "../../components/Section.tsx";
import { useActionError } from "../../hooks/useActionError.tsx";
import { useAuthSession } from "../../hooks/useAuth.ts";
import { useT3Session } from "../../hooks/useT3Session.tsx";
import type { StoredPairing } from "../../lib/pairing-store.ts";
import {
	pickT3DeviceUuid,
	T3_FRAME_SLOT_ID,
	t3AppUrl,
} from "../../lib/t3-url.ts";

export default function T3Page() {
	const session = useAuthSession();
	const { run } = useActionError();
	const { uuid, setUuid } = useT3Session();
	const uuidRef = useRef(uuid);
	uuidRef.current = uuid;
	const loggedIn = Boolean(session.data?.id || session.data?.email);
	const [devices, setDevices] = useState<StoredPairing[]>([]);
	const src = t3AppUrl(uuid);

	useEffect(() => {
		if (!session.data?.id) {
			setDevices([]);
			return;
		}
		void run(getPairing()).then((result) => {
			const next = result?.devices ?? [];
			setDevices(next);
			setUuid(pickT3DeviceUuid(next, uuidRef.current));
		});
	}, [session.data?.id, run, setUuid]);

	return (
		<Stack
			spacing={1}
			sx={{ flex: 1, minHeight: 0, height: "100%", display: "flex" }}
		>
			<SectionHeader title="T3 Code">
				<Typography color="secondary">
					Open the T3 Code session on a paired Pi. Leaving this tab keeps the
					page you were on.
				</Typography>
			</SectionHeader>

			{!loggedIn ? (
				<Alert severity="info">
					<Button href="/login" variant="text">
						Sign in
					</Button>{" "}
					to open T3 Code on a paired board.
				</Alert>
			) : null}

			{loggedIn && devices.length === 0 ? (
				<Alert severity="info">
					<Button href="/devices/pair" variant="text">
						Pair a board
					</Button>{" "}
					to load T3 Code here.
				</Alert>
			) : null}

			{loggedIn && devices.length > 0 ? (
				<>
					<Stack direction="row" spacing={1} className="flex-wrap items-end">
						<Box sx={{ flex: 1, minWidth: 220 }}>
							<DeviceSelect
								devices={devices}
								value={uuid}
								onChange={setUuid}
								label="Companion"
							/>
						</Box>
						{src ? (
							<Button
								variant="text"
								onClick={() => {
									window.open(src, "_blank", "noopener,noreferrer");
								}}
							>
								Open
							</Button>
						) : null}
					</Stack>
					<Box
						id={T3_FRAME_SLOT_ID}
						sx={{ flex: 1, minHeight: 240, width: "100%" }}
					/>
				</>
			) : null}
		</Stack>
	);
}
