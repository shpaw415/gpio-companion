import { GET as listDebugDevices, POST as signDebugConnect } from "@api/debug";
import { GET as loadDeviceLogs } from "@api/debug/logs";
import { POST as startDeviceUpdate } from "@api/update";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useMemo, useState } from "react";
import DeviceDebugPanel from "../../components/DeviceDebugPanel.tsx";
import { SectionHeader } from "../../components/Section.tsx";
import { SelectSkeleton } from "../../components/skeletons.tsx";
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
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!session.data?.id) {
			setDevices([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		void run(listDebugDevices())
			.then((result) => {
				setDevices(result?.devices ?? []);
			})
			.finally(() => {
				setLoading(false);
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
					maintenance: device.maintenance,
				};
			}),
		[admin, devices],
	);

	return (
		<Stack spacing={3}>
			<SectionHeader title="Debug">
				<Typography color="secondary">
					Live companion API errors over WebSocket, plus disk space and a
					redacted last-24h journal excerpt. Owner or admin can start the same
					updater as the 24h timer. Boards ping when they are up; hourly cleanup
					keeps logs for a day.
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

			{loggedIn && loading ? <SelectSkeleton /> : null}

			{loggedIn && !loading && devices.length === 0 ? (
				<Alert severity="info">
					{admin
						? "No live companions. A board appears here when gpio-companion serve pings the dashboard."
						: "Pair a board, or wait until your companion is live."}
				</Alert>
			) : null}

			{loggedIn && devices.length > 0 ? (
				<DeviceDebugPanel
					devices={options}
					signConnect={signDebugConnect}
					loadLogs={loadDeviceLogs}
					startUpdate={startDeviceUpdate}
				/>
			) : null}
		</Stack>
	);
}
