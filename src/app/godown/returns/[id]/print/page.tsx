import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { UserRole } from "@prisma/client";
import { returnsService } from "@/modules/returns/returns.service";
import { settingsService } from "@/modules/settings/settings.service";
import { DebitNotePrintViewer } from "./debit-note-print-viewer";

interface PrintPageProps {
  params: { id: string };
  searchParams: { autoprint?: string };
}

export const dynamic = "force-dynamic";

export default async function DebitNotePrintPage({
  params,
  searchParams,
}: PrintPageProps) {
  const session = await auth();
  const role = session?.user?.role || UserRole.SUPER_ADMIN;

  const debitNote = await returnsService.getDebitNoteById(role, params.id);
  if (!debitNote) {
    notFound();
  }

  const business = await settingsService.getBusinessDetails();
  const shouldAutoPrint = searchParams.autoprint === "1" || searchParams.autoprint === "true";

  return (
    <DebitNotePrintViewer
      debitNote={debitNote}
      business={business}
      autoPrint={shouldAutoPrint}
    />
  );
}
