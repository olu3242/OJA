import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/canonical";
import { adminClient } from "./helpers";
import { resetDb } from "../helpers";
import { convergeAccount } from "@/server/repositories/convergence";
import { resolveCustomer } from "@/server/repositories/payments";
import {
  recordPaymentAttempt,
  failedAttemptCount,
  dunningSchedule,
  BACKOFF_DAYS,
} from "@/server/repositories/dunning";

describe("dunning schedule (pure policy)", () => {
  it("backs off per BACKOFF_DAYS then gives up", () => {
    expect(dunningSchedule(0)).toEqual({
      attempt: 0,
      retryInDays: 1,
      giveUp: false,
    });
    expect(dunningSchedule(1).retryInDays).toBe(3);
    expect(dunningSchedule(2).retryInDays).toBe(5);
    const exhausted = dunningSchedule(BACKOFF_DAYS.length);
    expect(exhausted.giveUp).toBe(true);
    expect(exhausted.retryInDays).toBeNull();
  });
});

describe("dunning attempt counting", () => {
  let orgId: string;
  let customerId: string;

  beforeAll(async () => {
    await migrate();
    const fx = await resetDb();
    await convergeAccount(fx.household.id);
    const resolved = await resolveCustomer(fx.household.id);
    orgId = resolved!.orgId;
    customerId = resolved!.customerId;
    const c = await adminClient();
    await c.query(
      `delete from public.payment_attempts where customer_id = $1`,
      [customerId],
    );
    await c.end();
  });

  it("counts consecutive failures and resets on a success", async () => {
    const fail = (reason: string) =>
      recordPaymentAttempt({
        orgId,
        customerId,
        amountCents: 6400,
        status: "failed",
        failureReason: reason,
      });
    await fail("card_declined");
    await fail("insufficient_funds");
    expect(await failedAttemptCount(customerId)).toBe(2);

    await recordPaymentAttempt({
      orgId,
      customerId,
      amountCents: 6400,
      status: "succeeded",
    });
    expect(await failedAttemptCount(customerId)).toBe(0);

    await fail("expired_card");
    expect(await failedAttemptCount(customerId)).toBe(1);
  });

  it("captures the failure reason on the recorded attempt", async () => {
    const c = await adminClient();
    const r = await c.query(
      `select failure_reason from public.payment_attempts
        where customer_id = $1 and status = 'failed'
        order by created_at desc limit 1`,
      [customerId],
    );
    await c.end();
    expect(r.rows[0].failure_reason).toBe("expired_card");
  });
});
