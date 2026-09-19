import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { usePathname, useRouter } from "expo-router";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Animated,
	Image,
	Modal,
	PanResponder,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	type ArduinoProxyStatus,
	type BoardSketch,
	type FlashPort,
	type FlashStatus,
	type GpioSnapshot,
	loadArduinoProxy,
	loadFlash,
	loadFlashPorts,
	loadFlashSketches,
	startFlash,
	startFlashProxy,
} from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { useBoardSelection } from "../lib/board-selection.tsx";
import { useColorMode } from "../lib/color-mode.tsx";
import { type DeviceTabId, deviceTabs } from "../lib/dashboard-mode.ts";
import { useDashboardMode } from "../lib/dashboard-mode.tsx";
import { type DeckKey, useDeckT } from "../lib/deck-i18n.ts";
import { useDeviceHub } from "../lib/device-hub.tsx";
import { translateError, useT } from "../lib/locale.tsx";
import { storageGet, storageSet } from "../lib/storage.ts";
import { useConsoleTunnel } from "../lib/use-console-tunnel.ts";
import { useDeviceHub as useLiveHub } from "../lib/use-device-hub.ts";
import { useGpioTunnel } from "../lib/use-gpio-tunnel.ts";
import { ErrorText, PrimaryButton, TextButton } from "./ui.tsx";

const logo = require("../../assets/logo.png");
const DOCK_STORAGE_KEY = "b6-dockH";
const DOCK_COLLAPSED_KEY = "b6-dockCollapsed";
const PROJECT_STORAGE_KEY = "gpio-companion-selected-project";
const PROXY_DEFAULT_FQBN = "arduino:avr:uno";
const DOCK_MIN = 64;
const DOCK_MAX = 480;
const DOCK_DEFAULT = 150;

type Command = {
	id: string;
	labelKey: DeckKey;
	run: () => void;
};

type NavigationDeckKey = Extract<
	DeckKey,
	`deck.${"project" | "devices" | "profile" | DeviceTabId}`
>;

const deviceLabelKeys: Record<DeviceTabId, NavigationDeckKey> = {
	overview: "deck.overview",
	docs: "deck.docs",
	t3: "deck.t3",
	pair: "deck.pair",
	wifi: "deck.wifi",
	requests: "deck.requests",
	debug: "deck.debug",
	admin: "deck.admin",
};

export default function Deck({ children }: { children: ReactNode }) {
	const colors = useColorMode().colors;
	const { isDark, toggleMode: toggleTheme } = useColorMode();
	const { mode, isEasy, toggleMode } = useDashboardMode();
	const { tab, setTab } = useDeviceHub();
	const auth = useAuth();
	const router = useRouter();
	const pathname = usePathname();
	const insets = useSafeAreaInsets();
	const t = useDeckT();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [query, setQuery] = useState("");
	const drawerX = useRef(new Animated.Value(-320)).current;

	const navigate = useCallback(
		(path: "/project" | "/" | "/profile") => {
			router.navigate(path);
		},
		[router],
	);
	const commands = useMemo<Command[]>(() => {
		const base: Command[] = [
			{
				id: "project",
				labelKey: "deck.project",
				run: () => navigate("/project"),
			},
			{ id: "devices", labelKey: "deck.devices", run: () => navigate("/") },
			{
				id: "profile",
				labelKey: "deck.profile",
				run: () => navigate("/profile"),
			},
		];
		const deviceCommands = deviceTabs(
			mode,
			auth.session?.role === "admin",
		).map<Command>((item) => ({
			id: `device-${item.id}`,
			labelKey: deviceLabelKeys[item.id],
			run: () => {
				setTab(item.id);
				navigate("/");
			},
		}));
		const boardCommands: Command[] = [
			{
				id: "action-run",
				labelKey: "deck.boardRun",
				run: () => navigate("/project"),
			},
			{
				id: "action-flash",
				labelKey: "deck.boardFlash",
				run: () => navigate("/project"),
			},
			{
				id: "action-verify",
				labelKey: "deck.boardVerify",
				run: () => navigate("/project"),
			},
			{
				id: "action-save",
				labelKey: "deck.boardSave",
				run: () => navigate("/project"),
			},
			{
				id: "action-buy",
				labelKey: "deck.boardBuy",
				run: () => navigate("/profile"),
			},
			{
				id: "mode-easy",
				labelKey: "deck.useEasy",
				run: () => {
					if (!isEasy) toggleMode();
				},
			},
			{
				id: "mode-expert",
				labelKey: "deck.useExpert",
				run: () => {
					if (isEasy) toggleMode();
				},
			},
			{
				id: "theme",
				labelKey: "deck.theme",
				run: () => toggleTheme(),
			},
		];
		const seen = new Set<string>();
		return base
			.concat(deviceCommands)
			.concat(boardCommands)
			.filter((command) => {
				const label = command.labelKey;
				if (seen.has(label)) return false;
				seen.add(label);
				return true;
			});
	}, [
		auth.session?.role,
		isEasy,
		mode,
		navigate,
		setTab,
		toggleMode,
		toggleTheme,
	]);

	const filtered = commands.filter((command) =>
		t(command.labelKey)
			.toLocaleLowerCase()
			.includes(query.trim().toLocaleLowerCase()),
	);
	const run = (command: Command) => {
		setDrawerOpen(false);
		setPaletteOpen(false);
		setQuery("");
		command.run();
	};

	useEffect(() => {
		Animated.timing(drawerX, {
			toValue: drawerOpen ? 0 : -320,
			duration: 180,
			useNativeDriver: true,
		}).start();
	}, [drawerOpen, drawerX]);

	const contextKey: DeckKey = pathname.includes("project")
		? "deck.project"
		: pathname.includes("profile")
			? "deck.profile"
			: deviceLabelKeys[tab];

	return (
		<View
			style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}
		>
			<View
				style={{
					height: 48,
					flexDirection: "row",
					alignItems: "center",
					paddingHorizontal: 8,
					gap: 4,
					borderBottomWidth: 1,
					borderBottomColor: colors.border,
					backgroundColor: colors.surface,
				}}
			>
				<Pressable
					onPress={() => setDrawerOpen(true)}
					accessibilityRole="button"
					accessibilityLabel={t("deck.menu")}
					style={{ padding: 8 }}
				>
					<MaterialIcons name="menu" size={22} color={colors.text} />
				</Pressable>
				<Image
					source={logo}
					style={{ width: 26, height: 26, borderRadius: 7 }}
				/>
				<Text
					style={{
						color: colors.text,
						fontSize: 16,
						fontWeight: "700",
						flex: 1,
					}}
				>
					{t("deck.brandShort")}
				</Text>
				<Pressable
					onPress={() => setPaletteOpen(true)}
					accessibilityRole="button"
					accessibilityLabel={t("deck.search")}
					style={{ padding: 8 }}
				>
					<MaterialIcons name="search" size={22} color={colors.text} />
				</Pressable>
				<Pressable onPress={toggleMode} style={{ padding: 7 }}>
					<Text
						style={{ color: colors.primary, fontWeight: "700", fontSize: 12 }}
					>
						{isEasy ? t("deck.easy") : t("deck.expert")}
					</Text>
				</Pressable>
				<Pressable
					onPress={toggleTheme}
					accessibilityRole="button"
					accessibilityLabel={
						isDark ? t("deck.switchToLight") : t("deck.switchToDark")
					}
					style={{ padding: 8 }}
				>
					<MaterialIcons
						name={isDark ? "wb-sunny" : "brightness-2"}
						size={20}
						color={colors.muted}
					/>
				</Pressable>
			</View>
			<View
				style={{
					height: 26,
					paddingHorizontal: 12,
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					backgroundColor: colors.chipBg,
				}}
			>
				<Text
					style={{ color: colors.success, fontSize: 11, fontWeight: "700" }}
				>
					{t("deck.statusReady")}
				</Text>
				<Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
					{t("deck.statusContext", { context: t(contextKey) })}
				</Text>
			</View>
			<View style={{ flex: 1 }}>{children}</View>
			<DeckDock isEasy={isEasy} />
			<BottomNav
				active={
					pathname.includes("project")
						? "/project"
						: pathname.includes("profile")
							? "/profile"
							: "/"
				}
				onNavigate={navigate}
			/>

			<Modal
				visible={drawerOpen}
				transparent
				animationType="none"
				onRequestClose={() => setDrawerOpen(false)}
			>
				<View style={{ flex: 1, flexDirection: "row" }}>
					<Animated.View
						style={{
							width: 300,
							paddingTop: insets.top + 12,
							paddingHorizontal: 12,
							backgroundColor: colors.surface,
							transform: [{ translateX: drawerX }],
						}}
					>
						<Text
							style={{
								color: colors.text,
								fontSize: 20,
								fontWeight: "700",
								marginBottom: 12,
							}}
						>
							{t("deck.navigation")}
						</Text>
						{commands.map((command) => (
							<CommandRow
								key={command.id}
								label={t(command.labelKey)}
								onPress={() => run(command)}
							/>
						))}
					</Animated.View>
					<Pressable
						onPress={() => setDrawerOpen(false)}
						accessibilityLabel={t("deck.close")}
						style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}
					/>
				</View>
			</Modal>

			<Modal
				visible={paletteOpen}
				transparent
				animationType="fade"
				onRequestClose={() => setPaletteOpen(false)}
			>
				<Pressable
					onPress={() => setPaletteOpen(false)}
					style={{
						flex: 1,
						paddingTop: insets.top + 8,
						backgroundColor: "rgba(0,0,0,0.6)",
					}}
				>
					<Pressable
						onPress={() => undefined}
						style={{
							width: "100%",
							backgroundColor: colors.surface,
							padding: 12,
						}}
					>
						<TextInput
							autoFocus
							value={query}
							onChangeText={setQuery}
							onSubmitEditing={() => filtered[0] && run(filtered[0])}
							placeholder={t("deck.searchPlaceholder")}
							placeholderTextColor={colors.placeholder}
							style={{
								color: colors.text,
								borderWidth: 1,
								borderColor: colors.border,
								borderRadius: 10,
								padding: 12,
							}}
						/>
						<View style={{ marginTop: 8 }}>
							{filtered.length ? (
								filtered.map((command) => (
									<CommandRow
										key={command.id}
										label={t(command.labelKey)}
										onPress={() => run(command)}
									/>
								))
							) : (
								<Text style={{ color: colors.muted, padding: 12 }}>
									{t("deck.noResults")}
								</Text>
							)}
						</View>
					</Pressable>
				</Pressable>
			</Modal>
		</View>
	);
}

function BottomNav({
	active,
	onNavigate,
}: {
	active: "/project" | "/" | "/profile";
	onNavigate: (path: "/project" | "/" | "/profile") => void;
}) {
	const colors = useColorMode().colors;
	const insets = useSafeAreaInsets();
	const t = useDeckT();
	const items: Array<{
		path: "/project" | "/" | "/profile";
		labelKey: DeckKey;
		icon: React.ComponentProps<typeof MaterialIcons>["name"];
	}> = [
		{ path: "/project", labelKey: "deck.project", icon: "folder" },
		{ path: "/", labelKey: "deck.devices", icon: "memory" },
		{ path: "/profile", labelKey: "deck.profile", icon: "account-circle" },
	];
	return (
		<View
			style={{
				flexDirection: "row",
				backgroundColor: colors.surface,
				borderTopWidth: 1,
				borderTopColor: colors.border,
				paddingBottom: Math.max(insets.bottom, 8),
				height: 56 + Math.max(insets.bottom - 8, 0),
			}}
		>
			{items.map((item) => {
				const selected = active === item.path;
				return (
					<Pressable
						key={item.path}
						onPress={() => onNavigate(item.path)}
						accessibilityRole="tab"
						accessibilityState={{ selected }}
						style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
					>
						<MaterialIcons
							name={item.icon}
							size={24}
							color={selected ? colors.primary : colors.muted}
						/>
						<Text
							style={{
								color: selected ? colors.primary : colors.muted,
								fontSize: 12,
								fontWeight: selected ? "700" : "400",
							}}
						>
							{t(item.labelKey)}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

function CommandRow({
	label,
	onPress,
}: {
	label: string;
	onPress: () => void;
}) {
	const colors = useColorMode().colors;
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			style={{ paddingHorizontal: 12, paddingVertical: 11, borderRadius: 8 }}
		>
			<Text style={{ color: colors.text, fontWeight: "600" }}>{label}</Text>
		</Pressable>
	);
}

type DockTab = "console" | "gpio" | "flash" | "problems";

function DockStatusRow({ uuid8, status }: { uuid8: string; status: string }) {
	const colors = useColorMode().colors;
	const t = useDeckT();
	return (
		<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
			<Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>
				{t("deck.boardLine", { uuid: uuid8 })}
			</Text>
			<Text style={{ color: colors.muted, fontSize: 11 }}>{status}</Text>
		</View>
	);
}

function DockConsole({
	status,
	hostLog,
	usbLog,
	uuid8,
}: {
	status: "idle" | "connecting" | "live" | "reconnecting";
	hostLog: string;
	usbLog: string;
	uuid8: string;
}) {
	const colors = useColorMode().colors;
	const tCore = useT();
	const statusLabel =
		status === "live"
			? tCore("debug.live")
			: status === "idle"
				? tCore("debug.idle")
				: tCore("gpio.connecting");
	const hostTail = hostLog.length > 800 ? hostLog.slice(-800) : hostLog;
	const usbTail = usbLog.length > 800 ? usbLog.slice(-800) : usbLog;
	return (
		<View style={{ flex: 1 }}>
			<DockStatusRow uuid8={uuid8} status={statusLabel} />
			<ScrollView nestedScrollEnabled style={{ flex: 1, marginTop: 4 }}>
				{hostTail ? (
					<Text
						selectable
						style={{
							color: colors.text,
							fontFamily: "monospace",
							fontSize: 11,
						}}
					>
						{hostTail}
					</Text>
				) : null}
				{usbTail ? (
					<Text
						selectable
						style={{
							color: colors.muted,
							fontFamily: "monospace",
							fontSize: 11,
							marginTop: 4,
						}}
					>
						{`${tCore("flash.serialUsb")}\n${usbTail}`}
					</Text>
				) : null}
				{!hostTail && !usbTail ? (
					<Text style={{ color: colors.muted, fontSize: 11 }}>
						{tCore("debug.noEvents")}
					</Text>
				) : null}
			</ScrollView>
		</View>
	);
}

function DockGpio({
	status,
	header,
	proxy,
	proxyStatus,
	uuid8,
}: {
	status: "idle" | "connecting" | "live" | "reconnecting";
	header: GpioSnapshot | null;
	proxy: GpioSnapshot | null;
	proxyStatus: ArduinoProxyStatus | null;
	uuid8: string;
}) {
	const colors = useColorMode().colors;
	const tCore = useT();
	const statusLabel =
		status === "live"
			? tCore("gpio.liveChip")
			: status === "idle"
				? tCore("debug.idle")
				: tCore("gpio.connecting");
	const proxyName =
		proxyStatus?.name?.trim() ||
		proxy?.proxy?.name?.trim() ||
		proxyStatus?.fqbn?.trim() ||
		proxy?.proxy?.fqbn?.trim() ||
		"";
	const showProxy = Boolean(proxyStatus?.connected || proxy);
	return (
		<View style={{ flex: 1 }}>
			<DockStatusRow uuid8={uuid8} status={statusLabel} />
			{header ? (
				<GpioSummaryLine
					snapshot={header}
					prefix={`${tCore("gpio.companion")} · ${header.hardware}`}
				/>
			) : (
				<Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
					{tCore("gpio.waiting")}
				</Text>
			)}
			{showProxy ? (
				proxy ? (
					<GpioSummaryLine
						snapshot={proxy}
						prefix={
							proxyName
								? `${tCore("gpio.arduino")} · ${proxyName}`
								: tCore("gpio.arduino")
						}
					/>
				) : (
					<Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
						{proxyName
							? `${tCore("gpio.arduino")} · ${proxyName}`
							: tCore("gpio.arduino")}
					</Text>
				)
			) : null}
		</View>
	);
}

function GpioSummaryLine({
	snapshot,
	prefix,
}: {
	snapshot: GpioSnapshot;
	prefix: string;
}) {
	const colors = useColorMode().colors;
	const tCore = useT();
	const pins = snapshot.pins.filter(
		(pin) => pin.type === "gpio" && !pin.reserved && !pin.unresolved,
	);
	const high = pins.filter((pin) => pin.value === 1).length;
	const low = pins.filter((pin) => pin.value === 0).length;
	return (
		<Text style={{ color: colors.text, fontSize: 12, marginTop: 4 }}>
			{`${prefix} · ${pins.length} GPIO · ${high} ${tCore("gpio.high")} · ${low} ${tCore("gpio.low")}`}
		</Text>
	);
}

function DockFlash({
	status,
	proxyStatus,
	uuid8,
	projectRepo,
	sketches,
	busy,
	error,
	onFlashProxy,
	onFlashSketch,
}: {
	status: FlashStatus | null;
	proxyStatus: ArduinoProxyStatus | null;
	uuid8: string;
	projectRepo: string;
	sketches: BoardSketch[];
	busy: boolean;
	error: string;
	onFlashProxy: () => void;
	onFlashSketch: (dir: string) => void;
}) {
	const colors = useColorMode().colors;
	const tCore = useT();
	const live = Boolean(proxyStatus?.connected);
	const flashing = busy || Boolean(status?.running);
	const proxyName =
		proxyStatus?.name?.trim() || proxyStatus?.fqbn?.trim() || "";
	const stateLabel = !status
		? tCore("flash.thenFlash")
		: status.running
			? tCore("flash.flashing")
			: status.last
				? status.last.ok
					? tCore("flash.lastOk", { fqbn: status.last.fqbn })
					: tCore("flash.lastFailed", { fqbn: status.last.fqbn })
				: tCore("flash.thenFlash");
	return (
		<View style={{ flex: 1 }}>
			<DockStatusRow uuid8={uuid8} status={stateLabel} />
			<ScrollView nestedScrollEnabled style={{ flex: 1, marginTop: 4 }}>
				<Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
					{tCore("flash.proxyTitle")}
				</Text>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 8,
						marginTop: 2,
					}}
				>
					<Text style={{ flex: 1, color: colors.muted, fontSize: 11 }}>
						{flashing
							? tCore("flash.takeMinute")
							: live
								? tCore("flash.firmata", {
										name: proxyName || tCore("debug.connected"),
									})
								: tCore("flash.usbArduino")}
					</Text>
					<TextButton
						label={
							flashing
								? tCore("flash.flashing")
								: live
									? tCore("flash.reflashProxy")
									: tCore("flash.asProxy")
						}
						disabled={busy}
						onPress={onFlashProxy}
					/>
				</View>
				<Text
					style={{
						color: colors.text,
						fontSize: 12,
						fontWeight: "700",
						marginTop: 8,
					}}
				>
					{tCore("flash.arduinoFlash")}
				</Text>
				{!projectRepo ? (
					<Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
						{tCore("flash.selectProject")}
					</Text>
				) : sketches.length === 0 ? (
					<Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
						{tCore("flash.noSketches")}
					</Text>
				) : (
					sketches.map((sketch) => (
						<View
							key={sketch.dir}
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 8,
								marginTop: 4,
							}}
						>
							<Text
								style={{ flex: 1, color: colors.text, fontSize: 12 }}
								numberOfLines={1}
							>
								{sketch.name}
							</Text>
							<TextButton
								label={
									flashing ? tCore("flash.flashing") : tCore("flash.flash")
								}
								disabled={busy}
								onPress={() => onFlashSketch(sketch.dir)}
							/>
						</View>
					))
				)}
				{error ? (
					<ErrorText>{translateError(tCore, error)}</ErrorText>
				) : null}
			</ScrollView>
		</View>
	);
}

function DeckDock({ isEasy }: { isEasy: boolean }) {
	const colors = useColorMode().colors;
	const t = useDeckT();
	const tCore = useT();
	const router = useRouter();
	const { uuid } = useBoardSelection();
	const auth = useAuth();
	const [height, setHeight] = useState(DOCK_DEFAULT);
	const [tab, setTab] = useState<DockTab>("console");
	const [collapsed, setCollapsed] = useState(false);
	const [gpioHeader, setGpioHeader] = useState<GpioSnapshot | null>(null);
	const [gpioProxy, setGpioProxy] = useState<GpioSnapshot | null>(null);
	const [proxyStatus, setProxyStatus] = useState<ArduinoProxyStatus | null>(
		null,
	);
	const [flashStatus, setFlashStatus] = useState<FlashStatus | null>(null);
	const [sketches, setSketches] = useState<BoardSketch[]>([]);
	const [ports, setPorts] = useState<FlashPort[]>([]);
	const [projectRepo, setProjectRepo] = useState("");
	const [flashBusy, setFlashBusy] = useState(false);
	const [proxyBusy, setProxyBusy] = useState(false);
	const [flashError, setFlashError] = useState("");
	const dragStart = useRef(DOCK_DEFAULT);
	const currentHeight = useRef(DOCK_DEFAULT);
	const lastTap = useRef(0);
	const touch = useRef({ t: 0, dragging: false });

	const onGpioSnapshot = useCallback((snapshot: GpioSnapshot) => {
		if (snapshot.target === "arduino-proxy") {
			setGpioProxy(snapshot);
		} else {
			setGpioHeader(snapshot);
		}
	}, []);
	const onFlashStatus = useCallback(
		(status: FlashStatus) => setFlashStatus(status),
		[],
	);
	const onProxyStatus = useCallback(
		(status: ArduinoProxyStatus) => setProxyStatus(status),
		[],
	);
	const serial = useConsoleTunnel(uuid, auth.token);
	const gpioTunnel = useGpioTunnel(uuid, auth.token, onGpioSnapshot);
	useLiveHub(uuid, auth.token, {
		onFlash: onFlashStatus,
		onArduinoProxy: onProxyStatus,
	});
	const gpioRefreshRef = useRef(gpioTunnel.refresh);
	gpioRefreshRef.current = gpioTunnel.refresh;

	useEffect(() => {
		setGpioHeader(null);
		setGpioProxy(null);
		setProxyStatus(null);
		setFlashStatus(null);
		const selected = uuid.trim();
		if (selected && auth.token) {
			gpioRefreshRef.current();
			gpioRefreshRef.current("arduino-proxy");
			void loadFlash(auth.token, selected).then(
				(status) => setFlashStatus(status),
				() => undefined,
			);
			void loadArduinoProxy(auth.token, selected).then(
				(status) => setProxyStatus(status),
				() => undefined,
			);
		}
	}, [uuid, auth.token]);

	useEffect(() => {
		if (tab !== "flash" || !uuid.trim() || !auth.token) {
			return;
		}
		let cancelled = false;
		const selected = uuid.trim();
		const token = auth.token;
		void storageGet(PROJECT_STORAGE_KEY).then((stored) => {
			if (cancelled) {
				return;
			}
			const repo = (stored ?? "").split("/").pop()?.trim() ?? "";
			setProjectRepo(repo);
			if (!repo) {
				setSketches([]);
				return;
			}
			void loadFlashSketches(token, selected).then(
				(result) => {
					if (!cancelled) {
						setSketches(
							result.sketches.filter(
								(sketch) =>
									sketch.project === repo || sketch.project === stored,
							),
						);
					}
				},
				() => {
					if (!cancelled) {
						setSketches([]);
					}
				},
			);
		});
		void loadFlashPorts(token, selected).then(
			(result) => {
				if (!cancelled) {
					setPorts(result.ports);
				}
			},
			() => {
				if (!cancelled) {
					setPorts([]);
				}
			},
		);
		return () => {
			cancelled = true;
		};
	}, [tab, uuid, auth.token]);

	const flashSketch = useCallback(
		(dir: string) => {
			const token = auth.token;
			const selected = uuid.trim();
			const fqbn =
				ports.find((port) => port.fqbn?.trim())?.fqbn?.trim() ?? "";
			if (!token || !selected || !fqbn) {
				setFlashError(tCore("flash.selectArduinoFirst"));
				return;
			}
			setFlashBusy(true);
			setFlashError("");
			void startFlash(token, {
				uuid: selected,
				fqbn,
				dir,
				port: ports[0]?.address || undefined,
			})
				.then(() => undefined)
				.catch((caught) => {
					setFlashError(
						caught instanceof Error ? caught.message : "request failed",
					);
				})
				.finally(() => setFlashBusy(false));
		},
		[auth.token, uuid, ports, tCore],
	);

	const flashProxyFirmware = useCallback(() => {
		const token = auth.token;
		const selected = uuid.trim();
		if (!token || !selected) {
			return;
		}
		const fqbn =
			ports.find((port) => port.fqbn?.trim())?.fqbn?.trim() ??
			PROXY_DEFAULT_FQBN;
		setProxyBusy(true);
		setFlashError("");
		void startFlashProxy(token, {
			uuid: selected,
			fqbn,
			port: ports[0]?.address || undefined,
		})
			.then(() => undefined)
			.catch((caught) => {
				setFlashError(
					caught instanceof Error ? caught.message : "request failed",
				);
			})
			.finally(() => setProxyBusy(false));
	}, [auth.token, uuid, ports]);

	useEffect(() => {
		void storageGet(DOCK_STORAGE_KEY).then((stored) => {
			if (stored === null || stored.trim() === "") return;
			const parsed = Number(stored);
			if (Number.isFinite(parsed)) {
				const next = Math.max(DOCK_MIN, Math.min(DOCK_MAX, parsed));
				currentHeight.current = next;
				setHeight(next);
			}
		});
		void storageGet(DOCK_COLLAPSED_KEY).then((stored) => {
			if (stored === "1") setCollapsed(true);
		});
	}, []);

	useEffect(() => {
		if (isEasy && tab === "problems") setTab("console");
	}, [isEasy, tab]);

	const updateHeight = useCallback((next: number) => {
		const value = Math.max(DOCK_MIN, Math.min(DOCK_MAX, Math.round(next)));
		currentHeight.current = value;
		setHeight(value);
		void storageSet(DOCK_STORAGE_KEY, String(value));
	}, []);
	const setDockCollapsed = useCallback((next: boolean) => {
		setCollapsed(next);
		void storageSet(DOCK_COLLAPSED_KEY, next ? "1" : "0");
	}, []);
	const pan = useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: () => true,
				onPanResponderGrant: () => {
					dragStart.current = currentHeight.current;
					touch.current = { t: Date.now(), dragging: false };
				},
				onPanResponderMove: (_event, gesture) => {
					if (!touch.current.dragging) {
						if (Math.abs(gesture.dy) <= 4) return;
						touch.current.dragging = true;
						if (collapsed) setDockCollapsed(false);
					}
					const next = Math.max(
						DOCK_MIN,
						Math.min(DOCK_MAX, dragStart.current - gesture.dy),
					);
					currentHeight.current = next;
					setHeight(next);
				},
				onPanResponderRelease: (_event, gesture) => {
					if (
						!touch.current.dragging &&
						Date.now() - touch.current.t < 500 &&
						Math.abs(gesture.dy) <= 4
					) {
						const now = Date.now();
						if (now - lastTap.current < 300) {
							setDockCollapsed(false);
							updateHeight(DOCK_DEFAULT);
						}
						lastTap.current = now;
						return;
					}
					updateHeight(currentHeight.current);
				},
				onPanResponderTerminate: () => updateHeight(currentHeight.current),
			}),
		[updateHeight, collapsed, setDockCollapsed],
	);
	const tabs: DockTab[] = isEasy
		? ["console", "gpio", "flash"]
		: ["console", "gpio", "flash", "problems"];
	const helpKey = `deck.${tab}Help` as DeckKey;

	return (
		<View
			style={{
				...(collapsed ? undefined : { height }),
				backgroundColor: colors.surface,
				borderTopWidth: 1,
				borderTopColor: colors.border,
			}}
		>
			<View
				{...pan.panHandlers}
				accessibilityRole="adjustable"
				accessibilityLabel={t("deck.resizeDock")}
				onAccessibilityAction={(event) => {
					if (event.nativeEvent.actionName === "increment")
						updateHeight(height + 32);
					if (event.nativeEvent.actionName === "decrement")
						updateHeight(height - 32);
				}}
				accessibilityActions={[
					{ name: "increment", label: t("deck.growDock") },
					{ name: "decrement", label: t("deck.shrinkDock") },
				]}
				style={{ height: 24, alignItems: "center", justifyContent: "center" }}
			>
				<View
					style={{
						width: 42,
						height: 4,
						borderRadius: 2,
						backgroundColor: colors.border,
					}}
				/>
			</View>
			<View style={{ flexDirection: "row", paddingHorizontal: 4 }}>
				{tabs.map((item) => (
					<Pressable
						key={item}
						onPress={() => {
							setTab(item);
							if (collapsed) setDockCollapsed(false);
						}}
						style={{
							flex: 1,
							alignItems: "center",
							paddingVertical: 7,
							borderBottomWidth: 2,
							borderBottomColor: tab === item ? colors.primary : "transparent",
						}}
					>
						<Text
							style={{
								color: tab === item ? colors.primary : colors.muted,
								fontSize: 12,
								fontWeight: "700",
							}}
						>
							{t(`deck.${item}` as DeckKey)}
						</Text>
					</Pressable>
				))}
				<Pressable
					onPress={() => setDockCollapsed(!collapsed)}
					accessibilityRole="button"
					accessibilityLabel={t(collapsed ? "deck.expandDock" : "deck.collapseDock")}
					hitSlop={8}
					style={{
						alignItems: "center",
						justifyContent: "center",
						paddingHorizontal: 10,
						paddingVertical: 7,
					}}
				>
					<MaterialIcons
						name={collapsed ? "keyboard-arrow-up" : "keyboard-arrow-down"}
						size={20}
						color={colors.muted}
					/>
				</Pressable>
			</View>
			{!collapsed && height > 96 ? (
				<View style={{ flex: 1, paddingHorizontal: 14, paddingTop: 8 }}>
					{tab === "problems" ? (
						<Text style={{ color: colors.muted }}>{t(helpKey)}</Text>
					) : !uuid.trim() ? (
						<View style={{ gap: 8 }}>
							<Text style={{ color: colors.muted }}>{t(helpKey)}</Text>
							<PrimaryButton
								label={t("deck.selectBoard")}
								onPress={() => router.navigate("/")}
							/>
						</View>
					) : tab === "console" ? (
						<DockConsole
							status={serial.status}
							hostLog={serial.snapshot.host.log}
							usbLog={serial.snapshot.usb.log}
							uuid8={uuid.trim().slice(0, 8)}
						/>
					) : tab === "gpio" ? (
						<DockGpio
							status={gpioTunnel.status}
							header={gpioHeader}
							proxy={gpioProxy}
							proxyStatus={proxyStatus}
							uuid8={uuid.trim().slice(0, 8)}
						/>
					) : (
						<DockFlash
							status={flashStatus}
							proxyStatus={proxyStatus}
							uuid8={uuid.trim().slice(0, 8)}
							projectRepo={projectRepo}
							sketches={sketches}
							busy={flashBusy || proxyBusy || Boolean(flashStatus?.running)}
							error={flashError}
							onFlashProxy={flashProxyFirmware}
							onFlashSketch={flashSketch}
						/>
					)}
				</View>
			) : null}
		</View>
	);
}
