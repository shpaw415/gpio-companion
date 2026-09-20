import { requireAdmin } from "../../../lib/admin-auth";

export const onRequest: PagesFunction<Env, string> = (ctx) => {
	// @ts-expect-error
	requireAdmin(ctx);
	return ctx.next();
};
