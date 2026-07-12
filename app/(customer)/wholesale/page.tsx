import { wholesaleAction } from "@/lib/actions";
import {
  Button,
  Card,
  Input,
  PageMain,
  PageTitle,
  Select,
  Textarea,
} from "@/components/ui";

export const metadata = { title: "Wholesale waitlist" };

export default async function WholesalePage({
  searchParams,
}: {
  searchParams: Promise<{ joined?: string }>;
}) {
  const { joined } = await searchParams;
  return (
    <PageMain width="xl">
      <PageTitle className="mb-2">Wholesale waitlist</PageTitle>
      <p className="mb-8 text-oja-green-deep/70">
        The MVP is a household subscription only. Wholesale supply for stores
        and restaurants opens in a later phase — join the waitlist and
        we&apos;ll contact you first.
      </p>
      {joined ? (
        <Card className="font-bold text-oja-green">
          You&apos;re on the list — we&apos;ll be in touch when wholesale opens.
          ✓
        </Card>
      ) : (
        <form action={wholesaleAction} className="flex flex-col gap-3">
          <Input
            name="businessName"
            required
            placeholder="Business name"
            aria-label="Business name"
          />
          <Input
            name="email"
            type="email"
            required
            placeholder="Business email"
            aria-label="Business email"
          />
          <Select name="businessType" aria-label="Business type">
            <option value="store">Grocery store</option>
            <option value="restaurant">Restaurant</option>
            <option value="caterer">Caterer</option>
            <option value="other">Other</option>
          </Select>
          <Textarea
            name="message"
            aria-label="Message"
            placeholder="Anything we should know? (optional)"
            rows={3}
          />
          <Button type="submit">Join the wholesale waitlist</Button>
        </form>
      )}
    </PageMain>
  );
}
