import { loginAction } from "@/lib/actions";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-extrabold text-oja-green-deep">
        Sign in to GAARII<span className="text-oja-orange">.</span>
      </h1>
      <form action={loginAction} className="flex flex-col gap-3">
        <input
          type="email"
          name="email"
          required
          placeholder="you@email.com"
          aria-label="Email address"
          className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
        />
        <input
          type="text"
          name="name"
          placeholder="Your name (optional)"
          aria-label="Your name"
          className="rounded-lg border border-oja-green/30 bg-white px-4 py-3"
        />
        <button
          type="submit"
          className="rounded-full bg-oja-orange px-6 py-3 font-bold text-white"
        >
          Continue
        </button>
      </form>
      <p className="text-sm text-oja-green-deep/60">
        Dev sign-in for the MVP scaffold — email OTP replaces this before pilot.
      </p>
    </main>
  );
}
