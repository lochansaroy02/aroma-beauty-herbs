import { AlertCircleIcon, InboxIcon, MailIcon, PhoneIcon } from "lucide-react";

import { ContactFilters } from "@/components/admin/contact-filters";
import {
  ContactDeleteButton,
  ContactStatusSelect,
} from "@/components/admin/contact-row-actions";
import { Pagination } from "@/components/admin/pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildContactQuery, fetchContactMessages } from "@/lib/admin-contact";
import { CONTACT_PAGE_SIZES, CONTACT_SORTS } from "@/lib/catalog";

export const metadata = { title: "Contact queries — Aroma Admin" };

/**
 * Date and time both matter here: two enquiries the same afternoon are a
 * different situation from two a week apart, and "when did this come in" is the
 * first thing anyone asks about a complaint.
 */
const TIMESTAMP = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AdminQueriesPage(props: PageProps<"/admin/queries">) {
  const params = await props.searchParams;

  const search = single(params["search"]).trim();
  const status = single(params["status"]);
  const sortParam = single(params["sort"]);
  const sort = CONTACT_SORTS.some((option) => option.value === sortParam)
    ? sortParam
    : "newest";
  const limitParam = Number(single(params["limit"]));
  const limit = (CONTACT_PAGE_SIZES as readonly number[]).includes(limitParam)
    ? limitParam
    : 50;
  const page = Math.max(1, Number(single(params["page"])) || 1);

  const result = await fetchContactMessages({
    page,
    limit,
    search: search || undefined,
    status: status || undefined,
    sort,
  });

  // Carried onto the page links, minus `page` itself.
  const baseQuery = buildContactQuery({ search, status, sort, limit }).replace(/^\?/, "");

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-2xl tracking-tight">Contact queries</h1>
        <p className="text-sm text-muted-foreground">
          Everything sent through the storefront contact form, newest first.
        </p>
      </div>

      {!result.ok ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "All", value: result.data.counts.all },
              { label: "Pending", value: result.data.counts.pending },
              { label: "Working", value: result.data.counts.working },
              { label: "Completed", value: result.data.counts.completed },
            ].map((card) => (
              <Card key={card.label}>
                <CardContent>
                  <p className="text-2xl tabular-nums">{card.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{card.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/*
            min-w-0 is load-bearing. A grid item defaults to min-width:auto,
            which refuses to shrink below its content's intrinsic width — so the
            wide table below stretched this cell to ~1100px and dragged the whole
            admin shell into a sideways scroll, defeating the card's own
            overflow-x-auto. Zero here lets the card clip and scroll as intended.
          */}
          <div className="min-w-0">
            <ContactFilters search={search} status={status} sort={sort} limit={limit} />

            {result.data.messages.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <InboxIcon className="size-8 text-muted-foreground" />
                  <p className="font-heading text-lg">
                    {search || status ? "Nothing matches those filters" : "No enquiries yet"}
                  </p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {search || status
                      ? "Try a different search term, or clear the filters."
                      : "Messages sent through the contact page will appear here."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                {/*
                  The table is wide by nature — a message column can't be
                  usefully narrow — so it scrolls inside the card rather than
                  making the whole admin page scroll sideways.
                */}
                <CardContent className="overflow-x-auto p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact info</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead className="min-w-64">Message</TableHead>
                        <TableHead className="w-44">Status</TableHead>
                        <TableHead className="w-16 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {result.data.messages.map((message, index) => (
                        <TableRow key={message.id} className="align-top">
                          <TableCell className="text-muted-foreground tabular-nums">
                            {(page - 1) * limit + index + 1}
                          </TableCell>

                          <TableCell className="font-medium">{message.name}</TableCell>

                          <TableCell>
                            <div className="grid gap-1 text-sm">
                              <a
                                href={`mailto:${message.email}`}
                                className="flex items-center gap-1.5 hover:underline"
                              >
                                <MailIcon className="size-3.5 shrink-0 text-muted-foreground" />
                                {message.email}
                              </a>
                              {message.phone ? (
                                <a
                                  href={`tel:${message.phone}`}
                                  className="flex items-center gap-1.5 text-muted-foreground hover:underline"
                                >
                                  <PhoneIcon className="size-3.5 shrink-0" />
                                  {message.phone}
                                </a>
                              ) : null}
                            </div>
                          </TableCell>

                          <TableCell className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
                            {message.created_at
                              ? TIMESTAMP.format(new Date(message.created_at))
                              : "—"}
                          </TableCell>

                          <TableCell className="text-sm">
                            {message.subject || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-sm leading-relaxed text-muted-foreground">
                            {message.message}
                          </TableCell>

                          <TableCell>
                            <ContactStatusSelect message={message} />
                          </TableCell>

                          <TableCell className="text-right">
                            <ContactDeleteButton message={message} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>

          <Pagination
            page={result.data.pagination.page}
            totalPages={result.data.pagination.total_pages}
            total={result.data.pagination.total}
            showing={result.data.messages.length}
            baseQuery={baseQuery}
            basePath="/admin/queries"
            noun="enquiries"
            perPage={limit}
          />
        </>
      )}
    </div>
  );
}
