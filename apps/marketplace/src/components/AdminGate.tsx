import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import type { ReactNode } from "react";
import { useT } from "../hooks/useLocale.tsx";
import { LockIcon } from "./icons.tsx";

export type AdminGateProps = {
	isAdmin: boolean;
	children: ReactNode;
	signInSlot?: ReactNode;
	loginHref?: string;
};

export default function AdminGate({
	isAdmin,
	children,
	signInSlot,
	loginHref = "/login",
}: AdminGateProps) {
	const t = useT();
	if (isAdmin) return children;
	return (
		<div className="market-admin-gate">
			<Alert
				severity="warning"
				variant="outlined"
				icon={<LockIcon />}
				title={t("admin.restrictedTitle")}
			>
				<p>{t("admin.restrictedBody")}</p>
				{signInSlot ?? (
					<Button href={loginHref} variant="contained">
						{t("admin.signIn")}
					</Button>
				)}
			</Alert>
		</div>
	);
}
