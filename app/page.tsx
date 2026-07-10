import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-24 text-center">
      <span className="rounded-full bg-oja-orange-soft px-4 py-1 text-xs font-bold tracking-widest text-oja-green-deep uppercase">
        America&apos;s first premium Garri subscription
      </span>
      <h1 className="text-5xl font-extrabold tracking-tight text-oja-green-deep">
        GAARII<span className="text-oja-orange">.</span>
      </h1>
      <p className="max-w-md text-balance text-oja-green-deep/70">
        Premium Nigerian garri — White (Ijebu) or Yellow — delivered monthly,
        nationwide. Pause, skip, or cancel anytime. Never run out again.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/subscribe"
          className="rounded-full bg-oja-orange px-8 py-3 font-bold text-white"
        >
          Choose your Garri plan
        </Link>
        <Link
          href="/login"
          className="rounded-full border-2 border-oja-green px-8 py-3 font-bold text-oja-green"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
