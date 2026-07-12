import Link from "next/link";
import { Badge, PageTitle, buttonClasses } from "@/components/ui";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-24 text-center">
      <Badge variant="eyebrow" className="px-4 py-1">
        America&apos;s first premium Garri subscription
      </Badge>
      <PageTitle size="hero">
        GAARII<span className="text-oja-orange">.</span>
      </PageTitle>
      <p className="max-w-md text-balance text-oja-green-deep/70">
        Premium Nigerian garri — White (Ijebu) or Yellow — delivered monthly,
        nationwide. Pause, skip, or cancel anytime. Never run out again.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/subscribe" className={buttonClasses("primary", "md")}>
          Choose your Garri plan
        </Link>
        <Link href="/login" className={buttonClasses("secondary", "md")}>
          Sign in
        </Link>
      </div>
    </main>
  );
}
