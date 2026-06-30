import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Bell, ClipboardList, CreditCard, LayoutDashboard, LogOut, Package, Pill, Salad, Truck, Users, Utensils, BarChart3, MessageSquare, UserCog } from 'lucide-react';
import { logout } from '../features/auth/authSlice';
import { api, useNotificationsQuery } from '../services/api';
import { ROLES, roleLabel } from '../utils/format';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: Object.values(ROLES), end: true },
  { to: '/users', label: 'Users', icon: UserCog, roles: [ROLES.ADMIN] },
  { to: '/patients', label: 'Patients', icon: Users, roles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.DIETICIAN, ROLES.KITCHEN_STAFF, ROLES.DELIVERY_STAFF, ROLES.PATIENT] },
  { to: '/diets', label: 'Diets', icon: Pill, roles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.DIETICIAN, ROLES.PATIENT] },
  { to: '/meals', label: 'Meals', icon: Utensils, roles: Object.values(ROLES) },
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
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white p-5 lg:block">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-lg font-bold text-white">HF</div>
          <div>
            <p className="text-lg font-black text-slate-900">HFMS</p>
            <p className="text-xs text-slate-500">Hospital Food Ops</p>
          </div>
        </div>
        <nav className="mt-8 space-y-1">
          {visible.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Icon size={18} />
                {item.label}
                {item.to === '/notifications' && unreadCount > 0 && <span className="ml-auto rounded-full bg-rose-600 px-2 py-0.5 text-xs text-white">{unreadCount}</span>}
              </NavLink>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-900">{user?.name}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
          <p className="mt-2 text-xs font-semibold text-brand-700">{roleLabel(user?.role)}</p>
          <button onClick={signOut} className="btn-secondary mt-4 w-full"><LogOut size={16} /> Logout</button>
        </div>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Production-ready MVP</p>
              <h1 className="text-2xl font-black text-slate-900">Hospital Food Management System</h1>
            </div>
            <div className="flex gap-2 overflow-x-auto lg:hidden">
              {visible.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${isActive ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{item.label}</NavLink>)}
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
