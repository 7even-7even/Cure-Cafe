import { useState } from 'react';
import { useSelector } from 'react-redux';
import DataState from '../components/DataState';
import Badge from '../components/Badge';
import { useCreatePatientMutation, useDischargePatientMutation, usePatientsQuery } from '../services/api';
import { ROLES, apiError, can, dateOnly, humanize } from '../utils/format';

function splitList(value) {
  return String(value || '').split(',').map((v) => v.trim()).filter(Boolean);
}

export default function PatientsPage() {
  const user = useSelector((state) => state.auth.user);
  const canManage = can(user, [ROLES.ADMIN, ROLES.DIETICIAN]);
  const [status, setStatus] = useState('ADMITTED');
  const { data, isLoading, error } = usePatientsQuery({ status: status || undefined });
  const [createPatient, createState] = useCreatePatientMutation();
  const [discharge] = useDischargePatientMutation();
  const [form, setForm] = useState({ mrn: '', name: '', age: '', gender: 'FEMALE', phone: '', ward: 'Ward A', roomNumber: '', bedNumber: '', preferences: '', restrictions: 'VEGETARIAN', allergies: '', notes: '' });

  async function submit(e) {
    e.preventDefault();
    await createPatient({
      ...form,
      age: form.age ? Number(form.age) : undefined,
      admissionDate: new Date().toISOString(),
      preferences: splitList(form.preferences),
      restrictions: splitList(form.restrictions),
      allergies: splitList(form.allergies)
    }).unwrap();
    setForm({ mrn: '', name: '', age: '', gender: 'FEMALE', phone: '', ward: 'Ward A', roomNumber: '', bedNumber: '', preferences: '', restrictions: 'VEGETARIAN', allergies: '', notes: '' });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Patient Meal Management</h2>
        <p className="text-sm text-slate-500">Register admissions, ward/bed placement, preferences, allergies and discharge state.</p>
      </div>
      <section className={`grid gap-6 ${canManage ? 'xl:grid-cols-[420px_1fr]' : ''}`}>
        {canManage && (
          <form onSubmit={submit} className="card space-y-4 p-5">
            <h3 className="text-lg font-black text-slate-900">Register admitted patient</h3>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">MRN</span><input className="input" value={form.mrn} onChange={(e) => setForm({ ...form, mrn: e.target.value })} required /></label>
              <label><span className="label">Age</span><input className="input" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></label>
            </div>
            <label><span className="label">Name</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">Gender</span><select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option>FEMALE</option><option>MALE</option><option>OTHER</option></select></label>
              <label><span className="label">Phone</span><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label><span className="label">Ward</span><input className="input" value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })} required /></label>
              <label><span className="label">Room</span><input className="input" value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} required /></label>
              <label><span className="label">Bed</span><input className="input" value={form.bedNumber} onChange={(e) => setForm({ ...form, bedNumber: e.target.value })} required /></label>
            </div>
            <label><span className="label">Preferences CSV</span><input className="input" value={form.preferences} onChange={(e) => setForm({ ...form, preferences: e.target.value })} placeholder="Less oil, warm water" /></label>
            <label><span className="label">Restrictions CSV</span><input className="input" value={form.restrictions} onChange={(e) => setForm({ ...form, restrictions: e.target.value })} placeholder="VEGETARIAN,JAIN" /></label>
            <label><span className="label">Allergies CSV</span><input className="input" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} /></label>
            {createState.error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{apiError(createState.error)}</p>}
            <button className="btn-primary w-full" disabled={createState.isLoading}>Register patient</button>
          </form>
        )}
        <DataState isLoading={isLoading} error={error}>
          <div className="card p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-black text-slate-900">Patients</h3>
              <select className="input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}><option value="ADMITTED">Admitted</option><option value="DISCHARGED">Discharged</option><option value="">All</option></select>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">Patient</th><th>Location</th><th>Diet</th><th>Restrictions</th><th>Admitted</th><th>Status</th><th></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.data?.items || []).map((patient) => (
                    <tr key={patient.id} className="align-top text-slate-700">
                      <td className="py-3"><p className="font-bold text-slate-900">{patient.name}</p><p className="text-xs text-slate-500">{patient.mrn}</p></td>
                      <td>{patient.ward}<br /><span className="text-xs text-slate-500">Room {patient.roomNumber}, Bed {patient.bedNumber}</span></td>
                      <td>{humanize(patient.currentDietPlan?.dietType || 'NORMAL')}</td>
                      <td className="max-w-xs text-xs">{[...(patient.restrictions || []), ...(patient.allergies || [])].join(', ') || '-'}</td>
                      <td>{dateOnly(patient.admissionDate)}</td>
                      <td><Badge value={patient.status === 'ADMITTED' ? 'APPROVED' : 'CANCELLED'} /></td>
                      <td className="text-right">{can(user, [ROLES.ADMIN, ROLES.DOCTOR, ROLES.DIETICIAN]) && patient.status === 'ADMITTED' && <button className="btn-secondary" onClick={() => discharge(patient.id)}>Discharge</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DataState>
      </section>
    </div>
  );
}
