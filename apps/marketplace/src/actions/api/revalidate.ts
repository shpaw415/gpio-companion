import { getContext } from "@next/action/context";
import { revalidate } from "@next/ssr/revalidate";

export async function DELETE(pathname: string) {
	const ctx = getContext(arguments);
	await revalidate(pathname, ctx);
	return "ok";
}
