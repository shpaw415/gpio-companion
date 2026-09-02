import { GET as listDebugDevices, POST as mintDebugTicket } from "@api/debug";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useMemo, useState } from "react";
import DeviceDebugPanel from "../../components/DeviceDebugPanel.tsx";
import { SectionHeader } from "../../components/Section.tsx";
import { useActionError } from "../../hooks/useActionError.tsx";
import { useAuthSession } from "../../hooks/useAuth.ts";
import { isAdmin } from "../../lib/auth/role.ts";
import type { DebugBoard } from "../../lib/debug-live.ts";

export default function DeviceDebugPage() {
	const session = useAuthSession();
	const { run } = useActionError();
	const admin = isAdmin(session.data?.role);
	const loggedIn = Boolean(session.data?.id || session.data?.email);
	const [devices, setDevices] = useState<DebugBoard[]>([]);

	useEffect(() => {
		if (!session.data?.id) {
			setDevices([]);
			return;
		}
		void run(listDebugDevices()).then((result) => {
			setDevices(result?.devices ?? []);
		});
	}, [session.data?.id, run]);

	const options = useMemo(
		() =>
			devices.map((device) => {
				const bits = [
					device.label,
					device.live ? "live" : null,
					device.paired ? null : "unpaired",
					admin ? device.email || device.login : null,
				].filter(Boolean);
				return {
					uuid: device.uuid,
					deviceUrl: device.deviceUrl,
					label: bits.join(" · ") || device.uuid,
				};
			}),
		[admin, devices],
	);

	return (
		<Stack spacing={3}>
			<SectionHeader title="Debug">
				<Typography color="secondary">
					Live errors and warnings from the companion API over WebSocket. Boards
					ping the dashboard when they are up; admins can connect without
					pairing.
				</Typography>
			</SectionHeader>

			{!loggedIn ? (
				<Alert severity="info">
					<Button href="/login" variant="text">
						Sign in
					</Button>{" "}
					to stream companion request logs.
				</Alert>
			) : null}

			{loggedIn && devices.length === 0 ? (
				<Alert severity="info">
					{admin
						? "No live companions. A board appears here when gpio-companion serve pings the dashboard."
						: "Pair a board, or wait until your companion is live."}
				</Alert>
			) : null}

			{loggedIn && devices.length > 0 ? (
				<DeviceDebugPanel devices={options} mintTicket={mintDebugTicket} />
			) : null}
		</Stack>
	);
}
