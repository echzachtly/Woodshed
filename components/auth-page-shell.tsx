import Link from "next/link";

export function AuthPageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-stone-950 text-stone-50">
      <header className="border-b border-stone-800/55 bg-stone-950 px-4 py-3">
        <Link
          href="/"
          className="text-sm text-violet-300/90 transition-colors hover:text-violet-200"
        >
          ← Back to Woodshed
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-stone-100">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1.5 text-sm leading-relaxed text-stone-400">
                {subtitle}
              </p>
            ) : null}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
