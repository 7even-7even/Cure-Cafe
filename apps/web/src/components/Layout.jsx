import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Bell, ClipboardCheck, CreditCard, LayoutDashboard, LogOut, Package, Pill, Salad, ShoppingBag, Truck, Users, Utensils, BarChart3, MessageSquare, UserCog } from 'lucide-react';
import { logout } from '../features/auth/authSlice';
import { api, useNotificationsQuery } from '../services/api';
import { ROLES, roleLabel } from '../utils/format';
import BrandLogo from './BrandLogo';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: Object.values(ROLES), end: true },
  { to: '/users', label: 'Users', icon: UserCog, roles: [ROLES.ADMIN] },
  { to: '/patients', label: 'Patients', icon: Users, roles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.DIETICIAN, ROLES.KITCHEN_STAFF, ROLES.DELIVERY_STAFF, ROLES.PATIENT] },
  { to: '/diets', label: 'Diets', icon: Pill, roles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.DIETICIAN, ROLES.PATIENT] },
  { to: '/meals', label: 'Meals', icon: Utensils, roles: Object.values(ROLES) },
  { to: '/menu', label: 'Menu', icon: ShoppingBag, roles: [ROLES.ADMIN, ROLES.KITCHEN_STAFF, ROLES.PATIENT] },
  { to: '/orders', label: 'Orders', icon: ClipboardCheck, roles: [ROLES.ADMIN, ROLES.KITCHEN_STAFF, ROLES.DELIVERY_STAFF, ROLES.PATIENT, ROLES.DIETICIAN] },
  { to: '/kitchen', label: 'Kitchen', icon: Salad, roles: [ROLES.ADMIN, ROLES.DIETICIAN, ROLES.KITCHEN_STAFF] },
  { to: '/deliveries', label: 'Deliveries', icon: Truck, roles: [ROLES.ADMIN, ROLES.DELIVERY_STAFF, ROLES.KITCHEN_STAFF] },
  { to: '/inventory', label: 'Inventory', icon: Package, roles: [ROLES.ADMIN, ROLES.DIETICIAN, ROLES.KITCHEN_STAFF] },
  { to: '/billing', label: 'Billing', icon: CreditCard, roles: [ROLES.ADMIN, ROLES.DIETICIAN, ROLES.PATIENT] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: [ROLES.ADMIN, ROLES.DIETICIAN, ROLES.KITCHEN_STAFF] },
  { to: '/feedback', label: 'Feedback', icon: MessageSquare, roles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.DIETICIAN, ROLES.KITCHEN_STAFF, ROLES.PATIENT] },
  { to: '/notifications', label: 'Notifications', icon: Bell, roles: Object.values(ROLES) }
];

export default function Layout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const { data: unread } = useNotificationsQuery({ unreadOnly: 'true', limit: 20 }, { skip: !user });
  const unreadCount = unread?.data?.total || 0;

  function signOut() {
    dispatch(logout());
    dispatch(api.util.resetApiState());
    navigate('/login');
  }

  const visible = nav.filter((item) => user && item.roles.includes(user.role));

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-72 overflow-hidden border-r border-white/10 bg-slate-950 p-5 text-white lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,.35),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(249,115,22,.20),transparent_28%)]" />
        <div className="relative z-10">
          <BrandLogo light />
          <nav className="mt-8 space-y-1.5">
            {visible.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition ${isActive ? 'bg-white text-brand-800 shadow-lg shadow-emerald-950/30' : 'text-emerald-50/75 hover:bg-white/10 hover:text-white'}`}
                >
                  <Icon size={18} />
                  {item.label}
                  {item.to === '/notifications' && unreadCount > 0 && <span className="ml-auto rounded-full bg-cafe-500 px-2 py-0.5 text-xs text-white">{unreadCount}</span>}
                </NavLink>
              );
            })}
          </nav>
        </div>
        <div className="absolute bottom-5 left-5 right-5 z-10 rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
          <p className="text-sm font-black text-white">{user?.name}</p>
          <p className="truncate text-xs text-emerald-50/70">{user?.email}</p>
          <p className="mt-2 text-xs font-black text-cafe-100">{roleLabel(user?.role)}</p>
          <button onClick={signOut} className="btn-secondary mt-4 w-full border-white/10 bg-white/90"><LogOut size={16} /> Logout</button>
        </div>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-white/60 bg-white/80 px-4 py-4 shadow-sm shadow-slate-900/5 backdrop-blur-xl lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-700">Production-ready nutrition ops</p>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Cure Cafe</h1>
            </div>
            <div className="flex gap-2 overflow-x-auto lg:hidden">
              {visible.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${isActive ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 shadow-sm'}`}>{item.label}</NavLink>)}
            </div>
          </div>
        </header>
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
