import { useState } from 'react';
import DataState from '../components/DataState';
import Badge from '../components/Badge';
import { useMealOrdersQuery, useUpdateMealStatusMutation } from '../services/api';
import { humanize, timeOnly } from '../utils/format';

export default function DeliveriesPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('PACKED');
  const { data, isLoading, error } = useMealOrdersQuery({ date, status: status || undefined, limit: 150 });
  const [updateStatus] = useUpdateMealStatusMutation();

  function action(order) {
    if (order.status === 'PACKED') return 'DISPATCHED';
    if (order.status === 'DISPATCHED') return 'DELIVERED';
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Meal Delivery Tracking</h2>
        <p className="text-sm text-slate-500">Delivery staff can dispatch and deliver packed meals with delivery timestamps.</p>
      </div>
      <section className="card grid gap-3 p-5 sm:grid-cols-3">
        <label><span className="label">Date</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label><span className="label">Status</span><select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="PACKED">Packed</option><option value="DISPATCHED">Dispatched</option><option value="DELIVERED">Delivered</option><option value="">All</option></select></label>
      </section>
      <DataState isLoading={isLoading} error={error}>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data?.data?.items || []).map((order) => {
            const next = action(order);
            return <div key={order.id} className="card p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{order.patient?.name}</p><p className="text-sm text-slate-500">{humanize(order.mealType)} · {humanize(order.dietPlan?.dietType || 'NORMAL')}</p></div><Badge value={order.status} /></div><div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600"><p><b>Location:</b> {order.ward}, Room {order.roomNumber}, Bed {order.bedNumber}</p><p><b>Planned:</b> {timeOnly(order.plannedFor)}</p><p><b>Special:</b> {order.specialInstructions || '-'}</p></div>{next && <button className="btn-primary mt-4 w-full" onClick={() => updateStatus({ id: order.id, status: next, note: `Delivery update: ${next}` })}>{humanize(next)}</button>}</div>;
          })}
        </section>
      </DataState>
    </div>
  );
}
