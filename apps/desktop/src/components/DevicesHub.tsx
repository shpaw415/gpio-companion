import Box from "@shpaw415/mui-lite/Box";
import Tabs, { Tab } from "@shpaw415/mui-lite/Tabs";
import Admin from "./Admin";
import Debug from "./Debug";
import Docs from "./Docs";
import Keys from "./Keys";
import Overview from "./Overview";
import Pair from "./Pair";
import Requests from "./Requests";
import T3 from "./T3";
import Wifi from "./Wifi";

export type DeviceTab =
	| "overview"
	| "docs"
	| "t3"
	| "pair"
	| "wifi"
	| "keys"
	| "requests"
	| "debug"
	| "admin";

const baseTabs: Array<{ id: DeviceTab; label: string }> = [
	{ id: "overview", label: "Overview" },
	{ id: "docs", label: "Docs" },
	{ id: "t3", label: "T3" },
	{ id: "pair", label: "Pair" },
	{ id: "wifi", label: "WiFi" },
	{ id: "keys", label: "Keys" },
	{ id: "requests", label: "Requests" },
	{ id: "debug", label: "Debug" },
];

export default function DevicesHub({
	tab,
	onTab,
	admin,
}: {
	tab: DeviceTab;
	onTab: (tab: DeviceTab) => void;
	admin: boolean;
}) {
	const tabs = admin
		? [...baseTabs, { id: "admin" as const, label: "Admin" }]
		: baseTabs;
	const onT3 = tab === "t3";

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
				value={tab}
				onChange={(_event, next) => onTab(String(next) as DeviceTab)}
				variant="scrollable"
				aria-label="Devices sections"
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
				{tab === "overview" ? <Overview /> : null}
				{tab === "docs" ? <Docs /> : null}
				{tab === "t3" ? <T3 /> : null}
				{tab === "pair" ? <Pair onBack={() => onTab("overview")} /> : null}
				{tab === "wifi" ? <Wifi onBack={() => onTab("overview")} /> : null}
				{tab === "keys" ? <Keys /> : null}
				{tab === "requests" ? <Requests /> : null}
				{tab === "debug" ? <Debug /> : null}
				{tab === "admin" && admin ? <Admin /> : null}
			</Box>
		</Box>
	);
}
