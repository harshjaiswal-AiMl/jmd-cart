import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { billingService } from "@/modules/billing/billing.service";
import { UserRole, InvoiceStatus } from "@prisma/client";
import { InvoiceEditClient } from "./invoice-edit-client";

interface InvoiceEditPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function InvoiceEditPage({ params }: InvoiceEditPageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.role) {
    redirect("/login");
  }

  const role = session.user.role as UserRole;
  const allowedRoles: UserRole[] = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ACCOUNTS,
    UserRole.SHOP,
  ];

  if (!allowedRoles.includes(role)) {
    redirect(`/shop/invoices/${id}`);
  }

  const invoice = await billingService.getInvoiceById(id);
  if (!invoice) {
    notFound();
  }

  if (invoice.status === InvoiceStatus.CANCELLED) {
    redirect(`/shop/invoices/${id}`);
  }

  // Fetch products and parties for autocomplete
  const [products, parties] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        shortCode: true,
        weight: true,
        weightValue: true,
        weightUnit: true,
        bagSize: true,
        mrpPaise: true,
        priceAPaise: true,
        priceBPaise: true,
        priceCPaise: true,
        packSize: true,
        packLabel: true,
        gstRateBp: true,
        hsn: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.party.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        creditLimitPaise: true,
      },
      orderBy: { name: "asc" },
    }).then((list) =>
      list.map((p) => ({
        ...p,
        phone: p.phone || "",
      }))
    ),
  ]);

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6">
      <InvoiceEditClient
        invoice={invoice}
        products={products}
        parties={parties}
        userRole={role}
        userName={session.user.name || "User"}
      />
    </div>
  );
}
