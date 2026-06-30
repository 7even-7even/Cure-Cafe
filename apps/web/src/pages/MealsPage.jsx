import { useState } from 'react';
import { useSelector } from 'react-redux';
import DataState from '../components/DataState';
import Badge from '../components/Badge';
import { useGenerateMealsMutation, useMealOrdersQuery, useSchedulesQuery, useUpdateMealStatusMutation } from '../services/api';
import { ROLES, apiError, can, humanize, money, timeOnly } from '../utils/format';

function nextStatus(order, role) {
  if (role === ROLES.ADMIN) {
    return { SCHEDULED: 'PREPARED', PREPARED: 'PACKED', PACKED: 'DISPATCHED', DISPATCHED: 'DELIVERED' }[order.status];
  }
  if (role === ROLES.KITCHEN_STAFF) return { SCHEDULED: 'PREPARED', PREPARED: 'PACKED' }[order.status];
  if (role === ROLES.DELIVERY_STAFF) return { PACKED: 'DISPATCHED', DISPATCHED: 'DELIVERED' }[order.status];
  return null;
}

export default function MealsPage() {
  const user = useSelector((state) => state.auth.user);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('');
  const { data: schedules } = useSchedulesQuery();
  const { data, isLoading, error } = useMealOrdersQuery({ date, status: status || undefined, limit: 150 });
  const [generateMeals, genState] = useGenerateMealsMutation();
  const [updateStatus] = useUpdateMealStatusMutation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Meal Scheduling and Tracking</h2>
        <p className="text-sm text-slate-500">Generate daily breakfast, lunch, evening snacks and dinner orders; track prepared-to-delivered workflow.</p>
      </div>
      <section className="grid gap-4 md:grid-cols-4">
        {(schedules?.data?.items || []).map((s) => <div key={s.id} className="card p-4"><p className="font-black text-slate-900">{s.displayName}</p><p className="text-sm text-slate-500">Serve {s.serveTime} · Lead {s.preparationLeadMinutes}m</p></div>)}
      </section>
      <section className="card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="label">Service date</span><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label><span className="label">Status</span><select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{['SCHEDULED','PREPARED','PACKED','DISPATCHED','DELIVERED','CANCELLED'].map((s) => <option key={s}>{s}</option>)}</select></label>
          </div>
          {can(user, [ROLES.ADMIN, ROLES.DIETICIAN, ROLES.KITCHEN_STAFF]) && <button className="btn-primary" disabled={genState.isLoading} onClick={() => generateMeals({ date }).unwrap().catch(() => {})}>Generate missing orders</button>}
        </div>
        {genState.error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{apiError(genState.error)}</p>}
      </section>
      <DataState isLoading={isLoading} error={error}>
        <div className="card p-5">
          <h3 className="text-lg font-black text-slate-900">Meal orders</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">Patient</th><th>Meal</th><th>Diet</th><th>Location</th><th>Planned</th><th>Cost</th><th>Status</th><th></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.data?.items || []).map((order) => {
                  const next = nextStatus(order, user.role);
                  return (
                    <tr key={order.id} className="align-top text-slate-700">
                      <td className="py-3"><p className="font-bold text-slate-900">{order.patient?.name}</p><p className="max-w-xs text-xs text-slate-500">{order.specialInstructions || ''}</p></td>
                      <td>{humanize(order.mealType)}</td>
                      <td>{humanize(order.dietPlan?.dietType || 'NORMAL')}</td>
                      <td>{order.ward}<br /><span className="text-xs">{order.roomNumber}/{order.bedNumber}</span></td>
                      <td>{timeOnly(order.plannedFor)}</td>
                      <td>{money(order.cost)}</td>
                      <td><Badge value={order.status} /></td>
                      <td className="text-right">{next && <button className="btn-secondary" onClick={() => updateStatus({ id: order.id, status: next, note: `Updated from UI to ${next}` })}>{humanize(next)}</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </DataState>
    </div>
  );
}
