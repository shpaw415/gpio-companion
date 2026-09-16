import LoginPanel from "@components/LoginPanel";
import Stack from "@shpaw415/mui-lite/Stack";
import { useEffect } from "react";
import LanguageCard from "../components/LanguageCard.tsx";
import { useAuthSession } from "../hooks/useAuth.ts";

export default function LoginPage() {
	const session = useAuthSession();

	useEffect(() => {
		if (session.data?.id || session.data?.email) {
			window.location.assign("/project");
		}
	}, [session.data?.id, session.data?.email]);

	return (
		<Stack spacing={3} className="mx-auto w-full max-w-md">
			<LoginPanel />
			<LanguageCard />
		</Stack>
	);
}
