import { AlertCircleIcon } from "lucide-react";

import { CouponManager } from "@/components/admin/coupon-manager";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchCoupons } from "@/lib/admin-coupons";

export const metadata = { title: "Coupons — Aroma Admin" };

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AdminCouponsPage(props: PageProps<"/admin/coupons">) {
  const params = await props.searchParams;

  const search = single(params["search"]).trim();
  const page = Math.max(1, Number(single(params["page"])) || 1);

  const result = await fetchCoupons({ page, search: search || undefined });

  if (!result.ok) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertDescription>{result.error}</AlertDescription>
      </Alert>
    );
  }

  return <CouponManager coupons={result.data.coupons} />;
}
