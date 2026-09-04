import { isTauri } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const T3_WINDOW_LABEL = "t3";

let currentUrl = "";
const listeners = new Set<() => void>();

function notify() {
	for (const listener of listeners) {
		listener();
	}
}

export function subscribeT3Window(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function waitCreated(view: WebviewWindow) {
	return new Promise<void>((resolve, reject) => {
		view.once("tauri://created", () => resolve());
		view.once("tauri://error", (event) => {
			reject(new Error(String(event.payload ?? "t3 window failed")));
		});
	});
}

async function placement() {
	try {
		const main = getCurrentWindow();
		const factor = await main.scaleFactor();
		const size = await main.innerSize();
		const pos = await main.outerPosition();
		return {
			width: Math.max(900, Math.round(size.width / factor)),
			height: Math.max(600, Math.round(size.height / factor)),
			x: Math.round(pos.x / factor) + 48,
			y: Math.round(pos.y / factor) + 48,
		};
	} catch {
		return { width: 1280, height: 800 };
	}
}

function watchClosed(view: WebviewWindow) {
	void view.listen("tauri://destroyed", () => {
		currentUrl = "";
		notify();
	});
}

export async function t3WindowOpen(): Promise<boolean> {
	if (!isTauri()) {
		return false;
	}
	const existing = await WebviewWindow.getByLabel(T3_WINDOW_LABEL);
	return Boolean(existing);
}

export async function focusT3Window(): Promise<boolean> {
	if (!isTauri()) {
		return false;
	}
	const existing = await WebviewWindow.getByLabel(T3_WINDOW_LABEL);
	if (!existing) {
		return false;
	}
	await existing.show();
	await existing.setFocus();
	return true;
}

export async function openT3Window(url: string): Promise<boolean> {
	const want = url.trim();
	if (!want || !isTauri()) {
		return false;
	}
	try {
		const existing = await WebviewWindow.getByLabel(T3_WINDOW_LABEL);
		if (existing && currentUrl === want) {
			await existing.show();
			await existing.setFocus();
			notify();
			return true;
		}
		if (existing) {
			await existing.close().catch(() => undefined);
		}
		const view = new WebviewWindow(T3_WINDOW_LABEL, {
			url: want,
			title: "T3 Code",
			...(await placement()),
			focus: true,
			visible: true,
			minWidth: 900,
			minHeight: 600,
		});
		await waitCreated(view);
		currentUrl = want;
		watchClosed(view);
		notify();
		return true;
	} catch (caught) {
		console.error("gpio-companion-desktop t3 window", caught);
		return false;
	}
}
