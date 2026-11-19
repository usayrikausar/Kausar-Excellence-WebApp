"use client";

import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_SUGGESTIONS, PROMOTION_SUGGESTIONS } from "@/lib/sale-details";

/**
 * Products (one line each, "+ Add product" for another) and promotion for a
 * Perancangan case — for analysis only, so no amount per product. Shared by
 * the Sales form, the prospect "Close & record" dialog and Log activity.
 */
export function ProductPromoFields({
  idPrefix,
  products,
  onProductsChange,
  promotion,
  onPromotionChange,
}: {
  idPrefix: string;
  products: string[];
  onProductsChange: (v: string[]) => void;
  promotion: string;
  onPromotionChange: (v: string) => void;
}) {
  const lines = products.length ? products : [""];
  const setLine = (i: number, v: string) => onProductsChange(lines.map((x, j) => (j === i ? v : x)));

  return (
    <div className="space-y-4">
      <datalist id={`${idPrefix}-product-list`}>
        {PRODUCT_SUGGESTIONS.map((p) => <option key={p} value={p} />)}
      </datalist>
      <datalist id={`${idPrefix}-promo-list`}>
        {PROMOTION_SUGGESTIONS.map((p) => <option key={p} value={p} />)}
      </datalist>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-product-0`}>Products in this plan</Label>
        {lines.map((value, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              id={`${idPrefix}-product-${i}`}
              list={`${idPrefix}-product-list`}
              value={value}
              onChange={(e) => setLine(i, e.target.value)}
              placeholder={i === 0 ? "e.g. Hibah Komprehensif Hartanah" : "Another product"}
              autoComplete="off"
            />
            {lines.length > 1 && (
              <button
                type="button"
                onClick={() => onProductsChange(lines.filter((_, j) => j !== i))}
                aria-label={`Remove product ${i + 1}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onProductsChange([...lines, ""])}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add product
        </button>
        <p className="text-xs text-muted-foreground">For analysis only: just name each product, no need to split the amount.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-promotion`}>Promotion (if any)</Label>
        <Input
          id={`${idPrefix}-promotion`}
          list={`${idPrefix}-promo-list`}
          value={promotion}
          onChange={(e) => onPromotionChange(e.target.value)}
          placeholder="e.g. Promosi HK 45%. Leave blank if none."
          autoComplete="off"
        />
      </div>
    </div>
  );
}

/** "Deposit paid" — saved as a collection against the case, so it counts toward Collection. */
export function DepositField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Deposit paid (RM, optional)</Label>
      <Input id={id} type="number" min={0} step="0.01" value={value} onChange={(e) => onChange(e.target.value)} />
      <p className="text-xs text-muted-foreground">Counted as collection for this case. Record later payments under Payment received.</p>
    </div>
  );
}
