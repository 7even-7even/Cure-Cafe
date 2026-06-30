import { useState } from 'react';
import { useSelector } from 'react-redux';
import Badge from '../components/Badge';
import DataState from '../components/DataState';
import { useCreateNotificationMutation, useMarkNotificationReadMutation, useNotificationsQuery } from '../services/api';
import { ROLES, apiError, dateOnly, humanize, roleLabel } from '../utils/format';

const roles = ['ADMIN','DOCTOR','DIETICIAN','KITCHEN_STAFF','DELIVERY_STAFF','PATIENT'];

export default function NotificationsPage() {
  const user = useSelector((state) => state.auth.user);
  const { data, isLoading, error } = useNotificationsQuery({ limit: 100, all: user?.role === ROLES.ADMIN ? 'true' : 'false' });
  const [markRead] = useMarkNotificationReadMutation();
  const [createNotification, createState] = useCreateNotificationMutation();
  const [form, setForm] = useState({ roleTarget: 'KITCHEN_STAFF', title: '', message: '', type: 'GENERAL', channel: 'IN_APP' });

  async function submit(e) {
    e.preventDefault();
    await createNotification(form).unwrap();
    setForm({ ...form, title: '', message: '' });
  }

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black text-slate-900">Notifications</h2><p className="text-sm text-slate-500">In-app notifications with production adapter placeholders for email and SMS.</p></div>
      {user?.role === ROLES.ADMIN && <form onSubmit={submit} className="card grid gap-3 p-5 md:grid-cols-2"><label><span className="label">Role target</span><select className="input" value={form.roleTarget} onChange={(e)=>setForm({...form,roleTarget:e.target.value})}>{roles.map((r)=><option key={r} value={r}>{roleLabel(r)}</option>)}</select></label><label><span className="label">Type</span><select className="input" value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}><option>GENERAL</option><option>DIET_CHANGED</option><option>LOW_STOCK</option><option>PENDING_DELIVERY</option></select></label><label><span className="label">Channel</span><select className="input" value={form.channel} onChange={(e)=>setForm({...form,channel:e.target.value})}><option>IN_APP</option><option>EMAIL</option><option>SMS</option></select></label><label><span className="label">Title</span><input className="input" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} required /></label><label className="md:col-span-2"><span className="label">Message</span><textarea className="input min-h-20" value={form.message} onChange={(e)=>setForm({...form,message:e.target.value})} required /></label>{createState.error && <p className="md:col-span-2 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{apiError(createState.error)}</p>}<button className="btn-primary md:col-span-2">Send notification</button></form>}
      <DataState isLoading={isLoading} error={error}><section className="grid gap-4 lg:grid-cols-2">{(data?.data?.items || []).map((n)=><div key={n.id} className={`card p-5 ${n.readAt ? 'opacity-70' : ''}`}><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{n.title}</p><p className="mt-1 text-sm text-slate-600">{n.message}</p></div><Badge value={n.type}/></div><div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{n.roleTarget ? `Role: ${roleLabel(n.roleTarget)}` : 'Direct'} · {humanize(n.channel)} · {dateOnly(n.createdAt)}</span>{!n.readAt && <button className="btn-secondary" onClick={()=>markRead(n.id)}>Mark read</button>}</div></div>)}</section></DataState>
    </div>
  );
}
