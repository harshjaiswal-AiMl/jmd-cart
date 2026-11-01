import { redirect } from "next/navigation";

interface InvoiceEditPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function InvoiceEditPage({ params }: InvoiceEditPageProps) {
  const { id } = await params;
  redirect(`/shop/pos?edit=${id}`);
}
