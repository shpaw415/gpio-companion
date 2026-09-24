import FlashPanel from "@components/FlashPanel";
import GpioPanel from "@components/GpioPanel";
import RunPanel from "@components/RunPanel";
import VerifyPanel from "@components/VerifyPanel";
import { useEffect, useRef } from "react";
import { useBoardSelection } from "../../hooks/useBoardSelection.tsx";
import { useConsoleTunnel } from "../../hooks/useConsoleTunnel.ts";
import { useDashboardMode } from "../../hooks/useDashboardMode.tsx";
import { useT } from "../../hooks/useLocale.tsx";
import { useWorkbench } from "../../hooks/useWorkbench.tsx";

export default function DockBody() {
	const t = useT();
	const { isEasy } = useDashboardMode();
	const { uuid } = useBoardSelection();
	const {
		boards,
		project,
		dockTab,
		setLivePins,
		setVerifyResults,
		setConsoleStatus,
	} = useWorkbench();
	const board = boards.find((item) => item.uuid === uuid);
	const online = Boolean(board?.online);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset live state when the selected board changes
	useEffect(() => {
		setLivePins({});
		setVerifyResults([]);
		setConsoleStatus("idle");
	}, [setConsoleStatus, setLivePins, setVerifyResults, uuid]);

	if (!uuid) {
		return <span>{t("deck.dock.needBoard")}</span>;
	}

	if (dockTab === "gpio") {
		if (isEasy) {
			return <span>{t("deck.dock.gpioExpert")}</span>;
		}
		return (
			<GpioPanel
				key={uuid}
				uuid={uuid}
				poll
				connected={online}
				onLivePins={setLivePins}
			/>
		);
	}

	if (dockTab === "flash") {
		return (
			<>
				<FlashPanel uuid={uuid} project={project} />
				{isEasy ? (
					<VerifyPanel
						uuid={uuid}
						project={project}
						onResults={setVerifyResults}
					/>
				) : null}
			</>
		);
	}

	if (dockTab === "problems") {
		return (
			<VerifyPanel uuid={uuid} project={project} onResults={setVerifyResults} />
		);
	}

	return (
		<>
			<DockConsole uuid={uuid} />
			<div hidden>
				<RunPanel uuid={uuid} project={project} watchConsole={false} />
			</div>
		</>
	);
}

function DockConsole({ uuid }: { uuid: string }) {
	const t = useT();
	const { setConsoleStatus } = useWorkbench();
	const tunnel = useConsoleTunnel(uuid);
	const logRef = useRef<HTMLPreElement>(null);
	const log = tunnel.snapshot.host.log;

	useEffect(() => {
		setConsoleStatus(tunnel.status);
		return () => setConsoleStatus("idle");
	}, [setConsoleStatus, tunnel.status]);

	useEffect(() => {
		const node = logRef.current;
		if (!node || log.length < 0) {
			return;
		}
		node.scrollTop = node.scrollHeight;
	}, [log]);

	return (
		<div className="b6-console">
			<pre ref={logRef} className={log ? undefined : "is-empty"}>
				{log || t("deck.dock.consoleEmpty")}
			</pre>
		</div>
	);
}
