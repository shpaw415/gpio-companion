import { GET, PATCH, POST, PUT } from "@api/admin/products";
import {
	DELETE as deleteImage,
	GET as listImages,
	POST as uploadImage,
} from "@api/admin/product-images";
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
import { useCallback, useEffect, useRef, useState } from "react";
import AdminSection from "../../../components/AdminSection.tsx";
import TablePaginationShell, {
	type RowsPerPage,
} from "../../../components/TablePaginationShell.tsx";
import { useT } from "../../../hooks/useLocale.tsx";

type AdminProduct = Awaited<ReturnType<typeof GET>>[number];
type ProductImage = Awaited<ReturnType<typeof listImages>>[number];

export default function AdminProductsPage() {
	const t = useT();
	const [rows, setRows] = useState<AdminProduct[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState("");
	const [nameEn, setNameEn] = useState("");
	const [nameFr, setNameFr] = useState("");
	const [price, setPrice] = useState("");
	const [saving, setSaving] = useState(false);
	const [images, setImages] = useState<ProductImage[]>([]);
	const [altEn, setAltEn] = useState("");
	const [altFr, setAltFr] = useState("");
	const [uploading, setUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState<RowsPerPage>(10);

	async function loadImages(productId: string) {
		try {
			setImages(await listImages(productId));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	const reload = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const list = await GET();
			setRows(list);
			if (!selectedId && list[0]) select(list[0]);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [selectedId]);

	function select(item: AdminProduct) {
		setSelectedId(item.id);
		setNameEn(item.nameEn);
		setNameFr(item.nameFr);
		setPrice(item.priceCents === null ? "" : String(item.priceCents));
		setError(null);
		void loadImages(item.id);
	}

	useEffect(() => {
		void reload();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const selected = rows.find((item) => item.id === selectedId);

	async function run(action: () => Promise<unknown>) {
		setSaving(true);
		setError(null);
		try {
			await action();
			await reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	}

	function draftInput() {
		if (!selected) throw new Error("No product selected");
		const priceCents = price.trim() === "" ? null : Number.parseInt(price, 10);
		return {
			slug: selected.slug,
			sku: selected.sku,
			nameEn: nameEn.trim(),
			nameFr: nameFr.trim(),
			descriptionEn: selected.descriptionEn,
			descriptionFr: selected.descriptionFr,
			priceCents,
		};
	}

	const visible = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

	return (
		<AdminSection value="products">
			<Typography variant="h4" component="h1">
				{t("admin.products")}
			</Typography>
			{error ? (
				<Paper variant="outlined" style={{ padding: "0.8rem 1.2rem" }}>
					<Typography color="error">{error}</Typography>
				</Paper>
			) : null}
			<Paper variant="outlined" className="market-admin-form">
				<Typography variant="h6" component="h2">
					{t("admin.productEditor")} — {selected?.sku ?? "—"}
				</Typography>
				<div className="market-form-row">
					<TextField
						label={t("admin.nameEn")}
						value={nameEn}
						onChange={(event) => setNameEn(event.target.value)}
					/>
					<TextField
						label={t("admin.nameFr")}
						value={nameFr}
						onChange={(event) => setNameFr(event.target.value)}
					/>
				</div>
				<div className="market-form-row">
					<TextField
						label={t("admin.priceCents")}
						placeholder="empty — admin must set"
						value={price}
						onChange={(event) => setPrice(event.target.value)}
					/>
					<TextField
						label={t("admin.skuSlug")}
						value={selected ? `${selected.sku} / ${selected.slug}` : ""}
						disabled
					/>
				</div>
				<Typography variant="subtitle2">
					{t("admin.images")} ({images.length})
				</Typography>
				{images.length === 0 ? (
					<Typography variant="body2" color="textSecondary">
						{t("admin.noImages")}
					</Typography>
				) : (
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell />
								<TableCell>alt EN / FR</TableCell>
								<TableCell>order</TableCell>
								<TableCell />
							</TableRow>
						</TableHead>
						<TableBody>
							{images.map((image) => (
								<TableRow key={image.id}>
									<TableCell>
										<img
											src={`/api/media?key=${encodeURIComponent(image.r2Key)}`}
											alt={image.altEn}
											width={72}
											height={44}
											style={{ objectFit: "cover", borderRadius: 8 }}
										/>
									</TableCell>
									<TableCell>
										{image.altEn} / {image.altFr}
									</TableCell>
									<TableCell>{image.sortOrder}</TableCell>
									<TableCell>
										<Button
											variant="text"
											size="small"
											disabled={uploading}
											onClick={() =>
												run(async () => {
													await deleteImage(image.id);
													await loadImages(selectedId);
												})
											}
										>
											{t("admin.delete")}
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
				<div className="market-form-row">
					<TextField
						label="alt EN"
						value={altEn}
						onChange={(event) => setAltEn(event.target.value)}
					/>
					<TextField
						label="alt FR"
						value={altFr}
						onChange={(event) => setAltFr(event.target.value)}
					/>
				</div>
				<div className="bar">
					<input
						ref={fileInputRef}
						type="file"
						accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
						hidden
						disabled={!selected || uploading}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (!file || !selected) return;
							event.target.value = "";
							setUploading(true);
							setError(null);
							uploadImage(selected.id, file, altEn.trim(), altFr.trim())
								.then(() => loadImages(selected.id))
								.then(() => {
									setAltEn("");
									setAltFr("");
								})
								.catch((err: unknown) =>
									setError(err instanceof Error ? err.message : String(err)),
								)
								.finally(() => setUploading(false));
						}}
					/>
					<Button
						variant="outlined"
						disabled={!selected || uploading}
						onClick={() => fileInputRef.current?.click()}
					>
						{uploading ? t("state.loading") : t("admin.uploadImage")}
					</Button>
					<Typography variant="body2" color="textSecondary">
						JPEG / PNG / WebP / AVIF / GIF · ≤ 5 MB
					</Typography>
				</div>
				<div className="bar">
					<Button
						variant="contained"
						disabled={!selected || saving}
						onClick={() =>
							run(() => PUT(selectedId, draftInput()).then(() => undefined))
						}
					>
						{t("admin.saveDraft")}
					</Button>
					<Button
						variant="outlined"
						disabled={!selected || saving}
						onClick={() => run(() => PATCH(selectedId, "published"))}
					>
						{t("admin.publish")}
					</Button>
					<Button
						variant="text"
						disabled={!selected || saving}
						onClick={() => run(() => PATCH(selectedId, "archived"))}
					>
						{t("admin.archive")}
					</Button>
				</div>
			</Paper>
			<Paper variant="outlined" className="market-admin-form">
				<Typography variant="h6" component="h2">
					{t("admin.create")}
				</Typography>
				<CreateProductForm
					disabled={saving}
					onCreated={(item) => {
						void reload().then(() => select(item as AdminProduct));
					}}
					onError={setError}
				/>
			</Paper>
			{loading ? (
				<Typography color="textSecondary">{t("state.loading")}</Typography>
			) : (
				<TablePaginationShell
					count={rows.length}
					page={page}
					rowsPerPage={rowsPerPage}
					onPageChange={setPage}
					onRowsPerPageChange={(next) => {
						setRowsPerPage(next);
						setPage(0);
					}}
				>
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>SKU</TableCell>
								<TableCell>{t("catalog.kit")}</TableCell>
								<TableCell>{t("admin.statusLabel")}</TableCell>
								<TableCell>{t("catalog.price")}</TableCell>
								<TableCell />
							</TableRow>
						</TableHead>
						<TableBody>
							{visible.map((item) => (
								<TableRow key={item.id} selected={item.id === selectedId}>
									<TableCell>{item.sku}</TableCell>
									<TableCell>{item.nameEn}</TableCell>
									<TableCell>
										<Chip
											size="small"
											color={item.status === "published" ? "success" : "warning"}
										>
											{item.status}
										</Chip>
									</TableCell>
									<TableCell>
										{item.priceCents === null ? t("catalog.tbd") : item.priceCents}
									</TableCell>
									<TableCell>
										<Button
											variant="text"
											size="small"
											onClick={() => select(item)}
										>
											Edit
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TablePaginationShell>
			)}
		</AdminSection>
	);
}

function CreateProductForm({
	disabled,
	onCreated,
	onError,
}: {
	disabled: boolean;
	onCreated: (item: unknown) => void;
	onError: (message: string | null) => void;
}) {
	const [slug, setSlug] = useState("");
	const [sku, setSku] = useState("");
	const [nameEn, setNameEn] = useState("");
	const [nameFr, setNameFr] = useState("");
	const [busy, setBusy] = useState(false);

	async function create() {
		setBusy(true);
		onError(null);
		try {
			const item = await POST({
				slug: slug.trim(),
				sku: sku.trim(),
				nameEn: nameEn.trim(),
				nameFr: nameFr.trim(),
				descriptionEn: nameEn.trim(),
				descriptionFr: nameFr.trim(),
				priceCents: null,
			});
			setSlug("");
			setSku("");
			setNameEn("");
			setNameFr("");
			onCreated(item);
		} catch (err) {
			onError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}

	return (
		<div>
			<div className="market-form-row">
				<TextField
					label="slug"
					placeholder="my-kit"
					value={slug}
					onChange={(event) => setSlug(event.target.value)}
				/>
				<TextField
					label="SKU"
					placeholder="GPIO-MY-KIT"
					value={sku}
					onChange={(event) => setSku(event.target.value)}
				/>
			</div>
			<div className="market-form-row">
				<TextField
					label="Name EN"
					value={nameEn}
					onChange={(event) => setNameEn(event.target.value)}
				/>
				<TextField
					label="Name FR"
					value={nameFr}
					onChange={(event) => setNameFr(event.target.value)}
				/>
			</div>
			<div className="bar">
				<Button variant="contained" disabled={disabled || busy} onClick={create}>
					Create draft
				</Button>
			</div>
		</div>
	);
}
