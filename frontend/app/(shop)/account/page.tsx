import { AlertCircleIcon, ShieldIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiGet } from "@/lib/api";
import { logoutAction } from "@/lib/auth-actions";
import { getSessionToken } from "@/lib/session";

type MeResponse = {
  user: {
    id: number;
    name: string | null;
    email: string;
    phone: string | null;
    role_as: string | null;
    created_at: string | null;
  };
};

export default async function AccountPage(props: PageProps<"/account">) {
  const { denied } = await props.searchParams;
  const token = await getSessionToken();
  if (!token) redirect("/login");

  // The proxy check is optimistic; this is the one that actually proves the
  // token is still valid.
  const result = await apiGet<MeResponse>("/auth/me", token);
  if (!result.ok) redirect("/login");

  const { user } = result.data;
  const rows = [
    ["Name", user.name ?? "—"],
    ["Email", user.email],
    ["Phone", user.phone ?? "—"],
    ["Account type", user.role_as ?? "Customer"],
  ] as const;

  return (
    // A div, not a main: the shop layout already supplies the page's <main>,
    // and nesting a second one is invalid.
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      {denied === "admin" ? (
        <Alert variant="destructive" className="mb-6" role="status">
          <AlertCircleIcon />
          <AlertDescription>That area is for admins only.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">
            {user.name ? `Hello, ${user.name.split(" ")[0]}` : "Hello"}
          </CardTitle>
          <CardDescription>
            Your email is verified — you&rsquo;re all set.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <dl className="grid gap-0">
            {rows.map(([label, value], index) => (
              <div key={label}>
                {index > 0 ? <Separator /> : null}
                <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-6">
                  <dt className="text-sm text-muted-foreground sm:w-40 sm:shrink-0">
                    {label}
                  </dt>
                  <dd className="text-sm">{value}</dd>
                </div>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {/* Base UI composes via `render`, not Radix's `asChild`. */}
            {user.role_as === "Admin" ? (
              <Button
                variant="secondary"
                nativeButton={false}
                render={<Link href="/admin" />}
              >
                <ShieldIcon />
                Go to admin
              </Button>
            ) : null}

            <form action={logoutAction}>
              <Button type="submit" variant="outline">
                Log out
              </Button>

              
            </form>

            
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
