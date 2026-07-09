export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="rounded-full bg-oja-orange-soft px-4 py-1 text-xs font-bold tracking-widest text-oja-green-deep uppercase">
        App shell · under construction
      </span>
      <h1 className="text-4xl font-extrabold tracking-tight text-oja-green-deep">
        Oja<span className="text-oja-orange">.</span>
      </h1>
      <p className="max-w-md text-balance text-oja-green-deep/70">
        The AI-powered, just-in-time supply chain for authentic African raw
        foods. Customer, warehouse, and admin surfaces land here — see{" "}
        <code className="rounded bg-oja-orange-soft/50 px-1.5 py-0.5 text-sm">
          claude-fable-5/EXECUTION_PLAN.md
        </code>
        .
      </p>
    </main>
  );
}
