import { useState } from 'react';
import { useSelector } from 'react-redux';
import DataState from '../components/DataState';
import { useCreateFeedbackMutation, useFeedbackQuery, useFeedbackSummaryQuery, useMealOrdersQuery } from '../services/api';
import { ROLES, apiError, humanize } from '../utils/format';

export default function FeedbackPage() {
  const user = useSelector((state) => state.auth.user);
  const { data, isLoading, error } = useFeedbackQuery({ limit: 100 });
  const { data: summary } = useFeedbackSummaryQuery();
  const { data: meals } = useMealOrdersQuery({ status: 'DELIVERED', limit: 50 });
  const [createFeedback, createState] = useCreateFeedbackMutation();
  const [form, setForm] = useState({ mealOrderId: '', taste: '5', quality: '5', quantity: '5', timing: '5', comments: '' });

  async function submit(e) {
    e.preventDefault();
    await createFeedback({
      patientId: user?.patientProfile?.id,
      mealOrderId: form.mealOrderId || undefined,
      taste: Number(form.taste),
      quality: Number(form.quality),
      quantity: Number(form.quantity),
      timing: Number(form.timing),
      comments: form.comments
    }).unwrap();
    setForm({ ...form, comments: '' });
  }

  const averages = summary?.data?.averages || {};
  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black text-slate-900">Patient Feedback System</h2><p className="text-sm text-slate-500">Patients rate taste, quality, quantity and delivery timing.</p></div>
      <section className="grid gap-4 md:grid-cols-4">{['taste','quality','quantity','timing'].map((key)=><div key={key} className="card p-5"><p className="label">Average {key}</p><p className="text-3xl font-black text-brand-700">{Number(averages[key] || 0).toFixed(1)}</p></div>)}</section>
      {user?.role === ROLES.PATIENT && <form onSubmit={submit} className="card space-y-4 p-5"><h3 className="text-lg font-black text-slate-900">Submit feedback</h3><label><span className="label">Delivered meal</span><select className="input" value={form.mealOrderId} onChange={(e)=>setForm({...form,mealOrderId:e.target.value})}><option value="">General feedback</option>{(meals?.data?.items || []).map((m)=><option key={m.id} value={m.id}>{humanize(m.mealType)} · {new Date(m.plannedFor).toLocaleString()}</option>)}</select></label><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{['taste','quality','quantity','timing'].map((key)=><label key={key}><span className="label">{key}</span><select className="input" value={form[key]} onChange={(e)=>setForm({...form,[key]:e.target.value})}>{[1,2,3,4,5].map((n)=><option key={n}>{n}</option>)}</select></label>)}</div><label><span className="label">Comments</span><textarea className="input min-h-20" value={form.comments} onChange={(e)=>setForm({...form,comments:e.target.value})}/></label>{createState.error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{apiError(createState.error)}</p>}<button className="btn-primary w-full">Submit feedback</button></form>}
      <DataState isLoading={isLoading} error={error}><section className="card p-5"><h3 className="text-lg font-black text-slate-900">Feedback entries</h3><div className="mt-4 space-y-3">{(data?.data?.items || []).map((f)=><div key={f.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold text-slate-900">{f.patient?.name}</p><p className="text-sm text-slate-500">Taste {f.taste} · Quality {f.quality} · Quantity {f.quantity} · Timing {f.timing}</p></div><p className="mt-2 text-sm text-slate-600">{f.comments || '-'}</p></div>)}</div></section></DataState>
    </div>
  );
}
