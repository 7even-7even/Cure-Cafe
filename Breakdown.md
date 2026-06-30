# Cure Cafe Project Breakdown

This document explains the full Cure Cafe workspace structure and the purpose of each folder/file. Generated dependency/build folders such as `node_modules/` and `apps/web/dist/` are intentionally not explained file-by-file because they are generated artifacts and should not be edited manually.

---

## High-Level Workspace Tree

```text
hfms/
  .env.example
  .gitignore
  README.md
  Breakdown.md
  docker-compose.yml
  package.json
  package-lock.json
  render.yaml
  apps/
    api/
      .env
      .env.example
      package.json
      prisma/
        schema.prisma
        seed.js
      scripts/
        smoke-test.js
      src/
        app.js
        server.js
        constants.js
        config/
          env.js
          prisma.js
        middleware/
          auth.js
          errorHandler.js
          validate.js
        services/
          email.service.js
          notification.service.js
        utils/
          apiError.js
          asyncHandler.js
          date.js
          json.js
        modules/
          auth/
            auth.routes.js
          billing/
            billing.routes.js
          diets/
            diets.routes.js
          feedback/
            feedback.routes.js
          files/
            upload.js
          inventory/
            inventory.routes.js
          meals/
            meals.routes.js
          menu/
            menu.routes.js
          notifications/
            notifications.routes.js
          patients/
            patients.routes.js
          reports/
            reports.routes.js
          users/
            users.routes.js
    web/
      index.html
      package.json
      postcss.config.js
      tailwind.config.js
      vite.config.js
      public/
        favicon.svg
        logo.svg
      src/
        App.jsx
        index.css
        main.jsx
        app/
          store.js
        components/
          Badge.jsx
          BrandLogo.jsx
          DataState.jsx
          Layout.jsx
          NutrientPie.jsx
          OrderTracker.jsx
          ProtectedRoute.jsx
          StatCard.jsx
        features/
          auth/
            authSlice.js
        pages/
          BillingPage.jsx
          DashboardPage.jsx
          DeliveriesPage.jsx
          DietsPage.jsx
          FeedbackPage.jsx
          InventoryPage.jsx
          KitchenPage.jsx
          LoginPage.jsx
          MealsPage.jsx
          MenuPage.jsx
          OrdersPage.jsx
          NotificationsPage.jsx
          PatientsPage.jsx
          RegisterPage.jsx
          ReportsPage.jsx
          UsersPage.jsx
          VerifyEmailPage.jsx
        services/
          api.js
        utils/
          format.js
```

---

# Root Files

## `.env.example`

Root reference environment file. It documents the main environment variables used by the API, including PostgreSQL connection string, JWT secrets, CORS, app URL and SMTP settings. The actual runtime environment for the backend is `apps/api/.env`.

## `.gitignore`

Defines files and folders that should not be committed, such as:

- `node_modules/`
- `.env`
- database files
- uploads
- frontend build output
- logs

## `README.md`

Main project documentation. It explains architecture, setup, PostgreSQL installation options, API endpoints, seeded credentials, RBAC, SMTP email verification and deployment notes.

## `Breakdown.md`

This file. It gives a file-by-file explanation of the project.

## `docker-compose.yml`

Defines local infrastructure for development:

- `postgres`: PostgreSQL 16 database container.
- `adminer`: lightweight database web UI at `http://localhost:8080`.
- `cure_cafe_postgres_data`: Docker volume that persists local PostgreSQL data.

This is the easiest way to run PostgreSQL locally without installing PostgreSQL directly.

## `package.json`

Root npm workspace config. It coordinates the backend and frontend apps.

Important scripts:

- `postgres:up`: starts PostgreSQL and Adminer with Docker Compose.
- `postgres:down`: stops the Docker Compose services.
- `setup`: installs dependencies, starts PostgreSQL, pushes schema and seeds data.
- `dev`: runs API and web app together.
- `build`: builds the frontend.
- `smoke:test`: runs backend smoke tests.

## `package-lock.json`

Locks exact npm package versions for deterministic installs across machines and deployments.

## `render.yaml`

Render Blueprint deployment file. It defines:

- a PostgreSQL database service
- a Node web service for Cure Cafe
- build/start commands
- required environment variables

The API serves the frontend build in production, so the app can deploy as a single web service.

---

# Backend: `apps/api/`

The backend is a Node.js + Express.js REST API using Prisma and PostgreSQL.

## `apps/api/.env`

Local backend environment variables. Contains development database URL, JWT secrets, app URL, CORS origin and SMTP values.

Important: in a real production repo, do not commit real secrets.

## `apps/api/.env.example`

Template environment file for other developers or deployments.

## `apps/api/package.json`

Backend package definition.

Important scripts:

- `dev`: starts API with nodemon.
- `start`: starts API with Node.
- `db:push`: pushes Prisma schema to database.
- `db:migrate`: creates/runs Prisma migrations during development.
- `db:deploy`: deploys migrations in production.
- `db:generate`: generates Prisma Client.
- `db:seed`: seeds demo data.
- `db:reset`: resets schema and reseeds demo data.
- `smoke:test`: checks core API endpoints.

---

## Backend Prisma: `apps/api/prisma/`

### `schema.prisma`

The database schema and Prisma datasource/client configuration.

Current datasource:

```prisma
provider = "postgresql"
```

Main models:

- `User`
- `Patient`
- `DietPlan`
- `DietPrescription`
- `MealSchedule`
- `MealOrder`
- `MealStatusHistory`
- `MenuItem`
- `FoodOrder`
- `FoodOrderItem`
- `FoodOrderStatusHistory`
- `InventoryItem`
- `InventoryTxn`
- `BillingCharge`
- `Notification`
- `Feedback`
- `FoodWastage`
- `FileAsset`

The `User` model includes email verification fields:

- `emailVerifiedAt`
- `emailVerificationTokenHash`
- `emailVerificationExpiresAt`

### `seed.js`

Seeds PostgreSQL with Cure Cafe demo data:

- Admin account
- Doctor
- Dietician
- Kitchen staff
- Delivery staff
- Patient user
- Sample admitted patients
- Diet plans and prescriptions
- Meal schedules
- Meal orders
- Inventory items and transactions
- Notifications
- Feedback

The seed is idempotent by default. If demo data exists, it skips. Use `db:reset` to wipe and reseed.

Seeded admin:

```txt
Email: devloper7even@gmail.com
Password: Password7
Name: Admin
```

---

## Backend Scripts: `apps/api/scripts/`

### `smoke-test.js`

Starts the API on a random local port and tests basic functionality:

- health endpoint
- admin login
- current user endpoint
- patients endpoint
- diet types endpoint
- kitchen dashboard endpoint
- low-stock endpoint
- daily meals report endpoint

Useful for verifying the backend after setup.

---

## Backend Source Root: `apps/api/src/`

### `app.js`

Creates and configures the Express app.

Responsibilities:

- Helmet security headers
- CORS
- compression
- JSON parsing
- request logging
- auth rate limiting
- static uploads
- health check
- mounting all module routes
- serving frontend build in production
- 404 and error handling

### `server.js`

Starts the Express server on `env.PORT` and handles graceful shutdown.

Also handles:

- `SIGINT`
- `SIGTERM`
- unhandled promise rejections
- uncaught exceptions

### `constants.js`

Central constants used across backend modules:

- roles
- diet types
- restrictions
- meal types
- meal statuses
- prescription statuses
- inventory transaction types
- billing statuses
- notification types/channels
- diet costs

---

# Backend Config: `apps/api/src/config/`

### `env.js`

Loads and validates environment variables using Zod.

Includes:

- database URL
- JWT secrets
- token TTLs
- CORS origin
- upload directory
- app URL
- email verification TTL
- SMTP config

### `prisma.js`

Creates and exports a singleton Prisma Client instance.

All database queries use this client.

---

# Backend Middleware: `apps/api/src/middleware/`

### `auth.js`

Authentication and authorization middleware.

Responsibilities:

- verify JWT access tokens
- load current user from database
- block inactive users
- block unverified users
- attach `req.user`
- role authorization with `authorize(...)`
- sign access/refresh tokens
- hash refresh/verification tokens

### `errorHandler.js`

Central Express error handler.

Handles:

- API errors
- Prisma duplicate errors
- Prisma not-found errors
- JWT errors
- validation and unexpected errors

Returns consistent JSON responses.

### `validate.js`

Zod validation middleware.

It validates:

- `req.body`
- `req.query`
- `req.params`

Invalid requests return HTTP 400.

---

# Backend Services: `apps/api/src/services/`

### `email.service.js`

SMTP/Nodemailer email service.

Used for account verification emails.

Behavior:

- In development without SMTP, logs the verification link to the API console.
- In production without SMTP, fails safely.
- Sends formal verification emails when SMTP is configured.

### `notification.service.js`

Creates in-app notifications and provides stubs for email/SMS-style notification channels.

Used for:

- diet changes
- low-stock alerts
- pending delivery alerts
- general notifications

---

# Backend Utilities: `apps/api/src/utils/`

### `apiError.js`

Defines `ApiError`, a custom error class with:

- HTTP status code
- message
- optional details

### `asyncHandler.js`

Wraps async Express route handlers and forwards errors to the centralized error handler.

Prevents repeated `try/catch` blocks.

### `date.js`

Date helper functions:

- start of day
- end of day
- parse date or today
- combine date and time
- add days

Used heavily by meal scheduling and reports.

### `json.js`

Helpers for storing JSON-like data in text fields and hydrating it back into arrays/objects.

Used for:

- allergies
- restrictions
- preferences
- notification metadata

---

# Backend Modules: `apps/api/src/modules/`

Each module owns one domain of the system.

## `auth/auth.routes.js`

Authentication module.

Endpoints:

- register patient account
- send verification email
- verify email token
- resend verification email
- login
- refresh token
- logout
- current user

Important behavior:

- self-registered accounts are inactive until email verification
- login is blocked if email is not verified
- unverified login attempts send a fresh verification email
- verification tokens are hashed before storing in PostgreSQL

## `users/users.routes.js`

Admin-only user management.

Supports:

- list users
- create staff/user accounts
- update users
- deactivate users

Admin-created users are marked as verified because they are provisioned by an authorized admin.

## `patients/patients.routes.js`

Patient admission and meal profile management.

Supports:

- register admitted patients
- assign ward/room/bed
- track admission/discharge
- preferences/allergies/restrictions
- patient file upload/list
- patient self-access restrictions

## `diets/diets.routes.js`

Doctor and dietician workflow.

Supports:

- diet types/restrictions lookup
- doctor prescriptions
- dietician approval/rejection
- custom diet plans
- active diet assignment
- kitchen notifications on diet changes

## `meals/meals.routes.js`

Meal scheduling, kitchen dashboard and delivery workflow.

Supports:

- meal schedule list/update
- generating daily meal orders
- listing meal orders
- status transitions
- billing charge creation after delivery
- kitchen dashboard aggregation

Meal status workflow:

```text
SCHEDULED -> PREPARED -> PACKED -> DISPATCHED -> DELIVERED
```

## `menu/menu.routes.js`

Patient menu and made-to-order food ordering module.

Supports:

- kitchen/admin publishing menu items
- item types such as normal sets, jumbo sets, individual items and customizable bowls
- nutrient metadata for calories, carbs, proteins, fats, vitamins, fiber and sodium
- patient food order placement
- billing charge creation at order placement
- kitchen order acceptance/preparation/ready workflow
- delivery pickup/delivered workflow
- payment confirmation on delivery
- patient, kitchen and delivery notifications

Food order workflow:

```text
PLACED -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP -> OUT_FOR_DELIVERY -> DELIVERED
```

## `inventory/inventory.routes.js`

Inventory operations.

Supports:

- inventory item CRUD
- purchase/consumption/adjustment/wastage transactions
- low-stock alerts
- expiry tracking
- daily consumption reports

## `billing/billing.routes.js`

Meal billing module.

Supports:

- list charges
- create manual charges
- update billing status
- patient billing summary

Delivered meals automatically create posted billing charges.

## `reports/reports.routes.js`

Analytics/reporting module.

Supports:

- daily meals served
- diet-wise distribution
- food wastage report
- manual wastage creation
- inventory consumption report
- monthly expenditure report

## `notifications/notifications.routes.js`

Notification inbox module.

Supports:

- list notifications
- create admin notifications
- mark notifications read
- delete notifications

Users see direct notifications and role-targeted notifications.

## `feedback/feedback.routes.js`

Patient meal feedback module.

Supports:

- create feedback
- list feedback
- average rating summary

Patients rate:

- taste
- quality
- quantity
- delivery timing

## `files/upload.js`

Multer upload configuration for patient files.

Supports local upload of:

- PDF
- JPG
- PNG
- WEBP
- text files

Production should replace this with object storage.

---

# Frontend: `apps/web/`

The frontend is a React + Vite + Tailwind app.

## `apps/web/index.html`

HTML entry point loaded by Vite.

Includes:

- app root div
- Cure Cafe title
- favicon
- meta description

## `apps/web/package.json`

Frontend package definition.

Important scripts:

- `dev`: starts Vite dev server
- `build`: creates production build
- `preview`: previews production build locally

## `apps/web/postcss.config.js`

PostCSS config used by Tailwind and Autoprefixer.

## `apps/web/tailwind.config.js`

Tailwind theme configuration.

Defines Cure Cafe brand colors:

- emerald clinical tones
- warm cafe orange tones
- cream/espresso accents
- soft/glow shadows

## `apps/web/vite.config.js`

Vite config.

Includes dev proxy:

- `/api` -> backend API on port 4000
- `/uploads` -> backend uploads
- `/health` -> backend health endpoint

---

# Frontend Public Assets: `apps/web/public/`

## `logo.svg`

Custom Cure Cafe SVG logo.

Represents:

- clinical cross
- warm meal bowl
- cafe/hospital nutrition theme

## `favicon.svg`

Browser favicon version of the Cure Cafe logo.

---

# Frontend Source: `apps/web/src/`

## `main.jsx`

React entry point.

Mounts the app into the DOM and wraps it with Redux Provider.

## `App.jsx`

Defines all frontend routes:

- `/login`
- `/register`
- `/verify-email`
- protected dashboard routes
- module pages

Uses `ProtectedRoute` for auth/role guarding.

## `index.css`

Global CSS and Tailwind layers.

Defines:

- app background gradients
- base font styles
- reusable component classes like `card`, `btn-primary`, `btn-secondary`, `input`, `label`, `badge`

---

# Frontend Store: `apps/web/src/app/`

## `store.js`

Redux store configuration.

Combines:

- auth reducer
- RTK Query API reducer
- RTK Query middleware

---

# Frontend Components: `apps/web/src/components/`

## `Badge.jsx`

Reusable status badge component.

Maps statuses like `DELIVERED`, `PENDING`, `APPROVED`, `PACKED` to visual styles.

## `BrandLogo.jsx`

Reusable Cure Cafe brand/logo component.

Used in:

- login page
- register page
- verification page
- sidebar
- dashboard hero

## `DataState.jsx`

Reusable loading/error wrapper for data-driven UI sections.

Displays:

- loading state
- API error state
- child content when successful

## `Layout.jsx`

Main authenticated application layout.

Includes:

- role-aware sidebar navigation
- mobile navigation
- header
- current user card
- logout button
- unread notification badge

## `NutrientPie.jsx`

Reusable nutrient visualization component.

Displays food item nutrition as a conic-gradient pie chart with nutrient percentages for carbs, protein, fats, vitamins and fiber.

## `OrderTracker.jsx`

Reusable order-progress tracker.

Shows patient menu order progress from placed to delivered and handles cancelled state styling.

## `ProtectedRoute.jsx`

Frontend route guard.

Responsibilities:

- redirect unauthenticated users to `/login`
- refresh/load current user
- enforce role-based route access

## `StatCard.jsx`

Reusable dashboard metric card.

Used for totals like patients, meals, low-stock items and billing.

---

# Frontend Auth Feature: `apps/web/src/features/auth/`

## `authSlice.js`

Redux auth state slice.

Stores:

- access token
- refresh token
- current user

Persists auth state to localStorage using `cure_cafe_auth`.

---

# Frontend Pages: `apps/web/src/pages/`

## `LoginPage.jsx`

Public login page.

Important behavior:

- no demo credentials are displayed
- verified users can login
- unverified users can request another verification email
- links to patient registration

## `RegisterPage.jsx`

Public patient registration page.

Creates an unverified/inactive account and sends a verification email.

## `VerifyEmailPage.jsx`

Public email verification page.

Reads token from URL and calls the backend verification endpoint.

## `DashboardPage.jsx`

Authenticated dashboard.

Shows:

- hero summary
- patient counts
- meals today
- low-stock alerts
- billing summary
- latest meal orders
- unread notifications

## `UsersPage.jsx`

Admin-only user management page.

Supports:

- list users
- create users
- deactivate users

## `PatientsPage.jsx`

Patient management page.

Supports:

- admitted patient list
- register patients
- preferences/restrictions/allergies
- discharge patient

## `DietsPage.jsx`

Doctor/dietician page.

Supports:

- prescribe diets
- approve/reject prescriptions
- assign direct diet plans
- view plan history

## `MealsPage.jsx`

Meal scheduling/tracking page.

Supports:

- view schedules
- generate meal orders
- update meal order statuses according to role

## `MenuPage.jsx`

Patient menu page and kitchen menu publishing page.

For patients, it shows available food sets, individual items and customizable options with nutrition pie charts and a cart. Placing an order creates a patient menu order and adds a billing charge.

For kitchen staff/admin, it provides a form to publish new menu items with price, category, ingredients, restrictions, allergens, customization options and nutrient values.

## `OrdersPage.jsx`

Patient menu order tracking and operations page.

For patients, it shows current and past menu orders with tracking.
For kitchen staff, it supports accepting, preparing and marking orders ready for pickup.
For delivery staff, it supports pickup/dispatch and marking delivered after payment confirmation.

## `KitchenPage.jsx`

Kitchen dashboard page.

Shows:

- diet-wise meal quantities
- ward-wise distribution
- status counts
- special meals

## `DeliveriesPage.jsx`

Delivery staff workflow page.

Supports:

- view packed/dispatched/delivered meals
- mark meals dispatched
- mark meals delivered

## `InventoryPage.jsx`

Inventory management page.

Supports:

- stock item list
- add inventory items
- record transactions
- low-stock alerts
- expiry alerts
- daily consumption summary

## `BillingPage.jsx`

Billing page.

Supports:

- list charges
- add manual charges
- mark charges paid
- patient billing summaries

## `ReportsPage.jsx`

Reports and analytics page.

Shows:

- daily meal counts
- diet distribution
- wastage cost
- inventory consumption
- monthly expenditure

Also supports recording manual food wastage.

## `NotificationsPage.jsx`

Notification inbox page.

Supports:

- list notifications
- mark read
- admin create notification

## `FeedbackPage.jsx`

Patient feedback page.

Supports:

- submit feedback as patient
- view feedback entries
- view average ratings

---

# Frontend Services: `apps/web/src/services/`

## `api.js`

Central RTK Query API client.

Responsibilities:

- base API URL
- attach JWT access token
- automatic refresh-token retry on 401
- define all frontend API endpoints/hooks

Includes hooks like:

- `useLoginMutation`
- `useRegisterMutation`
- `useVerifyEmailMutation`
- `usePatientsQuery`
- `useMealOrdersQuery`
- `useMenuItemsQuery`
- `useCreateFoodOrderMutation`
- `useFoodOrdersQuery`
- `useUpdateFoodOrderStatusMutation`
- `useInventoryItemsQuery`
- `useBillingChargesQuery`
- `useNotificationsQuery`

---

# Frontend Utilities: `apps/web/src/utils/`

## `format.js`

Frontend formatting helpers and constants.

Includes:

- role labels
- enum humanization
- date formatting
- time formatting
- INR currency formatting
- API error extraction
- role helper `can(user, roles)`

---

# Generated / Non-Editable Folders

## `node_modules/`

Installed npm dependencies. Generated by `npm install`. Do not edit manually.

## `apps/web/dist/`

Frontend production build output. Generated by `npm run build`. Do not edit manually.

## `apps/api/uploads/`

Local uploaded patient files. Generated at runtime. For production, replace with object storage.

---

# Important Execution Flow

## Local startup with Docker

```bash
npm run setup
npm run dev
```

Flow:

1. Docker starts PostgreSQL.
2. Prisma pushes schema.
3. Seed creates verified demo users and sample hospital data.
4. API starts on port 4000.
5. Vite frontend starts on port 5173.

## Registration + email verification flow

```text
Register page
  -> POST /api/auth/register
  -> create inactive user
  -> create hashed verification token
  -> send verification email
  -> user opens /verify-email?token=...
  -> POST /api/auth/verify-email
  -> activate user
  -> user can login
```

## Login flow

```text
Login page
  -> POST /api/auth/login
  -> validate password
  -> block if email not verified
  -> block if inactive
  -> issue access token + refresh token
  -> frontend stores auth in localStorage
```

## Meal operations flow

```text
Diet plan assigned
  -> meal orders generated
  -> kitchen prepares
  -> kitchen packs
  -> delivery dispatches
  -> delivery delivers
  -> billing charge is created
  -> patient can submit feedback
```

## Patient menu order flow

```text
Kitchen publishes menu item
  -> patient views nutrient pie chart
  -> patient adds items/customization to cart
  -> patient places order
  -> billing charge is created as pending
  -> kitchen accepts/prepares/marks ready
  -> delivery staff picks up
  -> delivery staff confirms payment and delivery
  -> billing charge becomes paid
  -> patient receives notifications throughout
```
