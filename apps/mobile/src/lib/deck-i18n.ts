import { useCallback } from "react";
import { useT } from "./locale.tsx";

const DECK_KEYS = {
	"deck.brandShort": "deck.brandShort",
	"deck.menu": "deck.mobile.menu",
	"deck.search": "deck.mobile.search",
	"deck.searchPlaceholder": "deck.command.placeholder",
	"deck.easy": "deck.mode.easy",
	"deck.expert": "deck.mode.expert",
	"deck.switchToLight": "deck.theme.toLight",
	"deck.switchToDark": "deck.theme.toDark",
	"deck.close": "deck.mobile.close",
	"deck.navigation": "deck.mobile.navigation",
	"deck.project": "deck.bottom.project",
	"deck.devices": "deck.bottom.devices",
	"deck.profile": "deck.bottom.profile",
	"deck.overview": "deck.link.myBoard",
	"deck.docs": "deck.link.learn",
	"deck.t3": "deck.link.code",
	"deck.pair": "deck.link.pair",
	"deck.wifi": "deck.link.wifi",
	"deck.requests": "deck.link.requests",
	"deck.debug": "deck.link.debug",
	"deck.admin": "deck.link.admin",
	"deck.statusReady": "deck.status.ready",
	"deck.statusContext": "deck.status.context",
	"deck.noResults": "deck.command.empty",
	"deck.console": "deck.dock.console",
	"deck.gpio": "deck.dock.gpio",
	"deck.flash": "deck.dock.flash",
	"deck.problems": "deck.dock.problems",
	"deck.consoleHelp": "deck.dock.consoleHint",
	"deck.gpioHelp": "deck.dock.gpioHint",
	"deck.flashHelp": "deck.dock.flashHint",
	"deck.problemsHelp": "deck.dock.problemsHint",
	"deck.resizeDock": "deck.mobile.resizeDock",
	"deck.shrinkDock": "deck.dock.shrink",
	"deck.growDock": "deck.dock.grow",
	"deck.mode": "deck.command.mode",
	"deck.theme": "deck.command.theme",
	"deck.useEasy": "deck.command.easy",
	"deck.useExpert": "deck.command.expert",
	"deck.boardRun": "project.run",
	"deck.boardFlash": "flash.flash",
	"deck.boardVerify": "verify.verify",
	"deck.boardSave": "project.saveToGithub",
	"deck.boardBuy": "credits.add",
	"deck.openBoardTools": "project.boardTools",
	"deck.openDebug": "debug.title",
	"deck.noBoard": "deck.status.noBoard",
	"deck.boardLine": "deck.status.board",
	"deck.selectBoard": "devices.selectBoard",
	"deck.collapseDock": "project.hide",
	"deck.expandDock": "project.show",
} as const;

export type DeckKey = keyof typeof DECK_KEYS;

export function useDeckT() {
	const t = useT();
	return useCallback(
		(key: DeckKey, vars?: Record<string, string | number>) =>
			t(DECK_KEYS[key], vars),
		[t],
	);
}
