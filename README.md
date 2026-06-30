# Hospital Food Management System (HFMS)

Production-ready startup MVP for a hospital food operations platform. The app includes JWT authentication, role-based access control, patient meal management, diet prescriptions and approvals, kitchen dashboard, delivery tracking, inventory, billing, reports, notifications and feedback.

## 1. System Architecture

```text
React + Tailwind + Redux Toolkit / RTK Query
          |
          | HTTPS REST API + JWT Bearer token
          v
Node.js + Express.js API
  - auth/RBAC middleware
  - validation with Zod
  - module-isolated route controllers
  - centralized exception handling
  - notification service adapter layer
  - file upload service
          |
          v
Prisma ORM
          |
          v
SQLite for local testing
(PostgreSQL-compatible production architecture)
```

### Production scaling path

- **Frontend**: deploy static Vite build to CDN/edge.
- **API**: stateless Express containers behind a load balancer.
- **Database**: replace local SQLite with PostgreSQL, add read replicas and connection pooling.
- **Background jobs**: move meal generation, SMS/email and reports to queues such as BullMQ/SQS/Kafka.
- **Files**: replace local uploads with S3/GCS signed URLs.
- **Notifications**: plug in SES/Twilio/Firebase from `notification.service.js`.
- **Observability**: add OpenTelemetry, centralized logs, audit trails and SLO alerts.
- **Security**: rotate JWT secrets, store refresh tokens server-side, enforce HTTPS, WAF/rate limits and DB backups.

## 2. Tech Stack

### Frontend
- React
- Vite
- Tailwind CSS
- Redux Toolkit + RTK Query
- React Router

### Backend
- Node.js
- Express.js
- Prisma ORM
- SQLite local database
- JWT auth + refresh token rotation
- RBAC middleware
- Zod validation
- Multer file uploads
- Helmet, CORS, compression, rate limiting

## 3. File Structure

```text
hfms/
  package.json                 # npm workspaces root
  .env.example
  apps/
    api/
      package.json
      .env                     # local dev env already provided
      prisma/
        schema.prisma          # database schema
        seed.js                # demo seed data and credentials
      scripts/
        smoke-test.js          # API smoke test
      src/
        app.js                 # Express app composition
        server.js              # API server bootstrap
        constants.js
        config/
          env.js
          prisma.js
        middleware/
          auth.js
          errorHandler.js
          validate.js
        services/
          notification.service.js
        utils/
          apiError.js
          asyncHandler.js
          date.js
          json.js
        modules/
          auth/
          users/
          patients/
          diets/
          meals/
          inventory/
          billing/
          reports/
          notifications/
          feedback/
          files/
    web/
      package.json
      vite.config.js
      tailwind.config.js
      src/
        App.jsx
        main.jsx
        index.css
        app/store.js
        features/auth/authSlice.js
        services/api.js
        components/
        pages/
        utils/
```

## 4. Database Schema Summary

Core tables in `apps/api/prisma/schema.prisma`:

- `User`: staff and patient users with roles, password hash and refresh token hash.
- `Patient`: admitted/discharged patient profile, ward, room, bed, preferences, allergies and current diet.
- `DietPrescription`: doctor-created dietary recommendation pending dietician approval.
- `DietPlan`: approved/customized diet plan assigned to patient.
- `MealSchedule`: breakfast/lunch/snacks/dinner serve schedule.
- `MealOrder`: generated patient meal order with status workflow.
- `MealStatusHistory`: audit trail for prepared/packed/dispatched/delivered transitions.
- `InventoryItem`: stock, unit, threshold, expiry and cost.
- `InventoryTxn`: purchase/consumption/adjustment/wastage transaction ledger.
- `BillingCharge`: meal and manual charges attached to patient bill.
- `Notification`: in-app/email/SMS notification records.
- `Feedback`: taste/quality/quantity/timing ratings.
- `FoodWastage`: wastage reporting.
- `FileAsset`: uploaded patient reports, diet charts and food images.

## 5. API Endpoints

Base URL: `http://localhost:4000/api`

### Auth
- `POST /auth/login`
- `POST /auth/register` patient self-registration
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Users, Admin only
- `GET /users`
- `POST /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id` soft deactivate

### Patients
- `GET /patients`
- `POST /patients`
- `GET /patients/:id`
- `PATCH /patients/:id`
- `POST /patients/:id/discharge`
- `GET /patients/:id/files`
- `POST /patients/:id/files`

### Diets
- `GET /diets/types`
- `GET /diets/prescriptions`
- `POST /diets/prescriptions`
- `PATCH /diets/prescriptions/:id/approve`
- `PATCH /diets/prescriptions/:id/reject`
- `GET /diets/plans`
- `POST /diets/plans`
- `PATCH /diets/plans/:id`

### Meals and Kitchen
- `GET /meals/schedules`
- `PUT /meals/schedules/:id`
- `POST /meals/orders/generate`
- `GET /meals/orders`
- `GET /meals/orders/:id`
- `PATCH /meals/orders/:id/status`
- `DELETE /meals/orders/:id`
- `GET /meals/kitchen/dashboard`

### Inventory
- `GET /inventory/items`
- `POST /inventory/items`
- `PATCH /inventory/items/:id`
- `GET /inventory/items/:id/transactions`
- `POST /inventory/items/:id/transactions`
- `GET /inventory/low-stock`
- `GET /inventory/expiring`
- `GET /inventory/reports/daily-consumption`

### Billing
- `GET /billing/charges`
- `POST /billing/charges`
- `PATCH /billing/charges/:id/status`
- `GET /billing/patient/:patientId/summary`

### Reports
- `GET /reports/daily-meals`
- `GET /reports/diet-distribution`
- `GET /reports/food-wastage`
- `POST /reports/food-wastage`
- `GET /reports/inventory-consumption`
- `GET /reports/monthly-expenditure`

### Notifications
- `GET /notifications`
- `POST /notifications`
- `PATCH /notifications/:id/read`
- `DELETE /notifications/:id`

### Feedback
- `GET /feedback`
- `POST /feedback`
- `GET /feedback/summary/ratings`

## 6. UI Architecture

- `Layout.jsx`: role-aware side navigation and session controls.
- `ProtectedRoute.jsx`: token + optional role gate.
- `services/api.js`: centralized RTK Query API client with automatic refresh-token retry.
- Pages map to modules:
  - Dashboard
  - Users
  - Patients
  - Diets
  - Meals
  - Kitchen
  - Deliveries
  - Inventory
  - Billing
  - Reports
  - Notifications
  - Feedback

## 7. Run Locally

Requirements: Node.js 20+

```bash
cd hfms
npm run setup
npm run dev
```

Open:

- Web: `http://localhost:5173`
- API health: `http://localhost:4000/health`

If you need to reset demo data:

```bash
npm run db:reset -w apps/api
```

Run API smoke test after setup:

```bash
npm run smoke:test
```

## 8. Demo Credentials

All seeded users use password: `Admin@1234`

| Role | Email |
|---|---|
| Admin | `admin@hfms.test` |
| Doctor | `doctor@hfms.test` |
| Dietician | `dietician@hfms.test` |
| Kitchen Staff | `kitchen@hfms.test` |
| Delivery Staff | `delivery@hfms.test` |
| Patient | `patient@hfms.test` |

## 9. RBAC Summary

- **Admin**: all modules, users, billing status, reports.
- **Doctor**: patients and prescriptions.
- **Dietician**: patients, diet approvals/customization, billing, reports.
- **Kitchen Staff**: schedules, meal preparation/packing, inventory, kitchen reports.
- **Delivery Staff**: dispatch and deliver packed meals.
- **Patient**: own profile, own meals, own bills, feedback and notifications.

## 10. Important Notes

- The local MVP uses SQLite to make the app immediately testable. For production, switch Prisma datasource to PostgreSQL and add migrations.
- Email/SMS are intentionally adapter stubs in the MVP. In-app notifications are persisted and fully functional.
- File uploads are local in `apps/api/uploads`; production should use object storage.
