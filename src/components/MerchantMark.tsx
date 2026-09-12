import { useState } from 'react';
import { Bus, Coffee, Dumbbell, House, Landmark, Plane, ReceiptText, Repeat2, ShoppingBag, Store, Zap } from 'lucide-react';
import { merchantCategory, type Merchant, type MerchantCategory } from '@/lib/merchant-identity';

const icons = { groceries: Store, dining: Coffee, shopping: ShoppingBag, transport: Bus, travel: Plane,
  subscription: Repeat2, fitness: Dumbbell, utilities: Zap, income: Landmark, rent: House, other: ReceiptText };

function Mark({ merchant, category }: { merchant: Merchant | null; category: MerchantCategory }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const Icon = icons[category];
  return <span aria-hidden="true" data-merchant-id={merchant?.id || 'unknown'} data-logo-state={merchant ? status : 'fallback'}
    className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/50 text-foreground">
    <Icon className={`h-6 w-6 ${status === 'loaded' ? 'invisible' : ''}`} strokeWidth={1.8} />
    {merchant && status !== 'failed' && <img src={`${import.meta.env.BASE_URL}merchants/${merchant.asset}`} alt="" width={40} height={40}
      decoding="async" draggable={false} onLoad={() => setStatus('loaded')} onError={() => setStatus('failed')}
      className={`absolute inset-0 h-full w-full object-contain ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`} />}
  </span>;
}

/** Decorative beside a visible merchant name: no duplicate screen-reader label. */
export default function MerchantMark({ merchant, category }: { merchant: Merchant | null; category?: string | null }) {
  const supplied = merchantCategory(category);
  const fallback = supplied === 'other' && merchant ? merchantCategory(merchant.category) : supplied;
  // A changed merchant gets fresh image state after search, pagination or import.
  return <Mark key={merchant?.id || 'unknown'} merchant={merchant} category={fallback} />;
}
