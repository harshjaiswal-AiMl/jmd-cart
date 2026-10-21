export function TrustRegionalStrip() {
  return (
    <section className="w-full bg-surface-container-low px-4 lg:px-8 py-3.5 shadow-xs border-b border-surface-container-high/60">
      <div className="max-w-[1280px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-6 text-on-surface">
        <div className="flex items-center gap-2.5 p-1.5">
          <span className="material-symbols-outlined text-secondary text-[22px] flex-shrink-0">
            local_shipping
          </span>
          <div className="min-w-0">
            <p className="font-bold text-xs truncate">Free Delivery &gt; ₹2,000</p>
            <p className="text-[11px] text-on-surface-variant truncate">All 40 Wards in Saharsa Town</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-1.5">
          <span className="material-symbols-outlined text-tertiary text-[22px] flex-shrink-0">
            verified
          </span>
          <div className="min-w-0">
            <p className="font-bold text-xs truncate">100% Genuine FMCG</p>
            <p className="text-[11px] text-on-surface-variant truncate">MDH, Bikaji, Dawat, Saloni</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-1.5">
          <span className="material-symbols-outlined text-primary text-[22px] flex-shrink-0">
            receipt_long
          </span>
          <div className="min-w-0">
            <p className="font-bold text-xs truncate">Input GST Invoicing</p>
            <p className="text-[11px] text-on-surface-variant truncate">B2B Kirana & Hotel Bills</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-1.5">
          <span className="material-symbols-outlined text-secondary text-[22px] flex-shrink-0">
            schedule
          </span>
          <div className="min-w-0">
            <p className="font-bold text-xs truncate">Order by 4:00 PM</p>
            <p className="text-[11px] text-on-surface-variant truncate">Guaranteed Same-Day Dispatch</p>
          </div>
        </div>
      </div>
    </section>
  );
}
