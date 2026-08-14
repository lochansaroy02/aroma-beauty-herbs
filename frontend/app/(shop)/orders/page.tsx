import { redirect } from "next/navigation";

/**
 * The order list now lives inside the account area, so it keeps the sidebar
 * that Dashboard, My address and Settings share.
 *
 * This route stays as a redirect rather than being deleted: it is linked from
 * the contact page and from every order's detail page, and those links are also
 * in customers' history and inboxes.
 */
export default function OrdersPage() {
  redirect("/account/orders");
}
