import { requireAdmin } from "../../../lib/admin-auth";

export const onRequest: PagesFunction<Env, string> = async (ctx) => {
	await requireAdmin(ctx as never);
	return ctx.next();
};
