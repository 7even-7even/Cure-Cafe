import { useState } from 'react';
import StatCard from '../components/StatCard';
import { useCreateFoodWastageMutation, useDailyMealsReportQuery, useDietDistributionQuery, useFoodWastageQuery, useInventoryConsumptionReportQuery, useMonthlyExpenditureQuery } from '../services/api';
import { apiError, humanize, money } from '../utils/format';
import { BarChart3, Coins, Trash2, Utensils } from 'lucide-react';

export default function ReportsPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { data: daily } = useDailyMealsReportQuery({ date });
  const { data: distribution } = useDietDistributionQuery();
  const { data: wastage } = useFoodWastageQuery({});
  const { data: consumption } = useInventoryConsumptionReportQuery({ from: date, to: date });
  const { data: monthly } = useMonthlyExpenditureQuery({ month });
  const [createWastage, wastageState] = useCreateFoodWastageMutation();
  const [form, setForm] = useState({ mealType: 'LUNCH', quantity: '1', unit: 'kg', reason: '', costEstimate: '0' });

  async function submit(e) {
    e.preventDefault();
    await createWastage({ ...form, quantity: Number(form.quantity), costEstimate: Number(form.costEstimate) }).unwrap();
  }

  const report = daily?.data?.report;
  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black text-slate-900">Reports and Analytics</h2><p className="text-sm text-slate-500">Daily meals, diet distribution, wastage, inventory consumption and monthly expenditure.</p></div>
      <section className="card grid gap-3 p-5 sm:grid-cols-2"><label><span className="label">Report date</span><input className="input" type="date" value={date} onChange={(e)=>setDate(e.target.value)} /></label><label><span className="label">Expenditure month</span><input className="input" type="month" value={month} onChange={(e)=>setMonth(e.target.value)} /></label></section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard title="Meals Generated" value={report?.total ?? '—'} subtitle={`Served ${report?.served ?? 0}`} icon={Utensils}/><StatCard title="Admitted Patients" value={distribution?.data?.totalAdmittedPatients ?? '—'} subtitle="For diet mix" icon={BarChart3} tone="green"/><StatCard title="Wastage Cost" value={money(wastage?.data?.summary?.totalCost || 0)} subtitle="Current range" icon={Trash2} tone="rose"/><StatCard title="Net Food Cost" value={money(monthly?.data?.netFoodCostEstimate || 0)} subtitle="Month estimate" icon={Coins} tone="purple"/></section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5"><h3 className="text-lg font-black text-slate-900">Diet-wise distribution</h3><div className="mt-4 space-y-2">{Object.entries(distribution?.data?.distribution || {}).map(([diet,count])=><div key={diet} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"><span className="font-bold">{humanize(diet)}</span><span className="text-xl font-black text-brand-700">{count}</span></div>)}</div></section>
        <section className="card p-5"><h3 className="text-lg font-black text-slate-900">Daily meals by status</h3><div className="mt-4 space-y-2">{Object.entries(report?.byStatus || {}).map(([status,count])=><div key={status} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"><span className="font-bold">{humanize(status)}</span><span className="text-xl font-black text-brand-700">{count}</span></div>)}</div></section>
        <section className="card p-5"><h3 className="text-lg font-black text-slate-900">Inventory consumption</h3><div className="mt-4 space-y-2">{(consumption?.data?.items || []).map((row)=><div key={row.itemId} className="rounded-2xl bg-slate-50 p-3"><p className="font-bold text-slate-900">{row.itemName}</p><p className="text-sm text-slate-500">{row.quantity} {row.unit} · {money(row.cost)}</p></div>)}</div></section>
        <form onSubmit={submit} className="card space-y-3 p-5"><h3 className="text-lg font-black text-slate-900">Record food wastage</h3><div className="grid grid-cols-2 gap-3"><label><span className="label">Meal</span><select className="input" value={form.mealType} onChange={(e)=>setForm({...form,mealType:e.target.value})}><option>BREAKFAST</option><option>LUNCH</option><option>EVENING_SNACKS</option><option>DINNER</option></select></label><label><span className="label">Quantity</span><input className="input" type="number" value={form.quantity} onChange={(e)=>setForm({...form,quantity:e.target.value})}/></label></div><div className="grid grid-cols-2 gap-3"><label><span className="label">Unit</span><input className="input" value={form.unit} onChange={(e)=>setForm({...form,unit:e.target.value})}/></label><label><span className="label">Cost estimate</span><input className="input" type="number" value={form.costEstimate} onChange={(e)=>setForm({...form,costEstimate:e.target.value})}/></label></div><label><span className="label">Reason</span><input className="input" value={form.reason} onChange={(e)=>setForm({...form,reason:e.target.value})}/></label>{wastageState.error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{apiError(wastageState.error)}</p>}<button className="btn-primary w-full">Record wastage</button></form>
      </div>
    </div>
  );
}
