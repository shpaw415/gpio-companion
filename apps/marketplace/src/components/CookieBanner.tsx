import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import { useEffect, useState } from "react";
import { useT } from "../hooks/useLocale.tsx";
import { readConsent, writeConsent } from "../lib/consent.ts";

export default function CookieBanner() {
	const t = useT();
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		setVisible(readConsent() === null);
	}, []);

	if (!visible) return null;
	return (
		<Paper className="market-cookie-banner" elevation={3}>
			<Alert severity="info" variant="outlined" title={t("cookies.title")}>
				<p>{t("cookies.body")}</p>
				<div className="bar">
					<Button
						variant="contained"
						onClick={() => {
							writeConsent(true);
							setVisible(false);
						}}
					>
						{t("cookies.accept")}
					</Button>
					<Button
						variant="outlined"
						onClick={() => {
							writeConsent(false);
							setVisible(false);
						}}
					>
						{t("cookies.refuse")}
					</Button>
				</div>
			</Alert>
		</Paper>
	);
}
