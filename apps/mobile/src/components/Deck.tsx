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
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth.tsx";
import { useColorMode } from "../lib/color-mode.tsx";
import { type DeviceTabId, deviceTabs } from "../lib/dashboard-mode.ts";
import { useDashboardMode } from "../lib/dashboard-mode.tsx";
import { type DeckKey, useDeckT } from "../lib/deck-i18n.ts";
import { useDeviceHub } from "../lib/device-hub.tsx";
import { storageGet, storageSet } from "../lib/storage.ts";

const logo = require("../../assets/logo.png");
const DOCK_STORAGE_KEY = "b6-dockH";
const DOCK_MIN = 64;
const DOCK_MAX = 480;
const DOCK_DEFAULT = 150;
const TAB_BAR_HEIGHT = 56;

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
			<DeckDock
				bottom={TAB_BAR_HEIGHT + Math.max(insets.bottom - 8, 0)}
				isEasy={isEasy}
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
						style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.42)" }}
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
						backgroundColor: "rgba(0,0,0,0.55)",
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

function DeckDock({ bottom, isEasy }: { bottom: number; isEasy: boolean }) {
	const colors = useColorMode().colors;
	const t = useDeckT();
	const [height, setHeight] = useState(DOCK_DEFAULT);
	const [tab, setTab] = useState<DockTab>("console");
	const dragStart = useRef(DOCK_DEFAULT);
	const currentHeight = useRef(DOCK_DEFAULT);
	const lastTap = useRef(0);

	useEffect(() => {
		void storageGet(DOCK_STORAGE_KEY).then((stored) => {
			const parsed = Number(stored);
			if (Number.isFinite(parsed)) {
				const next = Math.max(DOCK_MIN, Math.min(DOCK_MAX, parsed));
				currentHeight.current = next;
				setHeight(next);
			}
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
	const pan = useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: () => true,
				onPanResponderGrant: () => {
					dragStart.current = currentHeight.current;
				},
				onPanResponderMove: (_event, gesture) => {
					const next = Math.max(
						DOCK_MIN,
						Math.min(DOCK_MAX, dragStart.current - gesture.dy),
					);
					currentHeight.current = next;
					setHeight(next);
				},
				onPanResponderRelease: () => updateHeight(currentHeight.current),
			}),
		[updateHeight],
	);
	const tabs: DockTab[] = isEasy
		? ["console", "gpio", "flash"]
		: ["console", "gpio", "flash", "problems"];
	const helpKey = `deck.${tab}Help` as DeckKey;

	return (
		<View
			style={{
				position: "absolute",
				left: 0,
				right: 0,
				bottom,
				height,
				backgroundColor: colors.surface,
				borderTopWidth: 1,
				borderTopColor: colors.border,
			}}
		>
			<Pressable
				{...pan.panHandlers}
				onPress={() => {
					const now = Date.now();
					if (now - lastTap.current < 300) updateHeight(DOCK_DEFAULT);
					lastTap.current = now;
				}}
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
				style={{ height: 12, alignItems: "center", justifyContent: "center" }}
			>
				<View
					style={{
						width: 42,
						height: 4,
						borderRadius: 2,
						backgroundColor: colors.border,
					}}
				/>
			</Pressable>
			<View style={{ flexDirection: "row", paddingHorizontal: 4 }}>
				{tabs.map((item) => (
					<Pressable
						key={item}
						onPress={() => setTab(item)}
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
			</View>
			{height > 96 ? (
				<Text
					style={{ color: colors.muted, paddingHorizontal: 14, paddingTop: 10 }}
				>
					{t(helpKey)}
				</Text>
			) : null}
		</View>
	);
}
