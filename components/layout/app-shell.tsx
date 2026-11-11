import { NoticeProvider } from "@/components/feedback/notice";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";

export function AppShell({
  children,
  showLogout = false,
}: {
  children: React.ReactNode;
  showLogout?: boolean;
}) {
  return (
    <NoticeProvider>
      <div className="flex flex-1">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
        >
          Skip to content
        </a>

        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
          <AppSidebar />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader showLogout={showLogout} />
          <main
            id="main-content"
            className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8"
          >
            {children}
          </main>
        </div>
      </div>
    </NoticeProvider>
  );
}
