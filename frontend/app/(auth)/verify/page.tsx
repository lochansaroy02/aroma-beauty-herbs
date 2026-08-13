import { redirect } from "next/navigation";

import { VerifyForm } from "./verify-form";

export default async function VerifyPage(props: PageProps<"/verify">) {
  const { email } = await props.searchParams;

  // Nothing to verify without an address — start the sequence properly.
  if (typeof email !== "string" || !email) {
    redirect("/signup");
  }

  return <VerifyForm email={email} />;
}
