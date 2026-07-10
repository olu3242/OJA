import { z } from "zod";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/pricing";
import {
  authedProcedure,
  createCallerFactory,
  publicProcedure,
  roleProcedure,
  router,
} from "./trpc";
import * as subscriptions from "./services/subscriptions";
import * as cycles from "./services/cycles";
import * as procurement from "./services/procurement";
import * as fulfillment from "./services/fulfillment";
import * as forecast from "./services/forecast";
import * as inventory from "./services/inventory";
import * as metrics from "./services/metrics";
import * as markdown from "./services/markdown";
import * as container from "./services/container";

const staff = roleProcedure("WAREHOUSE", "ADMIN");
const admin = roleProcedure("ADMIN");

const planSchema = z.enum(["STARTER", "FAMILY", "STOCK_UP"]);
const varietySchema = z.enum(["WHITE_IJEBU", "YELLOW"]);
const grindSchema = z.enum(["COARSE", "FINE"]);
const addressSchema = z.object({
  line1: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().min(5),
});

export const appRouter = router({
  catalog: router({
    plans: publicProcedure.query(() => PLANS),
    skus: publicProcedure.query(() =>
      db.sku.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    ),
  }),

  subscription: router({
    create: authedProcedure
      .input(
        z.object({
          plan: planSchema,
          variety: varietySchema,
          grind: grindSchema.optional(),
          address: addressSchema,
        }),
      )
      .mutation(({ ctx, input }) =>
        subscriptions.subscribe({ accountId: ctx.account.id, ...input }),
      ),
    mine: authedProcedure.query(({ ctx }) =>
      db.subscription.findMany({
        where: { accountId: ctx.account.id },
        include: { cycles: { orderBy: { scheduledFor: "desc" }, take: 3 } },
        orderBy: { createdAt: "desc" },
      }),
    ),
    pause: authedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwn(ctx.account.id, input.id);
        return subscriptions.pause(input.id);
      }),
    resume: authedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwn(ctx.account.id, input.id);
        return subscriptions.resume(input.id);
      }),
    cancel: authedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwn(ctx.account.id, input.id);
        return subscriptions.cancel(input.id);
      }),
    swap: authedProcedure
      .input(
        z.object({
          id: z.string(),
          variety: varietySchema.optional(),
          grind: grindSchema.optional(),
          plan: planSchema.optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertOwn(ctx.account.id, input.id);
        const { id, ...changes } = input;
        return subscriptions.swap(id, changes);
      }),
  }),

  cycle: router({
    confirm: authedProcedure
      .input(
        z.object({
          cycleId: z.string(),
          edits: z
            .object({
              variety: varietySchema.optional(),
              grind: grindSchema.optional(),
            })
            .optional(),
          address: addressSchema.optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertOwnCycle(ctx.account.id, input.cycleId);
        return cycles.confirmCycle(input.cycleId, input.edits, input.address);
      }),
    skip: authedProcedure
      .input(z.object({ cycleId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnCycle(ctx.account.id, input.cycleId);
        return cycles.skipCycle(input.cycleId);
      }),
  }),

  order: router({
    mine: authedProcedure.query(({ ctx }) =>
      db.order.findMany({
        where: { accountId: ctx.account.id },
        include: { lines: { include: { sku: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ),
  }),

  wholesale: router({
    join: publicProcedure
      .input(
        z.object({
          businessName: z.string().min(1),
          email: z.string().email(),
          businessType: z.string().min(1),
          message: z.string().optional(),
        }),
      )
      .mutation(({ input }) => db.wholesaleLead.create({ data: input })),
  }),

  warehouse: router({
    openPos: staff.query(() =>
      db.purchaseOrder.findMany({
        where: { status: { in: ["PLACED", "PARTIALLY_RECEIVED"] } },
        include: { lines: { include: { sku: true } }, supplier: true },
      }),
    ),
    receive: staff
      .input(
        z.object({
          poLineId: z.string(),
          qtyUnits: z.number().int().positive(),
          lotCode: z.string().min(1),
          expiresAt: z.date().optional(),
          qcPassed: z.boolean(),
          qcNotes: z.string().optional(),
        }),
      )
      .mutation(({ input }) => procurement.receivePoLine(input)),
    generateWave: staff
      .input(z.object({ warehouseId: z.string() }))
      .mutation(({ input }) => fulfillment.generateWave(input.warehouseId)),
    confirmPick: staff
      .input(
        z.object({
          orderId: z.string(),
          picks: z.array(
            z.object({
              orderLineId: z.string(),
              lotCode: z.string(),
              qtyUnits: z.number().int().positive(),
            }),
          ),
        }),
      )
      .mutation(({ input }) =>
        fulfillment.confirmPick(input.orderId, input.picks),
      ),
    dispatch: staff
      .input(z.object({ orderId: z.string() }))
      .mutation(({ input }) => fulfillment.dispatch(input.orderId)),
    markDelivered: staff
      .input(z.object({ orderId: z.string() }))
      .mutation(({ input }) => fulfillment.markDelivered(input.orderId)),
  }),

  admin: router({
    dashboard: admin.query(() => metrics.dashboard()),
    suppliers: admin.query(() => db.supplier.findMany()),
    createSupplier: admin
      .input(
        z.object({
          name: z.string().min(1),
          country: z.string().length(2),
          contactEmail: z.string().email().optional(),
          fastPay: z.boolean().optional(),
        }),
      )
      .mutation(({ input }) => procurement.createSupplier(input)),
    createPo: admin
      .input(
        z.object({
          supplierId: z.string(),
          warehouseId: z.string(),
          expectedAt: z.date().optional(),
          place: z.boolean().optional(),
          lines: z.array(
            z.object({
              skuId: z.string(),
              qtyUnits: z.number().int().positive(),
              unitCostCents: z.number().int().positive(),
            }),
          ),
        }),
      )
      .mutation(({ input }) => procurement.createPurchaseOrder(input)),
    placePo: admin
      .input(z.object({ poId: z.string() }))
      .mutation(({ input }) => procurement.placePurchaseOrder(input.poId)),
    runForecast: admin.mutation(() => forecast.runForecast()),
    reorderSuggestions: admin
      .input(z.object({ warehouseId: z.string() }))
      .query(({ input }) => forecast.reorderSuggestions(input.warehouseId)),
    draftPo: admin
      .input(z.object({ warehouseId: z.string(), supplierId: z.string() }))
      .mutation(({ input }) =>
        forecast.draftPoFromSuggestions(input.warehouseId, input.supplierId),
      ),
    overrideForecast: admin
      .input(
        z.object({
          forecastId: z.string(),
          qtyUnits: z.number().int().nonnegative(),
          reasonCode: z.string().min(1),
        }),
      )
      .mutation(({ input }) =>
        forecast.overrideForecast(
          input.forecastId,
          input.qtyUnits,
          input.reasonCode,
        ),
      ),
    recall: admin
      .input(z.object({ lotCode: z.string() }))
      .query(({ input }) => inventory.recallLot(input.lotCode)),
    refund: admin
      .input(z.object({ orderId: z.string(), reasonCode: z.string().min(1) }))
      .mutation(({ input }) =>
        fulfillment.refundOrder(input.orderId, input.reasonCode),
      ),
    freshDeals: admin.query(() => markdown.freshDeals()),
    containerPlan: admin
      .input(z.object({ warehouseId: z.string() }))
      .query(({ input }) => container.containerPlan(input.warehouseId)),
    wholesaleLeads: admin.query(() =>
      db.wholesaleLead.findMany({ orderBy: { createdAt: "desc" } }),
    ),
  }),
});

async function assertOwn(accountId: string, subscriptionId: string) {
  const sub = await db.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
  });
  if (sub.accountId !== accountId) throw new Error("Not your subscription");
}

async function assertOwnCycle(accountId: string, cycleId: string) {
  const cycle = await db.cycle.findUniqueOrThrow({
    where: { id: cycleId },
    include: { subscription: true },
  });
  if (cycle.subscription.accountId !== accountId)
    throw new Error("Not your cycle");
}

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
