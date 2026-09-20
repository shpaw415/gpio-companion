import { DELETE, GET, POST } from "@api/admin/shipping";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Table, {
	TableBody,
	TableCell,
	TableHead,
	TableRow,
} from "@shpaw415/mui-lite/Table";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useCallback, useEffect, useState } from "react";
import AdminSection from "../../../components/AdminSection.tsx";
import { useT } from "../../../hooks/useLocale.tsx";

type ShippingRate = Awaited<ReturnType<typeof GET>>[number];

export default function AdminShippingPage() {
	const t = useT();
	const [rates, setRates] = useState<ShippingRate[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [country, setCountry] = useState("");
	const [region, setRegion] = useState("");
	const [flat, setFlat] = useState("");
	const [busy, setBusy] = useState(false);

	const reload = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setRates(await GET());
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	async function add() {
		const flatCents = Number.parseInt(flat.trim(), 10);
		setBusy(true);
		setError(null);
		try {
			await POST({
				country: country.trim(),
				region: region.trim() || null,
				flatCents,
			});
			setCountry("");
			setRegion("");
			setFlat("");
			await reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}

	async function remove(id: string) {
		setError(null);
		try {
			await DELETE(id);
			await reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	return (
		<AdminSection value="shipping">
			<Typography variant="h4" component="h1">
				{t("admin.shipping")}
			</Typography>
			{error ? (
				<Paper variant="outlined" style={{ padding: "0.8rem 1.2rem" }}>
					<Typography color="error">{error}</Typography>
				</Paper>
			) : null}
			<Paper variant="outlined" className="market-admin-form">
				<div className="market-form-row">
					<TextField
						label={t("admin.country")}
						placeholder="FR"
						value={country}
						onChange={(event) => setCountry(event.target.value)}
					/>
					<TextField
						label={t("admin.region")}
						value={region}
						onChange={(event) => setRegion(event.target.value)}
					/>
				</div>
				<TextField
					label={t("admin.flatCents")}
					placeholder="1290"
					value={flat}
					onChange={(event) => setFlat(event.target.value)}
				/>
				<div className="bar">
					<Button variant="contained" disabled={busy} onClick={add}>
						{t("admin.create")}
					</Button>
				</div>
			</Paper>
			<Paper variant="outlined" className="market-table-shell">
				{loading ? (
					<Typography color="textSecondary" style={{ padding: "1rem" }}>
						{t("state.loading")}
					</Typography>
				) : (
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>{t("admin.country")}</TableCell>
								<TableCell>{t("admin.region")}</TableCell>
								<TableCell>{t("admin.flatCents")}</TableCell>
								<TableCell>{t("admin.statusLabel")}</TableCell>
								<TableCell />
							</TableRow>
						</TableHead>
						<TableBody>
							{rates.length === 0 ? (
								<TableRow>
									<TableCell colSpan={5} style={{ color: "var(--market-muted)" }}>
										—
									</TableCell>
								</TableRow>
							) : (
								rates.map((rate) => (
									<TableRow key={rate.id}>
										<TableCell>{rate.country}</TableCell>
										<TableCell>{rate.region ?? "—"}</TableCell>
										<TableCell>{rate.flatCents}</TableCell>
										<TableCell>
											<Chip
												size="small"
												color={rate.active ? "success" : undefined}
											>
												{rate.active ? "active" : "inactive"}
											</Chip>
										</TableCell>
										<TableCell>
											<Button
												variant="text"
												size="small"
												onClick={() => remove(rate.id)}
											>
												{t("admin.delete")}
											</Button>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				)}
			</Paper>
		</AdminSection>
	);
}
