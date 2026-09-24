import { CircularProgress } from "@shpaw415/mui-lite/Progress";
import Typography from "@shpaw415/mui-lite/Typography";
import { detectLocale, LOCALE_STORAGE_KEY, translate } from "../i18n/index.ts";

export default function Loading() {
	const stored =
		typeof window === "undefined"
			? null
			: window.localStorage.getItem(LOCALE_STORAGE_KEY);
	const locale = detectLocale({ stored });
	return (
		<div
			className="market-full-state circuit-grid"
			role="status"
			aria-live="polite"
		>
			<div className="market-loader-board">
				<CircularProgress color="primary" size="52px" />
				<span className="market-loader-led" />
			</div>
			<Typography variant="h5" component="p">
				{translate(locale, "state.loading")}
			</Typography>
			<Typography color="textSecondary">
				{translate(locale, "state.loadingBody")}
			</Typography>
		</div>
	);
}
