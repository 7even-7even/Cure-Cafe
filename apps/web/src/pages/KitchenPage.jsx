import { useState } from 'react';
import DataState from '../components/DataState';
import Badge from '../components/Badge';
import { useKitchenDashboardQuery } from '../services/api';
import { humanize } from '../utils/format';

export default function KitchenPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mealType, setMealType] = useState('');
  const { data, isLoading, error } = useKitchenDashboardQuery({ date, mealType: mealType || undefined });
  const dashboard = data?.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Kitchen Dashboard</h2>
        <p className="text-sm text-slate-500">Ward-wise distribution, diet-wise quantities and special meal requirements.</p>
      </div>
      <section className="card p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <label><span className="label">Date</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label><span className="label">Meal type</span><select className="input" value={mealType} onChange={(e) => setMealType(e.target.value)}><option value="">All meals</option><option>BREAKFAST</option><option>LUNCH</option><option>EVENING_SNACKS</option><option>DINNER</option></select></label>
          <div className="rounded-2xl bg-brand-50 p-4"><p className="label">Total meals</p><p className="text-3xl font-black text-brand-700">{dashboard?.totalMeals ?? '—'}</p></div>
        </div>
      </section>
      <DataState isLoading={isLoading} error={error}>
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="card p-5">
            <h3 className="text-lg font-black text-slate-900">Diet-wise preparation</h3>
            <div className="mt-4 space-y-3">
              {(dashboard?.byDiet || []).map((diet) => <div key={diet.dietType} className="rounded-2xl border border-slate-100 p-4"><div className="flex items-center justify-between"><p className="font-bold text-slate-900">{humanize(diet.dietType)}</p><span className="text-2xl font-black text-brand-700">{diet.total}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-3">{diet.wards.map((w) => <div key={w.ward} className="rounded-xl bg-slate-50 p-3 text-sm"><span className="font-bold">{w.ward}</span> → {w.count} meals</div>)}</div></div>)}
            </div>
          </section>
          <section className="card p-5">
            <h3 className="text-lg font-black text-slate-900">Status counts</h3>
            <div className="mt-4 flex flex-wrap gap-2">{Object.entries(dashboard?.statusCounts || {}).map(([status, count]) => <span key={status} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold"><Badge value={status} /> <span className="ml-2">{count}</span></span>)}</div>
            <h3 className="mt-6 text-lg font-black text-slate-900">Ward-wise distribution</h3>
            <div className="mt-3 space-y-2">{(dashboard?.byWard || []).map((w) => <div key={w.ward} className="rounded-2xl bg-slate-50 p-3"><p className="font-bold text-slate-900">{w.ward}: {w.total}</p><p className="text-xs text-slate-500">{Object.entries(w.mealTypes).map(([m,c]) => `${humanize(m)} ${c}`).join(' · ')}</p></div>)}</div>
          </section>
          <section className="card p-5 xl:col-span-2">
            <h3 className="text-lg font-black text-slate-900">Special meals</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm"><thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">Patient</th><th>Meal</th><th>Diet</th><th>Location</th><th>Instructions</th><th>Status</th></tr></thead><tbody className="divide-y divide-slate-100">{(dashboard?.specialMeals || []).map((meal) => <tr key={meal.orderId} className="text-slate-700"><td className="py-3 font-semibold">{meal.patientName}</td><td>{humanize(meal.mealType)}</td><td>{humanize(meal.dietType)}</td><td>{meal.ward} {meal.roomNumber}/{meal.bedNumber}</td><td className="max-w-xl text-xs">{meal.specialInstructions}</td><td><Badge value={meal.status} /></td></tr>)}</tbody></table>
            </div>
          </section>
        </div>
      </DataState>
    </div>
  );
}
