import { CheckCircle2 } from 'lucide-react';
import { humanize } from '../utils/format';

const STEPS = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function OrderTracker({ status }) {
  const activeIndex = STEPS.indexOf(status);
  const cancelled = status === 'CANCELLED';

  if (cancelled) {
    return <div className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">Order cancelled</div>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-6">
      {STEPS.map((step, index) => {
        const done = index <= activeIndex;
        return (
          <div key={step} className={`rounded-2xl border p-3 text-xs ${done ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-400'}`}>
            <CheckCircle2 size={16} className={done ? 'text-emerald-600' : 'text-slate-300'} />
            <p className="mt-2 font-black leading-tight">{humanize(step)}</p>
          </div>
        );
      })}
    </div>
  );
}
