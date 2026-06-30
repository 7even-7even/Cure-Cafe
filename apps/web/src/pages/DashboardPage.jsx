import { useSelector } from 'react-redux';
import { Activity, Bell, CreditCard, Package, Users, Utensils } from 'lucide-react';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import { useBillingChargesQuery, useKitchenDashboardQuery, useLowStockQuery, useMealOrdersQuery, useNotificationsQuery, usePatientsQuery, useDailyMealsReportQuery } from '../services/api';
import { ROLES, can, humanize, money, timeOnly } from '../utils/format';

export default function DashboardPage() {
  const user = useSelector((state) => state.auth.user);
  const opsRole = can(user, [ROLES.ADMIN, ROLES.DOCTOR, ROLES.DIETICIAN, ROLES.KITCHEN_STAFF, ROLES.DELIVERY_STAFF]);
  const kitchenRole = can(user, [ROLES.ADMIN, ROLES.DIETICIAN, ROLES.KITCHEN_STAFF]);
  const billingRole = can(user, [ROLES.ADMIN, ROLES.DIETICIAN, ROLES.PATIENT]);
  const { data: patients } = usePatientsQuery({ status: 'ADMITTED', limit: 10 }, { skip: !opsRole && user?.role !== ROLES.PATIENT });
  const { data: kitchen } = useKitchenDashboardQuery({}, { skip: !kitchenRole });
  const { data: lowStock } = useLowStockQuery(undefined, { skip: !kitchenRole });
  const { data: meals } = useMealOrdersQuery({ limit: 8 }, { skip: !user });
  const { data: notifications } = useNotificationsQuery({ unreadOnly: 'true', limit: 5 }, { skip: !user });
  const { data: billing } = useBillingChargesQuery({ limit: 20 }, { skip: !billingRole });
  const { data: report } = useDailyMealsReportQuery({}, { skip: !kitchenRole });

  const totalBilling = billing?.data?.items?.reduce((sum, item) => sum + item.amount, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] bg-gradient-to-r from-brand-700 to-emerald-600 p-6 text-white shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/70">Welcome back</p>
        <h2 className="mt-2 text-3xl font-black">{user?.name}</h2>
        <p className="mt-2 max-w-3xl text-white/80">Operate patient diets, kitchen production, inventory alerts, deliveries, billing and reports from one RBAC-secured workspace.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title={user?.role === ROLES.PATIENT ? 'My Profile' : 'Admitted Patients'} value={patients?.data?.total ?? '—'} subtitle="Currently in scope" icon={Users} />
        <StatCard title="Meals Today" value={kitchen?.data?.totalMeals ?? report?.data?.report?.total ?? meals?.data?.total ?? '—'} subtitle="Scheduled/served" icon={Utensils} tone="green" />
        <StatCard title="Low Stock Items" value={lowStock?.data?.items?.length ?? '—'} subtitle="Inventory alerts" icon={Package} tone="amber" />
        <StatCard title="Meal Charges" value={money(totalBilling)} subtitle="Visible billing scope" icon={CreditCard} tone="purple" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Latest meal orders</h3>
            <Activity className="text-slate-400" />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">Patient</th><th>Meal</th><th>Ward</th><th>Time</th><th>Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(meals?.data?.items || []).map((order) => (
                  <tr key={order.id} className="text-slate-700"><td className="py-3 font-semibold">{order.patient?.name}</td><td>{humanize(order.mealType)}</td><td>{order.ward}</td><td>{timeOnly(order.plannedFor)}</td><td><Badge value={order.status} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Unread notifications</h3>
            <Bell className="text-slate-400" />
          </div>
          <div className="mt-4 space-y-3">
            {(notifications?.data?.items || []).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="font-bold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.message}</p>
              </div>
            ))}
            {!notifications?.data?.items?.length && <p className="text-sm text-slate-500">No unread notifications.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
