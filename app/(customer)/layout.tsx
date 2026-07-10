import Link from "next/link";
import { currentAccount } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await currentAccount();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-oja-green/10 bg-oja-cream/90">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-extrabold text-oja-green-deep">
            GAARII<span className="text-oja-orange">.</span>
          </Link>
          <div className="flex items-center gap-5 text-sm font-medium">
            <Link href="/subscribe">Subscribe</Link>
            <Link href="/account">My pantry</Link>
            <Link href="/wholesale">Wholesale</Link>
            {account ? (
              <form action={logoutAction}>
                <button
                  className="text-oja-green-deep/60 underline"
                  type="submit"
                >
                  Sign out ({account.name})
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-oja-orange px-4 py-1.5 font-bold text-white"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}
