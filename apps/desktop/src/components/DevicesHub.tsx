import Alert from "@shpaw415/mui-lite/Alert";
import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Tabs, { Tab } from "@shpaw415/mui-lite/Tabs";
import { useEffect } from "react";
import { useDashboardMode } from "../hooks/useDashboardMode";
import { type DeviceTabId, deviceTabs } from "../lib/dashboard-mode";
import Admin from "./Admin";
import Debug from "./Debug";
import Docs from "./Docs";
import Overview from "./Overview";
import Pair from "./Pair";
import Requests from "./Requests";
import T3 from "./T3";
import Wifi from "./Wifi";

export type DeviceTab = DeviceTabId;

export default function DevicesHub({
	tab,
	onTab,
	admin,
}: {
	tab: DeviceTab;
	onTab: (tab: DeviceTab) => void;
	admin: boolean;
}) {
	const { mode, isEasy, setMode } = useDashboardMode();
	const tabs = deviceTabs(mode, admin);
	const onT3 = tab === "t3";
	const allowed = tabs.some((item) => item.id === tab);

	useEffect(() => {
		if (!allowed) {
			onTab("overview");
		}
	}, [allowed, onTab]);

	const expertOnly = tab === "debug" || tab === "admin";

	return (
		<Box
			sx={{
				minWidth: 0,
				width: "100%",
				height: onT3 ? "100%" : undefined,
				...(onT3
					? {
							display: "flex",
							flexDirection: "column",
							flex: 1,
							minHeight: 0,
							overflow: "hidden",
						}
					: undefined),
			}}
		>
			<Tabs
				value={allowed ? tab : "overview"}
				onChange={(_event, next) => onTab(String(next) as DeviceTab)}
				variant="scrollable"
				aria-label="Devices sections"
				sx={{ flex: "0 0 auto", height: "auto", flexShrink: 0 }}
			>
				{tabs.map((item) => (
					<Tab key={item.id} value={item.id} label={item.label} />
				))}
			</Tabs>
			<Box
				sx={
					onT3
						? {
								mt: 0,
								flex: 1,
								minHeight: 0,
								display: "flex",
								flexDirection: "column",
								overflow: "hidden",
							}
						: { mt: 3 }
				}
			>
				{isEasy && expertOnly ? (
					<Alert severity="info">
						This page is Expert mode.{" "}
						<Button
							type="button"
							variant="text"
							onClick={() => setMode("expert")}
						>
							Switch to Expert
						</Button>
					</Alert>
				) : (
					<>
						{tab === "overview" ? <Overview /> : null}
						{tab === "docs" ? <Docs /> : null}
						{tab === "t3" ? <T3 /> : null}
						{tab === "pair" ? <Pair onBack={() => onTab("overview")} /> : null}
						{tab === "wifi" ? <Wifi onBack={() => onTab("overview")} /> : null}
						{tab === "requests" ? <Requests /> : null}
						{tab === "debug" ? <Debug /> : null}
						{tab === "admin" && admin ? <Admin /> : null}
					</>
				)}
			</Box>
		</Box>
	);
}
