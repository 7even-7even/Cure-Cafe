import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ChefHat, ShieldCheck } from 'lucide-react';
import { useLoginMutation } from '../services/api';
import { setCredentials } from '../features/auth/authSlice';
import { apiError } from '../utils/format';

const demos = [
  ['Admin', 'admin@hfms.test'],
  ['Doctor', 'doctor@hfms.test'],
  ['Dietician', 'dietician@hfms.test'],
  ['Kitchen', 'kitchen@hfms.test'],
  ['Delivery', 'delivery@hfms.test'],
  ['Patient', 'patient@hfms.test']
];

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useSelector((state) => state.auth.accessToken);
  const [login, { isLoading, error }] = useLoginMutation();
  const [form, setForm] = useState({ email: 'admin@hfms.test', password: 'Admin@1234' });

  if (token) return <Navigate to={location.state?.from?.pathname || '/'} replace />;

  async function submit(e) {
    e.preventDefault();
    const result = await login(form).unwrap();
    dispatch(setCredentials(result.data));
    navigate(location.state?.from?.pathname || '/');
  }

  return (
    <div className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <section className="relative hidden overflow-hidden p-10 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,.35),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(16,185,129,.25),transparent_30%)]" />
        <div className="relative z-10 flex h-full flex-col justify-between rounded-[2rem] border border-white/10 bg-white/10 p-10 text-white backdrop-blur">
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-700"><ChefHat size={28} /></div>
            <h1 className="mt-8 text-5xl font-black leading-tight">Hospital Food Management System</h1>
            <p className="mt-5 max-w-xl text-lg text-slate-200">Role-based food operations for patients, doctors, dieticians, kitchens, delivery staff, inventory, billing and analytics.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {['JWT + RBAC', 'Meal Tracking', 'Inventory Alerts', 'Diet Approvals', 'Billing', 'Reports'].map((item) => <div key={item} className="rounded-2xl bg-white/10 p-4 font-semibold">{item}</div>)}
          </div>
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-brand-50 p-3 text-brand-700"><ShieldCheck /></div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Secure login</h2>
              <p className="text-sm text-slate-500">Use seeded demo credentials.</p>
            </div>
          </div>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <label>
              <span className="label">Email</span>
              <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label>
              <span className="label">Password</span>
              <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </label>
            {error && <div className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{apiError(error)}</div>}
            <button className="btn-primary w-full" disabled={isLoading}>{isLoading ? 'Signing in...' : 'Login'}</button>
          </form>
          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Quick role switch</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {demos.map(([label, email]) => <button key={email} onClick={() => setForm({ email, password: 'Admin@1234' })} className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">{label}</button>)}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
