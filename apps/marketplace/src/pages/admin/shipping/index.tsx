import { DELETE, GET, POST, PUT } from "@api/admin/shipping";
import Alert from "@shpaw415/mui-lite/Alert";
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
import { useLocale, useT } from "../../../hooks/useLocale.tsx";
import { formatCents } from "../../../lib/format.ts";

type ShippingRate = Awaited<ReturnType<typeof GET>>[number];

export default function AdminShippingPage() {
	const t = useT();
	const { locale } = useLocale();
	const [rates, setRates] = useState<ShippingRate[]>([]);
	const [editing, setEditing] = useState<string | null>(null);
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
			const input = {
				country: country.trim(),
				region: region.trim() || null,
				flatCents,
			};
			if (editing) await PUT(editing, input);
			else await POST(input);
			setEditing(null);
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
			{error ? <Alert severity="error">{error}</Alert> : null}
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
						{editing ? t("admin.saveDraft") : t("admin.create")}
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
										{t("admin.emptyRates")}
									</TableCell>
								</TableRow>
							) : (
								rates.map((rate) => (
									<TableRow key={rate.id}>
										<TableCell>{rate.country}</TableCell>
										<TableCell>{rate.region ?? "—"}</TableCell>
										<TableCell>{formatCents(rate.flatCents, "USD", locale)}</TableCell>
										<TableCell>
											<Chip
												size="small"
												color={rate.active ? "success" : undefined}
											>
												{rate.active ? t("admin.active") : t("admin.inactive")}
											</Chip>
										</TableCell>
										<TableCell>
											<Button
												variant="text"
												size="small"
												onClick={() => {
													setEditing(rate.id);
													setCountry(rate.country);
													setRegion(rate.region ?? "");
													setFlat(String(rate.flatCents));
												}}
											>
												{t("admin.edit")}
											</Button>
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
