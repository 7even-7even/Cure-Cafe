import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { setCredentials, logout } from '../features/auth/authSlice';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE,
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.accessToken;
    if (token) headers.set('authorization', `Bearer ${token}`);
    return headers;
  }
});

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401) {
    const refreshToken = api.getState().auth.refreshToken;
    if (refreshToken) {
      const refresh = await rawBaseQuery({ url: '/auth/refresh', method: 'POST', body: { refreshToken } }, api, extraOptions);
      if (refresh.data?.data?.accessToken) {
        api.dispatch(setCredentials(refresh.data.data));
        result = await rawBaseQuery(args, api, extraOptions);
      } else {
        api.dispatch(logout());
      }
    } else {
      api.dispatch(logout());
    }
  }
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Auth', 'Users', 'Patients', 'Diets', 'Meals', 'Kitchen', 'Inventory', 'Billing', 'Reports', 'Notifications', 'Feedback'],
  endpoints: (builder) => ({
    login: builder.mutation({ query: (body) => ({ url: '/auth/login', method: 'POST', body }) }),
    me: builder.query({ query: () => '/auth/me', providesTags: ['Auth'] }),

    users: builder.query({ query: (params = {}) => ({ url: '/users', params }), providesTags: ['Users'] }),
    createUser: builder.mutation({ query: (body) => ({ url: '/users', method: 'POST', body }), invalidatesTags: ['Users'] }),
    updateUser: builder.mutation({ query: ({ id, ...body }) => ({ url: `/users/${id}`, method: 'PATCH', body }), invalidatesTags: ['Users'] }),
    deactivateUser: builder.mutation({ query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }), invalidatesTags: ['Users'] }),

    patients: builder.query({ query: (params = {}) => ({ url: '/patients', params }), providesTags: ['Patients'] }),
    patient: builder.query({ query: (id) => `/patients/${id}`, providesTags: (_r, _e, id) => [{ type: 'Patients', id }] }),
    createPatient: builder.mutation({ query: (body) => ({ url: '/patients', method: 'POST', body }), invalidatesTags: ['Patients'] }),
    updatePatient: builder.mutation({ query: ({ id, ...body }) => ({ url: `/patients/${id}`, method: 'PATCH', body }), invalidatesTags: ['Patients'] }),
    dischargePatient: builder.mutation({ query: (id) => ({ url: `/patients/${id}/discharge`, method: 'POST', body: {} }), invalidatesTags: ['Patients'] }),

    dietTypes: builder.query({ query: () => '/diets/types' }),
    prescriptions: builder.query({ query: (params = {}) => ({ url: '/diets/prescriptions', params }), providesTags: ['Diets'] }),
    createPrescription: builder.mutation({ query: (body) => ({ url: '/diets/prescriptions', method: 'POST', body }), invalidatesTags: ['Diets', 'Notifications'] }),
    approvePrescription: builder.mutation({ query: ({ id, ...body }) => ({ url: `/diets/prescriptions/${id}/approve`, method: 'PATCH', body }), invalidatesTags: ['Diets', 'Patients', 'Kitchen', 'Notifications'] }),
    rejectPrescription: builder.mutation({ query: ({ id, reason }) => ({ url: `/diets/prescriptions/${id}/reject`, method: 'PATCH', body: { reason } }), invalidatesTags: ['Diets'] }),
    dietPlans: builder.query({ query: (params = {}) => ({ url: '/diets/plans', params }), providesTags: ['Diets'] }),
    createDietPlan: builder.mutation({ query: (body) => ({ url: '/diets/plans', method: 'POST', body }), invalidatesTags: ['Diets', 'Patients', 'Kitchen'] }),
    updateDietPlan: builder.mutation({ query: ({ id, ...body }) => ({ url: `/diets/plans/${id}`, method: 'PATCH', body }), invalidatesTags: ['Diets', 'Patients', 'Kitchen'] }),

    schedules: builder.query({ query: () => '/meals/schedules', providesTags: ['Meals'] }),
    updateSchedule: builder.mutation({ query: ({ id, ...body }) => ({ url: `/meals/schedules/${id}`, method: 'PUT', body }), invalidatesTags: ['Meals'] }),
    generateMeals: builder.mutation({ query: (body) => ({ url: '/meals/orders/generate', method: 'POST', body }), invalidatesTags: ['Meals', 'Kitchen', 'Reports', 'Notifications'] }),
    mealOrders: builder.query({ query: (params = {}) => ({ url: '/meals/orders', params }), providesTags: ['Meals'] }),
    updateMealStatus: builder.mutation({ query: ({ id, status, note }) => ({ url: `/meals/orders/${id}/status`, method: 'PATCH', body: { status, note } }), invalidatesTags: ['Meals', 'Kitchen', 'Billing', 'Reports', 'Notifications'] }),
    kitchenDashboard: builder.query({ query: (params = {}) => ({ url: '/meals/kitchen/dashboard', params }), providesTags: ['Kitchen'] }),

    inventoryItems: builder.query({ query: (params = {}) => ({ url: '/inventory/items', params }), providesTags: ['Inventory'] }),
    createInventoryItem: builder.mutation({ query: (body) => ({ url: '/inventory/items', method: 'POST', body }), invalidatesTags: ['Inventory', 'Notifications'] }),
    updateInventoryItem: builder.mutation({ query: ({ id, ...body }) => ({ url: `/inventory/items/${id}`, method: 'PATCH', body }), invalidatesTags: ['Inventory'] }),
    createInventoryTxn: builder.mutation({ query: ({ itemId, ...body }) => ({ url: `/inventory/items/${itemId}/transactions`, method: 'POST', body }), invalidatesTags: ['Inventory', 'Reports', 'Notifications'] }),
    lowStock: builder.query({ query: () => '/inventory/low-stock', providesTags: ['Inventory'] }),
    expiringInventory: builder.query({ query: (params = {}) => ({ url: '/inventory/expiring', params }), providesTags: ['Inventory'] }),
    dailyConsumption: builder.query({ query: (params = {}) => ({ url: '/inventory/reports/daily-consumption', params }), providesTags: ['Reports'] }),

    billingCharges: builder.query({ query: (params = {}) => ({ url: '/billing/charges', params }), providesTags: ['Billing'] }),
    createBillingCharge: builder.mutation({ query: (body) => ({ url: '/billing/charges', method: 'POST', body }), invalidatesTags: ['Billing'] }),
    updateBillingStatus: builder.mutation({ query: ({ id, status }) => ({ url: `/billing/charges/${id}/status`, method: 'PATCH', body: { status } }), invalidatesTags: ['Billing'] }),
    billingSummary: builder.query({ query: (patientId) => `/billing/patient/${patientId}/summary`, providesTags: ['Billing'] }),

    dailyMealsReport: builder.query({ query: (params = {}) => ({ url: '/reports/daily-meals', params }), providesTags: ['Reports'] }),
    dietDistribution: builder.query({ query: () => '/reports/diet-distribution', providesTags: ['Reports'] }),
    foodWastage: builder.query({ query: (params = {}) => ({ url: '/reports/food-wastage', params }), providesTags: ['Reports'] }),
    createFoodWastage: builder.mutation({ query: (body) => ({ url: '/reports/food-wastage', method: 'POST', body }), invalidatesTags: ['Reports'] }),
    inventoryConsumptionReport: builder.query({ query: (params = {}) => ({ url: '/reports/inventory-consumption', params }), providesTags: ['Reports'] }),
    monthlyExpenditure: builder.query({ query: (params = {}) => ({ url: '/reports/monthly-expenditure', params }), providesTags: ['Reports'] }),

    notifications: builder.query({ query: (params = {}) => ({ url: '/notifications', params }), providesTags: ['Notifications'] }),
    createNotification: builder.mutation({ query: (body) => ({ url: '/notifications', method: 'POST', body }), invalidatesTags: ['Notifications'] }),
    markNotificationRead: builder.mutation({ query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }), invalidatesTags: ['Notifications'] }),

    feedback: builder.query({ query: (params = {}) => ({ url: '/feedback', params }), providesTags: ['Feedback'] }),
    createFeedback: builder.mutation({ query: (body) => ({ url: '/feedback', method: 'POST', body }), invalidatesTags: ['Feedback'] }),
    feedbackSummary: builder.query({ query: () => '/feedback/summary/ratings', providesTags: ['Feedback'] })
  })
});

export const {
  useLoginMutation,
  useMeQuery,
  useUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeactivateUserMutation,
  usePatientsQuery,
  usePatientQuery,
  useCreatePatientMutation,
  useUpdatePatientMutation,
  useDischargePatientMutation,
  useDietTypesQuery,
  usePrescriptionsQuery,
  useCreatePrescriptionMutation,
  useApprovePrescriptionMutation,
  useRejectPrescriptionMutation,
  useDietPlansQuery,
  useCreateDietPlanMutation,
  useUpdateDietPlanMutation,
  useSchedulesQuery,
  useUpdateScheduleMutation,
  useGenerateMealsMutation,
  useMealOrdersQuery,
  useUpdateMealStatusMutation,
  useKitchenDashboardQuery,
  useInventoryItemsQuery,
  useCreateInventoryItemMutation,
  useUpdateInventoryItemMutation,
  useCreateInventoryTxnMutation,
  useLowStockQuery,
  useExpiringInventoryQuery,
  useDailyConsumptionQuery,
  useBillingChargesQuery,
  useCreateBillingChargeMutation,
  useUpdateBillingStatusMutation,
  useBillingSummaryQuery,
  useDailyMealsReportQuery,
  useDietDistributionQuery,
  useFoodWastageQuery,
  useCreateFoodWastageMutation,
  useInventoryConsumptionReportQuery,
  useMonthlyExpenditureQuery,
  useNotificationsQuery,
  useCreateNotificationMutation,
  useMarkNotificationReadMutation,
  useFeedbackQuery,
  useCreateFeedbackMutation,
  useFeedbackSummaryQuery
} = api;
