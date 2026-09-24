import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Typography from "@shpaw415/mui-lite/Typography";
import { detectLocale, LOCALE_STORAGE_KEY, translate } from "../i18n/index.ts";
import { ArrowIcon } from "./icons.tsx";

export default function NotFound() {
	const stored =
		typeof window === "undefined"
			? null
			: window.localStorage.getItem(LOCALE_STORAGE_KEY);
	const locale = detectLocale({ stored });
	return (
		<main className="market-full-state circuit-grid">
			<div className="market-404-art" aria-hidden="true">
				<span>4</span>
				<i />
				<span>4</span>
			</div>
			<Chip color="secondary" variant="outlined">
				{translate(locale, "state.notFoundCode")}
			</Chip>
			<Typography variant="h3" component="h1">
				{translate(locale, "state.notFoundTitle")}
			</Typography>
			<Typography color="textSecondary">
				{translate(locale, "state.notFoundBody")}
			</Typography>
			<Button href="/" variant="contained" endIcon={<ArrowIcon />}>
				{translate(locale, "action.goHome")}
			</Button>
		</main>
	);
}
