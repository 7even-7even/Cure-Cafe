import { useState } from 'react';
import { useSelector } from 'react-redux';
import DataState from '../components/DataState';
import { useCreateInventoryItemMutation, useCreateInventoryTxnMutation, useDailyConsumptionQuery, useExpiringInventoryQuery, useInventoryItemsQuery, useLowStockQuery } from '../services/api';
import { ROLES, apiError, can, dateOnly, money } from '../utils/format';

export default function InventoryPage() {
  const user = useSelector((state) => state.auth.user);
  const canManage = can(user, [ROLES.ADMIN, ROLES.KITCHEN_STAFF]);
  const { data, isLoading, error } = useInventoryItemsQuery({ limit: 100 });
  const { data: low } = useLowStockQuery();
  const { data: expiring } = useExpiringInventoryQuery({ days: 7 });
  const { data: consumption } = useDailyConsumptionQuery({});
  const [createItem, itemState] = useCreateInventoryItemMutation();
  const [createTxn, txnState] = useCreateInventoryTxnMutation();
  const [item, setItem] = useState({ name: '', unit: 'kg', currentStock: '0', lowStockThreshold: '0', costPerUnit: '0', expiryDate: '' });
  const [txn, setTxn] = useState({ itemId: '', type: 'CONSUMPTION', quantity: '', reason: '' });
  const items = data?.data?.items || [];

  async function submitItem(e) {
    e.preventDefault();
    await createItem({ ...item, currentStock: Number(item.currentStock), lowStockThreshold: Number(item.lowStockThreshold), costPerUnit: Number(item.costPerUnit), expiryDate: item.expiryDate || undefined }).unwrap();
    setItem({ name: '', unit: 'kg', currentStock: '0', lowStockThreshold: '0', costPerUnit: '0', expiryDate: '' });
  }
  async function submitTxn(e) {
    e.preventDefault();
    await createTxn({ itemId: txn.itemId, type: txn.type, quantity: Number(txn.quantity), reason: txn.reason }).unwrap();
    setTxn({ ...txn, quantity: '', reason: '' });
  }

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black text-slate-900">Inventory Management</h2><p className="text-sm text-slate-500">Track stock, expiry, low-stock alerts and daily consumption.</p></div>
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card p-5"><h3 className="text-lg font-black text-slate-900">Low stock</h3><div className="mt-4 space-y-2">{(low?.data?.items || []).map((i) => <div key={i.id} className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700"><b>{i.name}</b>: {i.currentStock} {i.unit} (threshold {i.lowStockThreshold})</div>)}{!low?.data?.items?.length && <p className="text-sm text-slate-500">No low stock alerts.</p>}</div></section>
        <section className="card p-5"><h3 className="text-lg font-black text-slate-900">Expiring soon</h3><div className="mt-4 space-y-2">{(expiring?.data?.items || []).map((i) => <div key={i.id} className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-700"><b>{i.name}</b>: expires {dateOnly(i.expiryDate)}</div>)}{!expiring?.data?.items?.length && <p className="text-sm text-slate-500">No expiry alerts.</p>}</div></section>
        <section className="card p-5"><h3 className="text-lg font-black text-slate-900">Today's consumption</h3><p className="mt-4 text-3xl font-black text-slate-900">{money(consumption?.data?.totalCost || 0)}</p><p className="text-sm text-slate-500">Estimated cost consumed/wasted</p></section>
      </div>
      {canManage && <div className="grid gap-6 xl:grid-cols-2"><form onSubmit={submitItem} className="card space-y-4 p-5"><h3 className="text-lg font-black text-slate-900">Add stock item</h3><div className="grid grid-cols-2 gap-3"><label><span className="label">Name</span><input className="input" value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} required /></label><label><span className="label">Unit</span><input className="input" value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} required /></label></div><div className="grid grid-cols-3 gap-3"><label><span className="label">Stock</span><input className="input" type="number" value={item.currentStock} onChange={(e) => setItem({ ...item, currentStock: e.target.value })} /></label><label><span className="label">Threshold</span><input className="input" type="number" value={item.lowStockThreshold} onChange={(e) => setItem({ ...item, lowStockThreshold: e.target.value })} /></label><label><span className="label">Cost/unit</span><input className="input" type="number" value={item.costPerUnit} onChange={(e) => setItem({ ...item, costPerUnit: e.target.value })} /></label></div><label><span className="label">Expiry date</span><input className="input" type="date" value={item.expiryDate} onChange={(e) => setItem({ ...item, expiryDate: e.target.value })} /></label>{itemState.error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{apiError(itemState.error)}</p>}<button className="btn-primary w-full">Create item</button></form><form onSubmit={submitTxn} className="card space-y-4 p-5"><h3 className="text-lg font-black text-slate-900">Record transaction</h3><label><span className="label">Item</span><select className="input" value={txn.itemId} onChange={(e) => setTxn({ ...txn, itemId: e.target.value })} required><option value="">Select item</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.currentStock} {i.unit})</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label><span className="label">Type</span><select className="input" value={txn.type} onChange={(e) => setTxn({ ...txn, type: e.target.value })}><option>PURCHASE</option><option>CONSUMPTION</option><option>ADJUSTMENT</option><option>WASTAGE</option></select></label><label><span className="label">Quantity</span><input className="input" type="number" value={txn.quantity} onChange={(e) => setTxn({ ...txn, quantity: e.target.value })} required /></label></div><label><span className="label">Reason</span><input className="input" value={txn.reason} onChange={(e) => setTxn({ ...txn, reason: e.target.value })} /></label>{txnState.error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{apiError(txnState.error)}</p>}<button className="btn-primary w-full">Record transaction</button></form></div>}
      <DataState isLoading={isLoading} error={error}><section className="card p-5"><h3 className="text-lg font-black text-slate-900">Inventory items</h3><div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">Item</th><th>Stock</th><th>Threshold</th><th>Expiry</th><th>Cost/unit</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((i) => <tr key={i.id} className="text-slate-700"><td className="py-3 font-bold text-slate-900">{i.name}</td><td>{i.currentStock} {i.unit}</td><td>{i.lowStockThreshold} {i.unit}</td><td>{dateOnly(i.expiryDate) || '-'}</td><td>{money(i.costPerUnit)}</td></tr>)}</tbody></table></div></section></DataState>
    </div>
  );
}
