import { cookies } from "next/headers";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requireAdminUser } from "@/lib/admin";
import { logoutAction } from "@/lib/auth-actions";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdminUser();

  // The sidebar writes its open/closed state to a cookie; reading it here keeps
  // the server render matching what the user last chose.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    // Collapsed sidebar items show tooltips, which need a provider above them.
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AdminSidebar email={user.email} />

        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 h-4" />

            <form action={logoutAction} className="ml-auto">
              <Button type="submit" variant="outline" size="sm">
                Log out
              </Button>
            </form>
          </header>

          {/* A div, not a main: SidebarInset already renders the <main> for
              this pane, and nesting a second landmark is invalid HTML. */}
          <div className="flex-1 p-4 sm:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}