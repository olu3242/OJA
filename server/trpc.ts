import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Account } from "@/lib/generated/prisma/client";

export type Context = { account: Account | null };

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.account) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { account: ctx.account } });
});

export function roleProcedure(...roles: Account["role"][]) {
  return authedProcedure.use(({ ctx, next }) => {
    if (!roles.includes(ctx.account.role))
      throw new TRPCError({ code: "FORBIDDEN" });
    return next({ ctx });
  });
}

export const createCallerFactory = t.createCallerFactory;
