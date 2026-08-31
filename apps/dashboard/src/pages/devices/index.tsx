import { GET as getDevice } from "@api/device";
import { GET as getPairing } from "@api/pair";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { useActionError } from "../../hooks/useActionError.tsx";
import { useAuthSession } from "../../hooks/useAuth.ts";
import SectionHub, { SectionHeader } from "../../components/Section.tsx";

type DeviceStatus = {
	hardware?: string;
	tunnel?: { configured?: boolean; apiHostname?: string };
	secrets?: { githubReady?: boolean; gpioAiKey?: boolean };
	t3?: { running?: boolean; serviceInstalled?: boolean };
};

export default function DevicesPage() {
	const session = useAuthSession();
	const { run } = useActionError();
	const loggedIn = Boolean(session.data?.id || session.data?.email);
	const [paired, setPaired] = useState(false);
	const [deviceUrl, setDeviceUrl] = useState("");
	const [status, setStatus] = useState<DeviceStatus | null>(null);

	useEffect(() => {
		if (!session.data?.id) {
			setPaired(false);
			setDeviceUrl("");
			setStatus(null);
			return;
		}
		void run(getPairing()).then(async (result) => {
				if (!result?.paired) {
					setPaired(false);
					return;
				}
				setPaired(true);
				setDeviceUrl(result.device.deviceUrl);
				const device = await run(getDevice());
				if (device?.paired) {
					setStatus(device.status as DeviceStatus);
				} else {
					setStatus(null);
				}
			});
	}, [session.data?.id]);

	return (
		<Stack spacing={3}>
			<SectionHeader title="Devices">
				<Typography color="secondary">
					Boards paired to your account and how they reach the dashboard.
				</Typography>
			</SectionHeader>

			{!loggedIn ? (
				<Alert severity="info">
					<Button href="/login" variant="text">
						Sign in
					</Button>{" "}
					to manage your boards.
				</Alert>
			) : null}

			{loggedIn && !paired ? (
				<Alert severity="info">
					<Button href="/devices/pair" variant="text">
						Pair a board
					</Button>{" "}
					to use the device API from this dashboard.
				</Alert>
			) : null}

			{paired ? (
				<Paper className="max-w-2xl p-6" elevation={1}>
					<Stack spacing={2}>
						<Typography variant="h6">Paired board</Typography>
						{deviceUrl ? (
							<Typography color="secondary">{deviceUrl}</Typography>
						) : null}
						{status ? (
							<Stack direction="row" spacing={1} className="flex-wrap">
								{status.hardware ? (
									<Chip label={status.hardware} variant="outlined" />
								) : null}
								<Chip
									label={
										status.tunnel?.configured ? "tunnel ready" : "tunnel pending"
									}
									color={status.tunnel?.configured ? "success" : "secondary"}
									variant="outlined"
								/>
								<Chip
									label={status.secrets?.githubReady ? "GitHub ready" : "GitHub keys pending"}
									color={status.secrets?.githubReady ? "success" : "warning"}
									variant="outlined"
								/>
								<Chip
									label={
										status.t3?.serviceInstalled
											? "T3 Code installed"
											: status.t3?.running
												? "T3 Code running"
												: "T3 Code idle"
									}
									color={
										status.t3?.serviceInstalled ? "success" : "secondary"
									}
									variant="outlined"
								/>
							</Stack>
						) : (
							<Typography color="secondary">
								Board status unavailable — is the Pi online?
							</Typography>
						)}
					</Stack>
				</Paper>
			) : null}

			<SectionHub
				description="Everything you can do with a board."
				items={[
					{
						href: "/devices/pair",
						title: "Pair hardware",
						description:
							"Load Device URL, pairing UUID, and key from the Pi over Bluetooth or a signed command.",
					},
					{
						href: "/devices/wifi",
						title: "WiFi over Bluetooth",
						description:
							"Have the dashboard sign a WiFi command the Pi verifies before connecting.",
					},
					{
						href: "/devices/keys",
						title: "GitHub keys",
						description:
							"Save your GitHub username and PAT to the paired Pi for per-project git.",
					},
					{
						href: "/devices/notifications",
						title: "Pairing requests",
						description:
							"Accept or reject incoming board transfers from other users.",
					},
				]}
			/>
		</Stack>
	);
}