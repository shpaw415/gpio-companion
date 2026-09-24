import { getContext } from "@next/action/context";
import { readSession } from "../../lib/auth.ts";

export async function GET() {
	const ctx = getContext<Env, never, never>(arguments);
	return readSession(ctx);
}
