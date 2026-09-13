export type Viewport = {
	scale: number;
	x: number;
	y: number;
};

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;

export function clampScale(
	scale: number,
	min = MIN_SCALE,
	max = MAX_SCALE,
): number {
	return Math.min(max, Math.max(min, scale));
}

export function zoomAt(
	viewport: Viewport,
	factor: number,
	originX: number,
	originY: number,
	min = MIN_SCALE,
	max = MAX_SCALE,
): Viewport {
	const next = clampScale(viewport.scale * factor, min, max);
	if (next === viewport.scale) {
		return viewport;
	}
	const ratio = next / viewport.scale;
	return {
		scale: next,
		x: originX - (originX - viewport.x) * ratio,
		y: originY - (originY - viewport.y) * ratio,
	};
}

export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
	return { ...viewport, x: viewport.x + dx, y: viewport.y + dy };
}

export function fitContain(
	contentW: number,
	contentH: number,
	viewW: number,
	viewH: number,
	padding = 16,
): Viewport {
	return fitRect(
		{ x: 0, y: 0, width: contentW, height: contentH },
		viewW,
		viewH,
		padding,
	);
}

export function fitRect(
	rect: { x: number; y: number; width: number; height: number },
	viewW: number,
	viewH: number,
	padding = 16,
): Viewport {
	if (viewW < 1 || viewH < 1 || rect.width < 1 || rect.height < 1) {
		return { scale: 1, x: 0, y: 0 };
	}
	const innerW = Math.max(1, viewW - padding * 2);
	const innerH = Math.max(1, viewH - padding * 2);
	const scale = clampScale(Math.min(innerW / rect.width, innerH / rect.height));
	return {
		scale,
		x: (viewW - rect.width * scale) / 2 - rect.x * scale,
		y: (viewH - rect.height * scale) / 2 - rect.y * scale,
	};
}

export function touchDistance(
	a: { clientX: number; clientY: number },
	b: { clientX: number; clientY: number },
): number {
	return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

export function touchMidpoint(
	a: { clientX: number; clientY: number },
	b: { clientX: number; clientY: number },
): { x: number; y: number } {
	return {
		x: (a.clientX + b.clientX) / 2,
		y: (a.clientY + b.clientY) / 2,
	};
}
