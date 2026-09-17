import { GET as getDevice } from "@api/device";
import { GET as getPairing } from "@api/pair";
import DeviceSelect from "@components/DeviceSelect";
import FlashPanel from "@components/FlashPanel";
import GpioPanel from "@components/GpioPanel";
import ProjectBrowser from "@components/ProjectBrowser";
import RunPanel from "@components/RunPanel";
import VerifyPanel from "@components/VerifyPanel";
import Alert from "@shpaw415/mui-lite/Alert";
import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Stepper, { Step, StepLabel } from "@shpaw415/mui-lite/Stepper";
import Typography from "@shpaw415/mui-lite/Typography";
import type { CircuitVerifyItem, GpioTarget } from "gpio-companion";
import { useEffect, useRef, useState } from "react";
import type { DeviceStatus } from "../../components/DeviceBoardCard.tsx";
import { LinesSkeleton } from "../../components/skeletons.tsx";
import { useActionError } from "../../hooks/useActionError.tsx";
import { useAuthSession } from "../../hooks/useAuth.ts";
import { useBoardSelection } from "../../hooks/useBoardSelection.tsx";
import { useT } from "../../hooks/useLocale.tsx";
import useMobile from "../../hooks/useMobile.ts";
import type { StoredPairing } from "../../lib/pairing-store.ts";

function needsWifi(status: DeviceStatus | null | undefined): boolean {
	const type = status?.network?.type;
	return type !== "ethernet" && type !== "wifi";
}

export default function ProjectPage() {
	const session = useAuthSession();
	const { run } = useActionError();
	const t = useT();
	const mobile = useMobile();
	const steps = [
		t("project.stepSignIn"),
		t("project.stepPair"),
		t("project.stepGithub"),
		t("project.stepReady"),
	];
	const nextFor: Record<
		number,
		{ href: string; label: string; hint: string } | undefined
	> = {
		0: {
			href: "/profile",
			label: t("project.stepSignIn"),
			hint: t("project.hintSignIn"),
		},
		1: {
			href: "/devices",
			label: t("project.pairABoard"),
			hint: t("project.hintPair"),
		},
		2: {
			href: "/profile/github",
			label: t("project.connectGithub"),
			hint: t("project.hintGithub"),
		},
		3: undefined,
	};
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
	const [arduinoLivePins, setArduinoLivePins] = useState<Record<number, 0 | 1>>(
		{},
	);
	const [verifyResults, setVerifyResults] = useState<CircuitVerifyItem[]>([]);
	const [project, setProject] = useState("");
	const [boardToolsOpen, setBoardToolsOpen] = useState(false);
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
	const next = nextFor[step] ?? undefined;
	const activeUuid = selectedUuid || devices[0]?.uuid || "";
	const wifiHint = paired && needsWifi(statuses[activeUuid]);
	const hasProject = Boolean(project);

	useEffect(() => {
		if (!hasProject) {
			setBoardToolsOpen(false);
		}
	}, [hasProject]);

	return (
		<Stack spacing={1.5}>
			{paired ? (
				<Stack direction="row" className="justify-end">
					<Button
						href="/devices/t3"
						variant="outlined"
						size="small"
						className={mobile ? "w-full" : undefined}
					>
						{t("project.openCode")}
					</Button>
				</Stack>
			) : null}

			{step < 3 || pairingLoading ? (
				<Paper className="p-3" elevation={1}>
					<Stack spacing={1.5}>
						{pairingLoading ? (
							<LinesSkeleton lines={2} />
						) : (
							<>
								<Stepper
									activeStep={step}
									alternativeLabel={!mobile}
									orientation={mobile ? "vertical" : "horizontal"}
								>
									{steps.map((label, index) => (
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
				<Alert severity="info">
					<Stack
						direction={mobile ? "column" : "row"}
						spacing={1}
						className="min-[900px]:items-center min-[900px]:justify-between"
					>
						<Typography color="secondary">{t("project.wifiHint")}</Typography>
						<Button href="/devices/wifi" variant="outlined" size="small">
							{t("project.setWifi")}
						</Button>
					</Stack>
				</Alert>
			) : null}

			<div>
				<ProjectBrowser
					onConfigured={setGithubReady}
					onProject={setProject}
					uuid={activeUuid}
					paired={paired}
					livePins={livePins}
					arduinoLivePins={arduinoLivePins}
					verifyResults={verifyResults}
					boardModel={statuses[activeUuid]?.model}
				/>
			</div>

			{paired && hasProject && activeUuid ? (
				<Paper className="min-w-0 overflow-x-hidden p-3" elevation={1}>
					<Stack spacing={1.5} className="min-w-0">
						<Stack
							direction={mobile ? "column" : "row"}
							spacing={1}
							className="min-[900px]:items-center min-[900px]:justify-between"
						>
							<Typography variant="subtitle1">
								{t("project.boardTools")}
							</Typography>
							<Button
								variant="outlined"
								size="small"
								onClick={() => setBoardToolsOpen((open) => !open)}
								className={mobile ? "w-full" : undefined}
							>
								{boardToolsOpen ? t("project.hide") : t("project.show")}
							</Button>
						</Stack>
						{boardToolsOpen ? (
							<>
								<DeviceSelect
									devices={devices}
									value={activeUuid}
									onChange={selectBoard}
								/>
								{pairingLoading ? (
									<LinesSkeleton lines={3} />
								) : (
									<GpioPanel
										key={activeUuid}
										uuid={activeUuid}
										poll
										connected={Boolean(statuses[activeUuid])}
										onLivePins={(
											pins: Record<number, 0 | 1>,
											target?: GpioTarget,
										) => {
											if (target === "arduino-proxy") {
												setArduinoLivePins(pins);
											} else {
												setLivePins(pins);
											}
										}}
									/>
								)}
								<FlashPanel uuid={activeUuid} project={project} />
								<RunPanel uuid={activeUuid} project={project} />
								<VerifyPanel
									uuid={activeUuid}
									project={project}
									onResults={setVerifyResults}
								/>
							</>
						) : null}
					</Stack>
				</Paper>
			) : null}
		</Stack>
	);
}
