import { useState } from 'react';
import { useSelector } from 'react-redux';
import DataState from '../components/DataState';
import Badge from '../components/Badge';
import { useBillingChargesQuery, useBillingSummaryQuery, useCreateBillingChargeMutation, usePatientsQuery, useUpdateBillingStatusMutation } from '../services/api';
import { ROLES, apiError, can, dateOnly, money } from '../utils/format';

export default function BillingPage() {
  const user = useSelector((state) => state.auth.user);
  const canManage = can(user, [ROLES.ADMIN, ROLES.DIETICIAN]);
  const [patientId, setPatientId] = useState(user?.patientProfile?.id || '');
  const { data: patients } = usePatientsQuery({ limit: 100 }, { skip: !canManage });
  const effectivePatientId = user.role === ROLES.PATIENT ? user?.patientProfile?.id : patientId;
  const { data, isLoading, error } = useBillingChargesQuery({ patientId: effectivePatientId || undefined, limit: 100 });
  const { data: summary } = useBillingSummaryQuery(effectivePatientId, { skip: !effectivePatientId });
  const [createCharge, chargeState] = useCreateBillingChargeMutation();
  const [updateStatus] = useUpdateBillingStatusMutation();
  const [form, setForm] = useState({ description: 'Manual meal charge', amount: '100' });

  async function submit(e) {
    e.preventDefault();
    await createCharge({ patientId, description: form.description, amount: Number(form.amount), status: 'POSTED' }).unwrap();
  }

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black text-slate-900">Billing Module</h2><p className="text-sm text-slate-500">Include meal charges in the hospital bill with plan-specific costs.</p></div>
      <section className="grid gap-6 xl:grid-cols-3">
        <div className="card p-5"><p className="label">Total charges</p><p className="mt-2 text-3xl font-black text-slate-900">{money(summary?.data?.summary?.total || data?.data?.items?.reduce((s,c)=>s+c.amount,0) || 0)}</p></div>
        <div className="card p-5 xl:col-span-2"><label><span className="label">Patient filter</span><select className="input" disabled={!canManage} value={effectivePatientId || ''} onChange={(e) => setPatientId(e.target.value)}><option value="">All visible patients</option>{(patients?.data?.items || []).map((p) => <option key={p.id} value={p.id}>{p.name} - {p.mrn}</option>)}</select></label></div>
      </section>
      {canManage && <form onSubmit={submit} className="card grid gap-3 p-5 md:grid-cols-[1fr_1fr_160px_auto]"><label><span className="label">Patient</span><select className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)} required><option value="">Select patient</option>{(patients?.data?.items || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label><span className="label">Description</span><input className="input" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></label><label><span className="label">Amount</span><input className="input" type="number" value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})}/></label><button className="btn-primary self-end">Add charge</button>{chargeState.error && <p className="md:col-span-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{apiError(chargeState.error)}</p>}</form>}
      <DataState isLoading={isLoading} error={error}><section className="card p-5"><h3 className="text-lg font-black text-slate-900">Charges</h3><div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">Date</th><th>Patient</th><th>Description</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody className="divide-y divide-slate-100">{(data?.data?.items || []).map((c)=><tr key={c.id} className="text-slate-700"><td className="py-3">{dateOnly(c.chargeDate)}</td><td className="font-semibold">{c.patient?.name}</td><td>{c.description}</td><td>{money(c.amount)}</td><td><Badge value={c.status}/></td><td className="text-right">{user.role===ROLES.ADMIN && c.status!=='PAID' && <button className="btn-secondary" onClick={()=>updateStatus({id:c.id,status:'PAID'})}>Mark paid</button>}</td></tr>)}</tbody></table></div></section></DataState>
    </div>
  );
}
