"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PlusCircle,
  Trash2,
  ArrowLeft,
  User,
  Package,
  CreditCard,
  MapPin,
  Calendar,
} from "lucide-react";
import { createManualOrderAction } from "../actions";

interface Props {
  parties: Array<{
    id: string;
    name: string;
    type: string;
    phone: string | null;
    address: string | null;
    creditEnabled: boolean;
    creditLimitPaise: number;
  }>;
  products: Array<{
    id: string;
    name: string;
    packSize: number;
    mrpPaise: number | null;
    priceAPaise: number | null;
    priceBPaise: number | null;
    priceCPaise: number | null;
  }>;
  deliveryStaff: Array<{ id: string; name: string }>;
  userRole: string;
}

interface OrderLineState {
  productId: string;
  cartons: number;
  loose: number;
  unitPricePaise: number;
}

export function NewOrderClient({ parties, products, deliveryStaff, userRole }: Props) {
  const router = useRouter();
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [contactPhone, setContactPhone] = useState<string>("");
  const [slot, setSlot] = useState<string>("Morning (9 AM - 1 PM)");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "CREDIT">("CASH");
  const [customerNotes, setCustomerNotes] = useState<string>("");
  const [assignedDeliveryUserId, setAssignedDeliveryUserId] = useState<string>("");

  const [lines, setLines] = useState<OrderLineState[]>([
    { productId: products[0]?.id || "", cartons: 1, loose: 0, unitPricePaise: 0 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedParty = parties.find((p) => p.id === selectedPartyId);

  const handlePartyChange = (partyId: string) => {
    setSelectedPartyId(partyId);
    const p = parties.find((party) => party.id === partyId);
    if (p) {
      if (p.address) setDeliveryAddress(p.address);
      if (p.phone) setContactPhone(p.phone);
    }
  };

  const getTierPriceForProduct = (prod: any, partyType?: string): number => {
    if (!prod) return 0;
    if (partyType === "WHOLESALER") {
      return prod.priceAPaise ?? prod.priceBPaise ?? prod.priceCPaise ?? prod.mrpPaise ?? 0;
    }
    if (partyType === "RETAILER") {
      return prod.priceBPaise ?? prod.priceCPaise ?? prod.mrpPaise ?? 0;
    }
    return prod.priceCPaise ?? prod.mrpPaise ?? 0;
  };

  const addLine = () => {
    if (products.length === 0) return;
    const defaultProd = products[0];
    const unitPrice = getTierPriceForProduct(defaultProd, selectedParty?.type);
    setLines([...lines, { productId: defaultProd.id, cartons: 1, loose: 0, unitPricePaise: unitPrice }]);
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, updates: Partial<OrderLineState>) => {
    setLines((prev) => {
      const next = [...prev];
      const updated = { ...next[idx], ...updates };

      if (updates.productId) {
        const p = products.find((prod) => prod.id === updates.productId);
        updated.unitPricePaise = getTierPriceForProduct(p, selectedParty?.type);
      }

      next[idx] = updated;
      return next;
    });
  };

  const totalPaise = lines.reduce((acc, l) => {
    const prod = products.find((p) => p.id === l.productId);
    const packSize = Math.max(1, prod?.packSize || 1);
    const totalPcs = l.cartons * packSize + l.loose;
    const price = l.unitPricePaise || getTierPriceForProduct(prod, selectedParty?.type);
    return acc + totalPcs * price;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartyId) {
      setErrorMessage("Please select a customer/party");
      return;
    }
    if (lines.length === 0) {
      setErrorMessage("Add at least one item to the order");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await createManualOrderAction({
      partyId: selectedPartyId,
      deliveryAddress,
      contactPhone,
      slot,
      paymentMode,
      customerNotes,
      assignedDeliveryUserId: assignedDeliveryUserId || undefined,
      lines: lines.map((l) => ({
        productId: l.productId,
        cartons: Number(l.cartons),
        loose: Number(l.loose),
      })),
    });

    setIsSubmitting(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      router.push("/godown/dispatch?tab=orders");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/godown/dispatch"
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Create Order on Behalf of Party (Manual Order)
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Prices automatically resolve to the party&apos;s A/B/C tier. Stock is reserved immediately per Section 5b.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm font-medium text-red-800">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Party Selection Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <User className="h-4 w-4 text-maroon-800" />
            1. Party / Customer Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Select Party *</label>
              <select
                value={selectedPartyId}
                onChange={(e) => handlePartyChange(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-maroon-600 focus:outline-none"
              >
                <option value="">-- Choose Party / Customer --</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type}) {p.phone ? `· ${p.phone}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedParty && (
              <div className="p-3 bg-gray-50 rounded-md border border-gray-200 text-xs space-y-1">
                <div>
                  <span className="font-semibold text-gray-700">Buyer Tier:</span>{" "}
                  <span className="font-bold text-maroon-800">
                    Tier {selectedParty.type === "WHOLESALER" ? "A" : selectedParty.type === "RETAILER" ? "B" : "C"} ({selectedParty.type})
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Credit Enabled:</span>{" "}
                  {selectedParty.creditEnabled ? "Yes" : "No"} | Limit: ₹{(selectedParty.creditLimitPaise / 100).toFixed(2)}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Delivery Address *</label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                required
                placeholder="e.g. Ward 4, Saharsa"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-maroon-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Phone *</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                required
                placeholder="e.g. 9876543210"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-maroon-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Product Items Table */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Package className="h-4 w-4 text-maroon-800" />
              2. Order Items
            </h2>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-maroon-800 hover:text-maroon-900"
            >
              <PlusCircle className="h-4 w-4" />
              + Add Line
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => {
              const prod = products.find((p) => p.id === line.productId);
              const packSize = Math.max(1, prod?.packSize || 1);
              const totalPcs = line.cartons * packSize + line.loose;
              const unitPrice = line.unitPricePaise || getTierPriceForProduct(prod, selectedParty?.type);
              const lineTotal = (totalPcs * unitPrice) / 100;

              return (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm"
                >
                  <div className="flex-1 w-full sm:w-auto">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Product</label>
                    <select
                      value={line.productId}
                      onChange={(e) => updateLine(idx, { productId: e.target.value })}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.packSize} pcs/ctn)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Cartons</label>
                    <input
                      type="number"
                      min="0"
                      value={line.cartons}
                      onChange={(e) => updateLine(idx, { cartons: parseInt(e.target.value) || 0 })}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs text-right focus:outline-none"
                    />
                  </div>

                  <div className="w-24">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Loose Pcs</label>
                    <input
                      type="number"
                      min="0"
                      value={line.loose}
                      onChange={(e) => updateLine(idx, { loose: parseInt(e.target.value) || 0 })}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs text-right focus:outline-none"
                    />
                  </div>

                  <div className="w-28 text-right">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Tier Rate</label>
                    <div className="text-xs font-semibold text-gray-700 py-1.5">
                      ₹{(unitPrice / 100).toFixed(2)}/pc
                    </div>
                  </div>

                  <div className="w-28 text-right">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Total</label>
                    <div className="text-xs font-bold text-gray-900 py-1.5">
                      ₹{lineTotal.toFixed(2)}
                    </div>
                  </div>

                  <div className="pt-4 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length === 1}
                      className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-200">
            <div className="text-right">
              <span className="text-xs text-gray-500 mr-3">Order Total:</span>
              <span className="text-xl font-bold text-gray-900">₹{(totalPaise / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment & Delivery Options */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-maroon-800" />
            3. Payment &amp; Fulfilment Settings
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Mode *</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-maroon-600 focus:outline-none"
              >
                <option value="CASH">Cash on Delivery</option>
                <option value="UPI">UPI</option>
                <option value="CREDIT">Party Credit (Approved Limit)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Delivery Time Slot</label>
              <input
                type="text"
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-maroon-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Assign Delivery Staff</label>
              <select
                value={assignedDeliveryUserId}
                onChange={(e) => setAssignedDeliveryUserId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-maroon-600 focus:outline-none"
              >
                <option value="">-- Assign Later --</option>
                {deliveryStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Order Notes</label>
            <textarea
              rows={2}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="e.g. Call before delivery"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-maroon-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/godown/dispatch"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-orange-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-orange-700 disabled:opacity-50 transition"
          >
            {isSubmitting ? "Creating Order..." : "Confirm & Create Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
