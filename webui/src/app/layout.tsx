import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ai-workspace",
  description: "Multi-repository workspace manager dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-56 shrink-0 border-r bg-card">
            <div className="sticky top-0 flex h-screen flex-col">
              <div className="border-b p-4">
                <Link href="/" className="text-lg font-bold">
                  ai-workspace
                </Link>
              </div>
              <nav className="flex-1 p-2">
                <Link
                  href="/"
                  className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
                >
                  Dashboard
                </Link>
                <Link
                  href="/new"
                  className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
                >
                  New Workspace
                </Link>
                <div>
                  <Link
                    href="/utilities"
                    className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
                  >
                    Utilities
                  </Link>
                  <div className="ml-3 border-l pl-2">
                    <Link
                      href="/utilities/workspace-prune"
                      className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      Workspace Prune
                    </Link>
                  </div>
                </div>
              </nav>
              <div className="border-t p-3 text-xs text-muted-foreground">
                localhost:3741
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-6xl p-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
