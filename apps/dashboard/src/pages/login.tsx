import LoginPanel from "@components/LoginPanel";
import { useEffect } from "react";
import { useAuthSession } from "../hooks/useAuth.ts";

export default function LoginPage() {
	const session = useAuthSession();

	useEffect(() => {
		if (session.data?.id || session.data?.email) {
			window.location.assign("/project");
		}
	}, [session.data?.id, session.data?.email]);

	return <LoginPanel />;
}
