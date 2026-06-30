import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import DataState from '../components/DataState';
import Badge from '../components/Badge';
import { useApprovePrescriptionMutation, useCreateDietPlanMutation, useCreatePrescriptionMutation, useDietPlansQuery, useDietTypesQuery, usePatientsQuery, usePrescriptionsQuery, useRejectPrescriptionMutation, useUsersQuery } from '../services/api';
import { ROLES, apiError, can, dateOnly, humanize } from '../utils/format';

function split(value) { return String(value || '').split(',').map((v) => v.trim()).filter(Boolean); }

export default function DietsPage() {
  const user = useSelector((state) => state.auth.user);
  const { data: types } = useDietTypesQuery();
  const { data: patients } = usePatientsQuery({ status: 'ADMITTED', limit: 100 });
  const { data: prescriptions, isLoading, error } = usePrescriptionsQuery({ limit: 100 });
  const { data: plans } = useDietPlansQuery({ limit: 100 });
  const { data: doctors } = useUsersQuery({ role: 'DOCTOR', limit: 100 }, { skip: user?.role !== ROLES.ADMIN });
  const [createPrescription, rxState] = useCreatePrescriptionMutation();
  const [approvePrescription] = useApprovePrescriptionMutation();
  const [rejectPrescription] = useRejectPrescriptionMutation();
  const [createPlan, planState] = useCreateDietPlanMutation();
  const dietTypes = types?.data?.dietTypes || ['DIABETIC', 'LOW_SODIUM', 'LIQUID', 'HIGH_PROTEIN', 'NORMAL'];
  const [rx, setRx] = useState({ patientId: '', doctorId: '', dietType: 'DIABETIC', restrictions: '', allergies: '', instructions: '' });
  const [plan, setPlan] = useState({ patientId: '', dietType: 'NORMAL', restrictions: '', allergies: '', calories: '1800', proteinGrams: '70', notes: '' });
  const patientOptions = patients?.data?.items || [];
  const pending = useMemo(() => (prescriptions?.data?.items || []).filter((p) => p.status === 'PENDING'), [prescriptions]);

  async function submitPrescription(e) {
    e.preventDefault();
    await createPrescription({
      patientId: rx.patientId,
      doctorId: user.role === ROLES.ADMIN ? rx.doctorId : undefined,
      dietType: rx.dietType,
      restrictions: split(rx.restrictions),
      allergies: split(rx.allergies),
      instructions: rx.instructions
    }).unwrap();
    setRx({ ...rx, restrictions: '', allergies: '', instructions: '' });
  }

  async function submitPlan(e) {
    e.preventDefault();
    await createPlan({
      patientId: plan.patientId,
      dietType: plan.dietType,
      restrictions: split(plan.restrictions),
      allergies: split(plan.allergies),
      calories: plan.calories ? Number(plan.calories) : undefined,
      proteinGrams: plan.proteinGrams ? Number(plan.proteinGrams) : undefined,
      notes: plan.notes,
      makeCurrent: true
    }).unwrap();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Doctor and Dietician Module</h2>
        <p className="text-sm text-slate-500">Doctors prescribe diets; dieticians approve and customize active plans dynamically.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {can(user, [ROLES.ADMIN, ROLES.DOCTOR]) && (
          <form onSubmit={submitPrescription} className="card space-y-4 p-5">
            <h3 className="text-lg font-black text-slate-900">Prescribe dietary requirement</h3>
            <label><span className="label">Patient</span><select className="input" value={rx.patientId} onChange={(e) => setRx({ ...rx, patientId: e.target.value })} required><option value="">Select patient</option>{patientOptions.map((p) => <option key={p.id} value={p.id}>{p.name} - {p.ward}</option>)}</select></label>
            {user.role === ROLES.ADMIN && <label><span className="label">Doctor</span><select className="input" value={rx.doctorId} onChange={(e) => setRx({ ...rx, doctorId: e.target.value })} required><option value="">Select doctor</option>{(doctors?.data?.items || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
            <label><span className="label">Diet type</span><select className="input" value={rx.dietType} onChange={(e) => setRx({ ...rx, dietType: e.target.value })}>{dietTypes.map((d) => <option key={d} value={d}>{humanize(d)}</option>)}</select></label>
            <label><span className="label">Restrictions CSV</span><input className="input" value={rx.restrictions} onChange={(e) => setRx({ ...rx, restrictions: e.target.value })} placeholder="GLUTEN_FREE,VEGETARIAN" /></label>
            <label><span className="label">Allergies CSV</span><input className="input" value={rx.allergies} onChange={(e) => setRx({ ...rx, allergies: e.target.value })} /></label>
            <label><span className="label">Doctor instructions</span><textarea className="input min-h-24" value={rx.instructions} onChange={(e) => setRx({ ...rx, instructions: e.target.value })} /></label>
            {rxState.error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{apiError(rxState.error)}</p>}
            <button className="btn-primary w-full" disabled={rxState.isLoading}>Create prescription</button>
          </form>
        )}
        {can(user, [ROLES.ADMIN, ROLES.DIETICIAN]) && (
          <form onSubmit={submitPlan} className="card space-y-4 p-5">
            <h3 className="text-lg font-black text-slate-900">Direct diet plan assignment</h3>
            <label><span className="label">Patient</span><select className="input" value={plan.patientId} onChange={(e) => setPlan({ ...plan, patientId: e.target.value })} required><option value="">Select patient</option>{patientOptions.map((p) => <option key={p.id} value={p.id}>{p.name} - {p.ward}</option>)}</select></label>
            <label><span className="label">Diet type</span><select className="input" value={plan.dietType} onChange={(e) => setPlan({ ...plan, dietType: e.target.value })}>{dietTypes.map((d) => <option key={d} value={d}>{humanize(d)}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3"><label><span className="label">Calories</span><input className="input" type="number" value={plan.calories} onChange={(e) => setPlan({ ...plan, calories: e.target.value })} /></label><label><span className="label">Protein grams</span><input className="input" type="number" value={plan.proteinGrams} onChange={(e) => setPlan({ ...plan, proteinGrams: e.target.value })} /></label></div>
            <label><span className="label">Restrictions CSV</span><input className="input" value={plan.restrictions} onChange={(e) => setPlan({ ...plan, restrictions: e.target.value })} /></label>
            <label><span className="label">Allergies CSV</span><input className="input" value={plan.allergies} onChange={(e) => setPlan({ ...plan, allergies: e.target.value })} /></label>
            <label><span className="label">Notes</span><textarea className="input min-h-20" value={plan.notes} onChange={(e) => setPlan({ ...plan, notes: e.target.value })} /></label>
            {planState.error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{apiError(planState.error)}</p>}
            <button className="btn-primary w-full" disabled={planState.isLoading}>Assign active plan</button>
          </form>
        )}
      </div>

      <DataState isLoading={isLoading} error={error}>
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="card p-5">
            <h3 className="text-lg font-black text-slate-900">Prescriptions</h3>
            <div className="mt-4 space-y-3">
              {(prescriptions?.data?.items || []).map((p) => (
                <div key={p.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-slate-900">{p.patient?.name} · {humanize(p.dietType)}</p><Badge value={p.status} /></div>
                  <p className="mt-1 text-sm text-slate-500">Doctor: {p.doctor?.name || '-'} · {dateOnly(p.prescribedAt)}</p>
                  <p className="mt-2 text-sm text-slate-700">{p.instructions}</p>
                  {can(user, [ROLES.ADMIN, ROLES.DIETICIAN]) && p.status === 'PENDING' && <div className="mt-3 flex gap-2"><button className="btn-primary" onClick={() => approvePrescription({ id: p.id })}>Approve</button><button className="btn-danger" onClick={() => rejectPrescription({ id: p.id, reason: 'Rejected by dietician' })}>Reject</button></div>}
                </div>
              ))}
              {!prescriptions?.data?.items?.length && <p className="text-sm text-slate-500">No prescriptions yet.</p>}
            </div>
          </section>
          <section className="card p-5">
            <h3 className="text-lg font-black text-slate-900">Active and historical diet plans</h3>
            <div className="mt-4 space-y-3">
              {(plans?.data?.items || []).map((p) => (
                <div key={p.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between"><p className="font-bold text-slate-900">{p.patient?.name} · {humanize(p.dietType)}</p><Badge value={p.status} /></div>
                  <p className="mt-1 text-sm text-slate-500">Calories {p.calories || '-'} · Protein {p.proteinGrams || '-'}g</p>
                  <p className="mt-2 text-xs text-slate-500">Restrictions: {(p.restrictions || []).join(', ') || '-'} · Allergies: {(p.allergies || []).join(', ') || '-'}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DataState>
    </div>
  );
}
