# Cure Cafe

Cure Cafe is a production-ready MVP for hospital nutrition operations. It manages admitted patient diets, doctor prescriptions, dietician approvals, kitchen preparation, patient menu ordering, ward-wise meal distribution, delivery tracking, inventory, billing, notifications, analytics and patient feedback.

The project uses **PostgreSQL + Prisma** and now includes **email-verified registration**.

---

## 1. System Architecture

```text
React + Tailwind CSS + Redux Toolkit / RTK Query
          |
          | HTTPS REST API + JWT Bearer token
          v
Node.js + Express.js API
  - JWT authentication + refresh token rotation
  - email verification before first login
  - role-based access control
  - Zod request validation
  - centralized exception handling
  - isolated business modules
  - SMTP email adapter
  - notification adapter service
  - file upload service
          |
          v
Prisma ORM
          |
          v
PostgreSQL
```

### Production scaling path

- **Frontend**: deploy the Vite build to CDN/edge or serve it from the API container.
- **API**: stateless Express containers behind a load balancer.
- **Database**: PostgreSQL with managed backups, connection pooling and read replicas as traffic grows.
- **Background jobs**: move meal generation, email/SMS and heavy reports to BullMQ/SQS/Kafka.
- **Files**: replace local uploads with S3/GCS signed URLs.
- **Notifications**: plug real email/SMS providers into `email.service.js` and `notification.service.js`.
- **Observability**: add OpenTelemetry, centralized logs, audit trails and alerts.
- **Security**: rotate JWT secrets, enforce HTTPS, protect PHI/PII, enable backups and least-privilege DB users.

---

## 2. Tech Stack

### Frontend

- React
- Vite
- Tailwind CSS
- Redux Toolkit + RTK Query
- React Router
- Custom Cure Cafe SVG logo

### Backend

- Node.js
- Express.js
- Prisma ORM
- PostgreSQL
- JWT auth + refresh token rotation
- Email verification using SMTP/Nodemailer
- RBAC middleware
- Zod validation
- Multer file uploads
- Helmet, CORS, compression and rate limiting

---

## 3. File Structure

```text
hfms/
  docker-compose.yml            # PostgreSQL + Adminer local setup
  render.yaml                   # Render deployment blueprint with Postgres
  package.json                  # npm workspaces root
  .env.example
  Breakdown.md                  # detailed folder/file explanation
  apps/
    api/
      package.json
      .env                     # local dev env
      prisma/
        schema.prisma          # PostgreSQL Prisma schema
        seed.js                # idempotent demo seed data
      scripts/
        smoke-test.js
      src/
        app.js
        server.js
        constants.js
        config/
        middleware/
        services/
        utils/
        modules/
          auth/
          users/
          patients/
          diets/
          meals/
          menu/
          inventory/
          billing/
          reports/
          notifications/
          feedback/
          files/
    web/
      package.json
      public/
        logo.svg
        favicon.svg
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

---

## 4. Authentication and Email Verification

Cure Cafe supports verified registration:

1. A public user registers from `/register`.
2. The backend creates the account as inactive and unverified.
3. A formal verification email is sent to the registered email address.
4. The user opens `/verify-email?token=...`.
5. Only after verification does the account become active and eligible for login.
6. If an unverified user tries to login, Cure Cafe sends a fresh verification email and blocks login.

### Auth endpoints

- `POST /auth/register`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### SMTP environment variables

For real email delivery, configure these in `apps/api/.env` or your deployment platform:

```env
APP_URL="http://localhost:5173"
EMAIL_VERIFICATION_TTL_MINUTES=60
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-gmail-app-password"
SMTP_FROM="Cure Cafe <your-email@gmail.com>"
```

In local development, if SMTP is empty, Cure Cafe logs the verification link to the API console and also returns a dev-only verification link. In production, SMTP must be configured or email verification will fail safely.

> For Gmail, use a Gmail App Password, not your normal Gmail password.

---

## 5. Database Schema Summary

Core PostgreSQL-backed tables in `apps/api/prisma/schema.prisma`:

- `User`: staff and patient users with roles, password hash, email verification fields and refresh token hash.
- `Patient`: admitted/discharged patient profile, ward, room, bed, preferences, allergies and current diet.
- `DietPrescription`: doctor-created dietary recommendation pending dietician approval.
- `DietPlan`: approved/customized diet plan assigned to patient.
- `MealSchedule`: breakfast/lunch/snacks/dinner serve schedule.
- `MealOrder`: generated patient meal order with status workflow.
- `MealStatusHistory`: audit trail for prepared/packed/dispatched/delivered transitions.
- `MenuItem`: kitchen-posted food sets, individual items and customizable items with nutrition data.
- `FoodOrder`: patient menu orders with kitchen/delivery workflow and billing link.
- `FoodOrderItem`: ordered menu lines with quantity, price and nutrient snapshots.
- `FoodOrderStatusHistory`: audit trail for patient menu order tracking.
- `InventoryItem`: stock, unit, threshold, expiry and cost.
- `InventoryTxn`: purchase/consumption/adjustment/wastage transaction ledger.
- `BillingCharge`: meal and manual charges attached to patient bill.
- `Notification`: in-app/email/SMS notification records.
- `Feedback`: taste/quality/quantity/timing ratings.
- `FoodWastage`: wastage reporting.
- `FileAsset`: uploaded patient reports, diet charts and food images.

---

## 6. API Endpoints

Base URL: `http://localhost:4000/api`

### Auth

- `POST /auth/register`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Users

- `GET /users`
- `POST /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`

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

### Patient Menu and Food Orders

- `GET /menu/types`
- `GET /menu/items`
- `POST /menu/items`
- `PATCH /menu/items/:id`
- `DELETE /menu/items/:id`
- `POST /menu/orders`
- `GET /menu/orders`
- `GET /menu/orders/:id`
- `PATCH /menu/orders/:id/status`

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

---

## 7. PostgreSQL Setup Options

You only need one of these options.

### Option A: Docker Desktop, easiest

Install Docker Desktop, then run:

```bash
cd hfms
docker compose up -d postgres adminer
```

This starts:

- PostgreSQL on `localhost:5432`
- Adminer database UI on `http://localhost:8080`

Adminer login:

```txt
System: PostgreSQL
Server: postgres
Username: postgres
Password: postgres
Database: cure_cafe
```

Local API connection string:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cure_cafe?schema=public"
```

### Option B: Native PostgreSQL install

#### Windows

1. Download PostgreSQL installer from the official PostgreSQL website.
2. Install PostgreSQL.
3. Remember the password you set for the `postgres` user.
4. Open pgAdmin or SQL Shell.
5. Create the database:

```sql
CREATE DATABASE cure_cafe;
```

Then set:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/cure_cafe?schema=public"
```

#### macOS with Homebrew

```bash
brew install postgresql@16
brew services start postgresql@16
createdb cure_cafe
```

If your macOS username is the DB user:

```env
DATABASE_URL="postgresql://YOUR_MAC_USERNAME@localhost:5432/cure_cafe?schema=public"
```

Or create a `postgres` user/password if you prefer.

#### Ubuntu / Debian

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres psql
```

Inside `psql`:

```sql
ALTER USER postgres PASSWORD 'postgres';
CREATE DATABASE cure_cafe;
\q
```

Then use:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cure_cafe?schema=public"
```

---

## 8. Run Locally

### With Docker PostgreSQL

```bash
cd hfms
npm run setup
npm run dev
```

The setup command will:

1. Install dependencies.
2. Start PostgreSQL and Adminer through Docker Compose.
3. Push the Prisma schema into PostgreSQL.
4. Seed demo data.

Open:

- Web: `http://localhost:5173`
- API health: `http://localhost:4000/health`
- Adminer: `http://localhost:8080`

### Without Docker

Start your local PostgreSQL manually first, then run:

```bash
cd hfms
npm install
npm run db:push -w apps/api
npm run db:seed -w apps/api
npm run dev
```

### Reset demo data

```bash
npm run db:reset -w apps/api
```

### Smoke test

```bash
npm run smoke:test
```

---

## 9. Seeded Credentials

The login page intentionally does **not** display demo credentials.

| Role | Email | Password |
|---|---|---|
| Admin | `devloper7even@gmail.com` | `Password7` |
| Doctor | `doctor@curecafe.test` | `Admin@1234` |
| Dietician | `dietician@curecafe.test` | `Admin@1234` |
| Kitchen Staff | `kitchen@curecafe.test` | `Admin@1234` |
| Delivery Staff | `delivery@curecafe.test` | `Admin@1234` |
| Patient | `patient@curecafe.test` | `Admin@1234` |

All seeded accounts are already email-verified for testing.

---

## 10. RBAC Summary

- **Admin**: all modules, users, billing status and reports.
- **Doctor**: patients and prescriptions.
- **Dietician**: patients, diet approvals/customization, billing and reports.
- **Kitchen Staff**: schedules, meal preparation/packing, publish menu items, prepare menu orders, inventory and kitchen reports.
- **Delivery Staff**: dispatch scheduled meals and deliver patient menu orders after payment confirmation.
- **Patient**: own profile, own meals, menu ordering, own order tracking, own bills, feedback and notifications.

---

## 11. Deployment Notes

`render.yaml` is configured for a one-service deployment with a PostgreSQL database.

The API serves the React production build when `NODE_ENV=production`, so Cure Cafe can run as one web service.

Render build command:

```bash
npm ci --include=dev && npm run db:push -w apps/api && npm run db:seed -w apps/api && npm run build -w apps/web
```

Render start command:

```bash
npm run start -w apps/api
```

Before enabling public registration in production, configure:

```env
APP_URL="https://your-deployed-domain.com"
SMTP_HOST="your-smtp-host"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-smtp-user"
SMTP_PASS="your-smtp-password"
SMTP_FROM="Cure Cafe <your-from-email>"
```

For production, use a managed PostgreSQL database with backups. Do not use local uploads for important patient documents; replace local storage with S3/GCS or another object storage provider.

---

## 12. Important Notes

- The app targets PostgreSQL by default.
- `db:seed` is safe/idempotent: it skips seeding if demo data already exists.
- `db:reset` will wipe and recreate demo data.
- Public registration requires email verification before login.
- In production, SMTP must be configured for registration/verification emails.
- SMS notifications are adapter stubs in the MVP. In-app notifications are persisted and functional.
- Local uploads are saved in `apps/api/uploads`; production should use object storage.
