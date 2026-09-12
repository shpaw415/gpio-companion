import { GET as getDevice } from "@api/device";
import { GET as getPairing } from "@api/pair";
import DeviceSelect from "@components/DeviceSelect";
import FlashPanel from "@components/FlashPanel";
import GpioPanel from "@components/GpioPanel";
import ProjectBrowser from "@components/ProjectBrowser";
import RunPanel from "@components/RunPanel";
import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Stepper, { Step, StepLabel } from "@shpaw415/mui-lite/Stepper";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useRef, useState } from "react";
import type { DeviceStatus } from "../../components/DeviceBoardCard.tsx";
import { SectionHeader } from "../../components/Section.tsx";
import { LinesSkeleton } from "../../components/skeletons.tsx";
import { useActionError } from "../../hooks/useActionError.tsx";
import { useAuthSession } from "../../hooks/useAuth.ts";
import { useBoardSelection } from "../../hooks/useBoardSelection.tsx";
import useMobile from "../../hooks/useMobile.ts";
import type { StoredPairing } from "../../lib/pairing-store.ts";

const STEPS = ["Sign in", "Pair board", "GitHub", "Ready"] as const;

const NEXT: Record<
	number,
	{ href: string; label: string; hint: string } | undefined
> = {
	0: {
		href: "/profile",
		label: "Sign in",
		hint: "Sign in with GitHub to start.",
	},
	1: {
		href: "/devices",
		label: "Pair a board",
		hint: "Pair your board from Devices so you can flash sketches and see circuits.",
	},
	2: {
		href: "/profile/github",
		label: "Connect GitHub",
		hint: "Connect GitHub once so project files can appear here.",
	},
	3: undefined,
};

function needsWifi(status: DeviceStatus | null | undefined): boolean {
	const type = status?.network?.type;
	return type !== "ethernet" && type !== "wifi";
}

export default function ProjectPage() {
	const session = useAuthSession();
	const { run } = useActionError();
	const mobile = useMobile();
	const { uuid: selectedUuid, setUuid: selectBoard } = useBoardSelection();
	const loggedIn = Boolean(session.data?.id || session.data?.email);
	const [paired, setPaired] = useState(false);
	const [devices, setDevices] = useState<StoredPairing[]>([]);
	const [statuses, setStatuses] = useState<Record<string, DeviceStatus | null>>(
		{},
	);
	const [githubReady, setGithubReady] = useState(false);
	const [pairingLoading, setPairingLoading] = useState(true);
	const [livePins, setLivePins] = useState<Record<number, 0 | 1>>({});
	const [project, setProject] = useState("");
	const selectedUuidRef = useRef(selectedUuid);
	selectedUuidRef.current = selectedUuid;

	useEffect(() => {
		const userId = session.data?.id;
		if (!userId) {
			setPaired(false);
			setDevices([]);
			setStatuses({});
			setGithubReady(false);
			setPairingLoading(false);
			return;
		}
		setPairingLoading(true);
		void run(getPairing())
			.then(async (result) => {
				const next = result?.devices ?? [];
				setDevices(next);
				setPaired(next.length > 0);
				if (!selectedUuidRef.current && next[0]) {
					selectBoard(next[0].uuid);
				}
				if (next.length === 0) {
					setStatuses({});
					return;
				}
				const device = await run(getDevice());
				if (!device?.paired) {
					setStatuses({});
					return;
				}
				const nextStatuses: Record<string, DeviceStatus | null> = {};
				for (const item of device.devices) {
					nextStatuses[item.device.uuid] = item.status as DeviceStatus | null;
				}
				setStatuses(nextStatuses);
			})
			.finally(() => {
				setPairingLoading(false);
			});
	}, [session.data?.id, run, selectBoard]);

	const step = !loggedIn ? 0 : !paired ? 1 : !githubReady ? 2 : 3;
	const next = NEXT[step] ?? undefined;
	const activeUuid = selectedUuid || devices[0]?.uuid || "";
	const wifiHint = paired && needsWifi(statuses[activeUuid]);

	return (
		<Stack spacing={4}>
			<Stack
				direction={mobile ? "column" : "row"}
				spacing={2}
				className="min-[900px]:items-start min-[900px]:justify-between"
			>
				<SectionHeader title="Project">
					<Typography color="secondary">
						Your Arduino studio: circuits, live pins, and flash. Open Code to
						talk to the board.
					</Typography>
				</SectionHeader>
				{paired ? (
					<Button
						href="/devices/t3"
						variant="contained"
						className={mobile ? "w-full" : undefined}
					>
						Open Code
					</Button>
				) : null}
			</Stack>

			{step < 3 || pairingLoading ? (
				<Paper className="p-4 min-[900px]:p-6" elevation={1}>
					<Stack spacing={3}>
						<Typography variant="h6">Set up your board</Typography>
						{pairingLoading ? (
							<LinesSkeleton lines={2} />
						) : (
							<>
								<Stepper
									activeStep={step}
									alternativeLabel={!mobile}
									orientation={mobile ? "vertical" : "horizontal"}
								>
									{STEPS.map((label, index) => (
										<Step key={label} completed={step > index}>
											<StepLabel>{label}</StepLabel>
										</Step>
									))}
								</Stepper>
								{next ? (
									<Box className="flex flex-wrap items-center justify-between gap-4">
										<Typography color="secondary">{next.hint}</Typography>
										<Button href={next.href} variant="contained">
											{next.label}
										</Button>
									</Box>
								) : null}
							</>
						)}
					</Stack>
				</Paper>
			) : null}

			{wifiHint ? (
				<Paper className="p-4 min-[900px]:p-6" elevation={1}>
					<Stack
						direction={mobile ? "column" : "row"}
						spacing={2}
						className="min-[900px]:items-center min-[900px]:justify-between"
					>
						<Typography color="secondary">
							This board is not on Wi‑Fi or Ethernet yet. Put it on your network
							from this computer.
						</Typography>
						<Button href="/devices/wifi" variant="outlined">
							Set WiFi
						</Button>
					</Stack>
				</Paper>
			) : null}

			{paired ? (
				<Paper className="p-4 min-[900px]:p-6" elevation={1}>
					<Stack spacing={2}>
						<DeviceSelect
							devices={devices}
							value={activeUuid}
							onChange={selectBoard}
						/>
						<Typography variant="h6">Live GPIO</Typography>
						<Typography color="secondary">
							Watch header pins and PWM from the board over the companion API
							websocket. Tap a GPIO to drive it high or low on that socket.
						</Typography>
						{pairingLoading ? (
							<LinesSkeleton lines={3} />
						) : (
							<GpioPanel
								key={activeUuid}
								uuid={activeUuid}
								poll
								connected={Boolean(statuses[activeUuid])}
								onLivePins={setLivePins}
							/>
						)}
					</Stack>
				</Paper>
			) : null}

			{paired && activeUuid ? (
				<Paper className="p-4 min-[900px]:p-6" elevation={1}>
					<Stack spacing={2}>
						<Typography variant="h6">Flash Arduino</Typography>
						<Typography color="secondary">
							Compile C firmware on the board and upload it over USB.
						</Typography>
						<FlashPanel uuid={activeUuid} project={project} />
						<Typography variant="h6">Run on board</Typography>
						<Typography color="secondary">
							Compile C on the board and run it on this header for GPIO tests.
						</Typography>
						<RunPanel uuid={activeUuid} project={project} />
					</Stack>
				</Paper>
			) : null}

			<div>
				<Typography variant="h5" className="mb-3">
					Your projects
				</Typography>
				<ProjectBrowser
					onConfigured={setGithubReady}
					onProject={setProject}
					uuid={activeUuid}
					livePins={livePins}
				/>
			</div>
		</Stack>
	);
}
