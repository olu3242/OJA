import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

// Notification adapter — Twilio (SMS/WhatsApp) + Resend (email) in production.
// Stub logs to notification_logs until keys exist, keeping templates/call
// sites real so swapping the adapter is a one-file change.
export type NotificationTemplate =
  | "subscription_confirmed"
  | "cycle_confirm_nudge"
  | "order_confirmed"
  | "out_for_delivery"
  | "delivered"
  | "refund_processed";

export async function notify(
  accountId: string | null,
  template: NotificationTemplate,
  payload: Prisma.InputJsonValue = {},
) {
  await db.notificationLog.create({
    data: { accountId, channel: "email", template, payload },
  });
}
