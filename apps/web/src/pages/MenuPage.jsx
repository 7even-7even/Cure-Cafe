import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, ShoppingCart, Sparkles, Utensils } from 'lucide-react';
import DataState from '../components/DataState';
import NutrientPie from '../components/NutrientPie';
import { useCreateFoodOrderMutation, useCreateMenuItemMutation, useMenuItemsQuery } from '../services/api';
import { ROLES, apiError, can, humanize, money } from '../utils/format';

const itemTypes = ['NORMAL_SET', 'JUMBO_SET', 'INDIVIDUAL_ITEM', 'CUSTOMIZABLE'];
function split(value) { return String(value || '').split(',').map((v) => v.trim()).filter(Boolean); }

export default function MenuPage() {
  const user = useSelector((state) => state.auth.user);
  const canPost = can(user, [ROLES.ADMIN, ROLES.KITCHEN_STAFF]);
  const canOrder = can(user, [ROLES.PATIENT]);
  const { data, isLoading, error } = useMenuItemsQuery({ active: 'true', limit: 100 });
  const [createMenuItem, createItemState] = useCreateMenuItemMutation();
  const [createFoodOrder, orderState] = useCreateFoodOrderMutation();
  const [cart, setCart] = useState({});
  const [instructions, setInstructions] = useState('');
  const [form, setForm] = useState({
    name: '', description: '', itemType: 'NORMAL_SET', category: 'Sets', price: '', calories: '', carbsGrams: '', proteinGrams: '', fatGrams: '', vitaminsGrams: '', fiberGrams: '', sodiumMg: '', ingredients: '', allergens: '', restrictions: '', customizableOptions: ''
  });

  const items = data?.data?.items || [];
  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const total = cartLines.reduce((sum, line) => sum + line.item.price * line.quantity, 0);

  function addToCart(item) {
    setCart((current) => ({
      ...current,
      [item.id]: current[item.id] ? { ...current[item.id], quantity: current[item.id].quantity + 1 } : { item, quantity: 1, customizationNotes: '' }
    }));
  }

  function updateLine(id, patch) {
    setCart((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  function removeLine(id) {
    setCart((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function placeOrder() {
    const response = await createFoodOrder({
      specialInstructions: instructions,
      items: cartLines.map((line) => ({ menuItemId: line.item.id, quantity: Number(line.quantity), customizationNotes: line.customizationNotes }))
    }).unwrap();
    setCart({});
    setInstructions('');
    return response;
  }

  async function submitItem(e) {
    e.preventDefault();
    await createMenuItem({
      ...form,
      price: Number(form.price),
      calories: Number(form.calories || 0),
      carbsGrams: Number(form.carbsGrams || 0),
      proteinGrams: Number(form.proteinGrams || 0),
      fatGrams: Number(form.fatGrams || 0),
      vitaminsGrams: Number(form.vitaminsGrams || 0),
      fiberGrams: Number(form.fiberGrams || 0),
      sodiumMg: Number(form.sodiumMg || 0),
      ingredients: split(form.ingredients),
      allergens: split(form.allergens),
      restrictions: split(form.restrictions),
      customizableOptions: split(form.customizableOptions),
      isActive: true
    }).unwrap();
    setForm({ name: '', description: '', itemType: 'NORMAL_SET', category: 'Sets', price: '', calories: '', carbsGrams: '', proteinGrams: '', fatGrams: '', vitaminsGrams: '', fiberGrams: '', sodiumMg: '', ingredients: '', allergens: '', restrictions: '', customizableOptions: '' });
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[2rem] bg-white/90 p-6 shadow-soft">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-black text-brand-700"><Sparkles size={16} /> Patient choice menu</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Cure Cafe Menu</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Kitchen-posted sets, individual items and customizable recovery bowls with nutrition visualization.</p>
          </div>
          <div className="rounded-2xl bg-cafe-50 p-4 text-cafe-900"><p className="text-xs font-black uppercase tracking-wide">Cart total</p><p className="text-2xl font-black">{money(total)}</p></div>
        </div>
      </div>

      {canPost && (
        <form onSubmit={submitItem} className="card space-y-4 p-5">
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><Plus className="text-brand-700" /> Post new menu item</h3>
          <div className="grid gap-3 md:grid-cols-4">
            <label><span className="label">Name</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label><span className="label">Type</span><select className="input" value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value })}>{itemTypes.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</select></label>
            <label><span className="label">Category</span><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
            <label><span className="label">Price</span><input className="input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></label>
          </div>
          <label><span className="label">Description</span><textarea className="input min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div className="grid gap-3 md:grid-cols-7">
            {['calories','carbsGrams','proteinGrams','fatGrams','vitaminsGrams','fiberGrams','sodiumMg'].map((field) => <label key={field}><span className="label">{humanize(field)}</span><input className="input" type="number" value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} /></label>)}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label><span className="label">Ingredients CSV</span><input className="input" value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} /></label>
            <label><span className="label">Allergens CSV</span><input className="input" value={form.allergens} onChange={(e) => setForm({ ...form, allergens: e.target.value })} /></label>
            <label><span className="label">Restrictions CSV</span><input className="input" placeholder="VEGETARIAN,JAIN" value={form.restrictions} onChange={(e) => setForm({ ...form, restrictions: e.target.value })} /></label>
            <label><span className="label">Options CSV</span><input className="input" value={form.customizableOptions} onChange={(e) => setForm({ ...form, customizableOptions: e.target.value })} /></label>
          </div>
          {createItemState.error && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{apiError(createItemState.error)}</p>}
          <button className="btn-primary">Publish item</button>
        </form>
      )}

      <DataState isLoading={isLoading} error={error}>
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => (
              <div key={item.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-brand-700">{humanize(item.itemType)}</p>
                    <h3 className="mt-1 text-xl font-black text-slate-950">{item.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                  </div>
                  <span className="rounded-2xl bg-cafe-50 px-3 py-2 text-sm font-black text-cafe-800">{money(item.price)}</span>
                </div>
                <div className="mt-5 rounded-[1.25rem] bg-slate-50 p-4"><NutrientPie item={item} /></div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">{(item.restrictions || []).map((r) => <span key={r} className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">{humanize(r)}</span>)}</div>
                {item.customizableOptions?.length > 0 && <p className="mt-3 text-xs text-slate-500"><b>Options:</b> {item.customizableOptions.join(', ')}</p>}
                <div className="mt-auto pt-5">{canOrder && <button className="btn-primary w-full" onClick={() => addToCart(item)}><ShoppingCart size={16} /> Add to order</button>}</div>
              </div>
            ))}
          </section>

          <aside className="card h-fit p-5">
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><Utensils className="text-brand-700" /> Current order</h3>
            <div className="mt-4 space-y-3">
              {cartLines.map((line) => (
                <div key={line.item.id} className="rounded-2xl border border-slate-100 bg-white p-3">
                  <div className="flex items-start justify-between gap-2"><p className="font-black text-slate-900">{line.item.name}</p><button className="text-xs font-bold text-rose-600" onClick={() => removeLine(line.item.id)}>Remove</button></div>
                  <div className="mt-3 grid grid-cols-[90px_1fr] gap-2"><input className="input" type="number" min="1" max="20" value={line.quantity} onChange={(e) => updateLine(line.item.id, { quantity: Number(e.target.value || 1) })} /><input className="input" placeholder="Customization notes" value={line.customizationNotes} onChange={(e) => updateLine(line.item.id, { customizationNotes: e.target.value })} /></div>
                  <p className="mt-2 text-right text-sm font-black text-slate-900">{money(line.item.price * line.quantity)}</p>
                </div>
              ))}
              {!cartLines.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Select menu items to build your order.</p>}
            </div>
            <label className="mt-4 block"><span className="label">Special instructions</span><textarea className="input min-h-20" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Delivery timing, portion notes, etc." /></label>
            {orderState.error && <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{apiError(orderState.error)}</p>}
            <button className="btn-primary mt-4 w-full" disabled={!cartLines.length || orderState.isLoading || !canOrder} onClick={placeOrder}>{orderState.isLoading ? 'Placing order...' : `Place order · ${money(total)}`}</button>
            {!canOrder && <p className="mt-3 text-xs text-slate-500">Only admitted patient accounts can place orders. Kitchen staff can publish menu items above.</p>}
          </aside>
        </div>
      </DataState>
    </div>
  );
}
