import { CircularProgress } from "@shpaw415/mui-lite/Progress";
import Typography from "@shpaw415/mui-lite/Typography";
import { translate } from "../i18n/index.ts";

export default function Loading() {
	return (
		<div
			className="market-full-state circuit-grid"
			role="status"
			aria-live="polite"
		>
			<div className="market-loader-board">
				<CircularProgress color="primary" size={52} />
				<span className="market-loader-led" />
			</div>
			<Typography variant="h5" component="p">
				{translate("en", "state.loading")}
			</Typography>
			<Typography color="textSecondary">
				{translate("en", "state.loadingBody")}
			</Typography>
		</div>
	);
}
