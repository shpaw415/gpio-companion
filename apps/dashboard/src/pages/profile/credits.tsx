import { GET as getCredits, POST as grantCredits } from "@api/credits";
import {
	PUT as capturePaypalOrder,
	POST as createPaypalOrder,
	GET as getPaypalConfig,
} from "@api/credits/paypal";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Skeleton from "@shpaw415/mui-lite/Skeleton";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useRef, useState } from "react";
import { SectionHeader } from "../../components/Section.tsx";
import { useAuthSession } from "../../hooks/useAuth.ts";
import { useColorMode } from "../../hooks/useColorMode.tsx";
import { unwrapAction } from "../../lib/action.ts";
import { isAdmin } from "../../lib/auth/role.ts";
import {
	CREDIT_PACKS_USD,
	type CreditPackUsd,
} from "../../lib/credit-packs.ts";
import { formatUsd } from "../../lib/credits.ts";
import { loadPaypalSdk, paypalButtonsStyle } from "../../lib/paypal-sdk.ts";

type PaypalConfig = {
	configured: boolean;
	liveMode: boolean;
	clientId: string;
	packs: number[];
};

export default function CreditsPage() {
	const session = useAuthSession();
	const { isDark } = useColorMode();
	const admin = isAdmin(session.data?.role);
	const [micros, setMicros] = useState<number | null>(null);
	const [creditsLoading, setCreditsLoading] = useState(true);
	const [paypal, setPaypal] = useState<PaypalConfig | null>(null);
	const [pack, setPack] = useState<CreditPackUsd>(10);
	const [error, setError] = useState("");
	const [status, setStatus] = useState("");
	const paypalMountRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!session.data?.id) {
			setCreditsLoading(false);
			return;
		}
		setCreditsLoading(true);
		void Promise.all([getCredits(), getPaypalConfig()])
			.then(([creditsResult, paypalResult]) => {
				setMicros(unwrapAction(creditsResult).micros);
				setPaypal(unwrapAction(paypalResult));
			})
			.catch((caught: unknown) => {
				setError(caught instanceof Error ? caught.message : "load failed");
			})
			.finally(() => setCreditsLoading(false));
	}, [session.data?.id]);

	useEffect(() => {
		if (!paypal?.configured || !paypal.clientId) {
			return;
		}
		let cancelled = false;
		let buttons: {
			render: (el: HTMLElement) => Promise<void>;
			close: () => Promise<void>;
		} | null = null;
		async function mount() {
			const sdk = await loadPaypalSdk({
				clientId: paypal?.clientId ?? "",
				liveMode: paypal?.liveMode,
			});
			if (cancelled || !paypalMountRef.current) {
				return;
			}
			buttons = sdk.Buttons({
				style: paypalButtonsStyle(isDark),
				createOrder: async () => {
					const created = unwrapAction(await createPaypalOrder(pack));
					return created.orderId;
				},
				onApprove: async (data) => {
					setError("");
					try {
						const next = unwrapAction(await capturePaypalOrder(data.orderID));
						setMicros(next.micros);
						setStatus(`added $${pack.toFixed(2)}`);
					} catch (caught: unknown) {
						setError(
							caught instanceof Error
								? caught.message
								: "PayPal capture failed",
						);
					}
				},
				onError: (caught) => {
					setError(caught.message || "PayPal checkout failed");
				},
			});
			if (paypalMountRef.current) {
				await buttons.render(paypalMountRef.current);
			}
		}
		void mount().catch((caught: unknown) => {
			setError(
				caught instanceof Error ? caught.message : "Could not start PayPal",
			);
		});
		return () => {
			cancelled = true;
			void buttons?.close();
			if (paypalMountRef.current) {
				paypalMountRef.current.innerHTML = "";
			}
		};
	}, [paypal?.configured, paypal?.clientId, paypal?.liveMode, pack, isDark]);

	if (!session.data?.id && !session.data?.email) {
		return (
			<Typography color="secondary">
				<Button href="/login" variant="text">
					Sign in
				</Button>{" "}
				to manage AI credits.
			</Typography>
		);
	}

	return (
		<Stack spacing={3}>
			<SectionHeader title="Credits" />
			<Typography color="secondary">
				OpenCode on the Pi spends gpio-companion balance at Cloudflare Workers
				AI list price (in/out tokens) times markup. Empty balance returns 402.
				Buy a USD pack with PayPal; the paid amount is added as credits.
			</Typography>
			<Paper className="w-full max-w-xl p-4 min-[900px]:p-6" elevation={1}>
				<Stack spacing={2}>
					{creditsLoading ? (
						<Skeleton variant="rounded" height={30} width={130} />
					) : (
						<Typography variant="h5">
							{micros === null ? "…" : formatUsd(micros)}
						</Typography>
					)}
					<Typography variant="subtitle1">Add credits</Typography>
					<Stack direction="row" spacing={1} className="flex-wrap gap-2">
						{CREDIT_PACKS_USD.map((usd) => (
							<Button
								key={usd}
								variant={pack === usd ? "contained" : "outlined"}
								onClick={() => setPack(usd)}
							>
								${usd}
							</Button>
						))}
					</Stack>
					{creditsLoading ? (
						<Skeleton variant="rounded" height={45} />
					) : paypal?.configured && paypal.clientId ? (
						<div ref={paypalMountRef} className="min-h-[45px]" />
					) : (
						<Alert severity="info">
							PayPal checkout is not configured on this host.
						</Alert>
					)}
					{admin ? (
						<Button
							variant="outlined"
							className="w-full min-[900px]:w-auto"
							onClick={() => {
								setError("");
								void grantCredits(1)
									.then((result) => {
										setMicros(unwrapAction(result).micros);
										setStatus("granted $1.00");
									})
									.catch((caught: unknown) => {
										setError(
											caught instanceof Error ? caught.message : "grant failed",
										);
									});
							}}
						>
							Add $1.00 (admin stub)
						</Button>
					) : null}
					{status ? <Alert severity="success">{status}</Alert> : null}
					{error ? <Alert severity="error">{error}</Alert> : null}
				</Stack>
			</Paper>
		</Stack>
	);
}
