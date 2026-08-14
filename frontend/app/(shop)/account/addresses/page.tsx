import { AlertCircleIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { AddressManager } from "@/components/shop/account/address-manager";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchAddresses } from "@/lib/account";
import { getSessionToken } from "@/lib/session";

export const metadata = { title: "My address — Aroma Beauty Herbs" };

export default async function AccountAddressesPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const result = await fetchAddresses(token);

  if (!result.ok) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertDescription>{result.error}</AlertDescription>
      </Alert>
    );
  }

  return <AddressManager addresses={result.data.addresses} />;
}
