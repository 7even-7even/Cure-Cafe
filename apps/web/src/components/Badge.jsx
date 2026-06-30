import { humanize } from '../utils/format';

export default function Badge({ value }) {
  const map = {
    DELIVERED: 'bg-emerald-100 text-emerald-700',
    PACKED: 'bg-blue-100 text-blue-700',
    PREPARED: 'bg-cyan-100 text-cyan-700',
    DISPATCHED: 'bg-purple-100 text-purple-700',
    SCHEDULED: 'bg-slate-100 text-slate-700',
    CANCELLED: 'bg-rose-100 text-rose-700',
    PENDING: 'bg-amber-100 text-amber-700',
    APPROVED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-rose-100 text-rose-700',
    POSTED: 'bg-blue-100 text-blue-700',
    PAID: 'bg-emerald-100 text-emerald-700'
  };
  return <span className={`badge ${map[value] || 'bg-slate-100 text-slate-700'}`}>{humanize(value)}</span>;
}
