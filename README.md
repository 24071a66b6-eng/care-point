# CarePoint — Healthcare Management Dashboard

CarePoint is a responsive, full-stack dashboard for demonstrating fictional patient profiles, appointments, health measurements, laboratory results, care-team records, and patient-specific message threads. It uses plain HTML, CSS, and vanilla JavaScript in the browser, with an Express REST API and MongoDB persistence.

> **Demonstration software only.** All seeded people, messages, appointments, and measurements are fictional. This application is not a certified medical system and must not be used for real patient care or real patient information. It is not HIPAA-compliant.

## Features

- Database-backed overview statistics, activity, unread notifications, and upcoming appointments.
- Searchable patient directory, profile details, insurance fields, fictional vital readings, and blood-pressure charts.
- Diagnosis and laboratory record views, creation, and CSV export.
- Appointment create, edit, filter by status, and confirmed removal; scheduling conflicts return HTTP 409.
- Care-team directory with administrator-controlled create, edit, and removal.
- Patient-specific message history with validated message creation.
- JWT sign-in, bcrypt password hashes, role checks, rate-limited login, Helmet headers, server-side validation, and centralized JSON errors.
- Responsive layouts, keyboard-operable controls, loading/empty/error feedback, and accessible dialogs/toasts.

## Technology and architecture

- Node.js 20+, Express 4, Mongoose 8, MongoDB
- HTML5, CSS3, vanilla ES modules-in-spirit JavaScript, Chart.js, Font Awesome
- Node's built-in test runner, Supertest, and MongoDB Memory Server

```text
server.js
src/
  app.js
  middleware/       authentication, request validation, error responses
  models/           User, Patient, Appointment, Diagnosis, LabResult, TeamMember,
                    Message, Notification, Activity
  routes/           authentication and resource REST endpoints
  seed/             repeatable fictional dataset
  utils/            async, HTTP error, and record helpers
public/
  index.html
  css/style.css
  js/api.js         centralized Fetch API client
  js/app.js         dashboard rendering and interactions
tests/api.test.js
```

## Prerequisites

- Node.js 20 or newer and npm.
- MongoDB locally, or a MongoDB Atlas database.

## Install and configure

In PowerShell:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env`. Use a unique random JWT secret of at least 32 characters and a strong initial administrator password of at least 12 characters. Never commit `.env`.

| Variable | Required | Purpose |
|---|---:|---|
| `PORT` | No | HTTP port; defaults to `3000` and uses the hosting provider's port when supplied. |
| `NODE_ENV` | No | Set to `production` for hosted deployment. |
| `MONGODB_URI` | Yes | Local MongoDB or Atlas connection string. |
| `JWT_SECRET` | Yes | Random signing key of at least 32 characters. |
| `JWT_EXPIRES_IN` | No | Token lifetime; defaults to `8h`. |
| `INITIAL_ADMIN_EMAIL` | For seeding | Email for the initial administrator account. |
| `INITIAL_ADMIN_PASSWORD` | For seeding | Initial password; at least 12 characters. |

Example local development configuration:

```dotenv
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/carepoint_dashboard
JWT_SECRET=replace_with_a_long_random_secret_at_least_32_characters
JWT_EXPIRES_IN=8h
INITIAL_ADMIN_EMAIL=admin@example.test
INITIAL_ADMIN_PASSWORD=replace_with_a_unique_password
```

The sample values above are placeholders, not usable credentials. The seeder refuses to run without the admin settings. On each run, it replaces only its `CP-DEMO-*` patient records and `@carepoint.example.test` team members, plus the named demo notifications/activity; it does not clear unrelated patient records or users. The configured initial admin is upserted, so seeding resets that account password to the configured value.

## Run locally

Start MongoDB, then:

```powershell
npm run seed
npm run dev
```

Open `http://localhost:3000`. Sign in with `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` from `.env`. For a normal production process use `npm start`.

## Authentication and authorization

- `POST /api/auth/login` issues a signed bearer token; `GET /api/auth/me` validates it.
- The browser keeps the token in `sessionStorage` for the current tab. Sign out removes it. A token stored this way is accessible to same-origin JavaScript; this demo has no independent security assessment.
- Passwords are bcrypt-hashed. Login requests are rate limited. API routes (except health and login) require an authenticated bearer token.
- The `admin`, `clinician`, and `staff` roles are included in the token. Admins can manage the care-team roster and delete patients; admins and clinicians can create patient profiles. All signed-in roles can view records and perform the operations permitted to their role. The seed process provisions the initial admin; there is no public registration or role-management UI.
- Every authorized staff account can access the same fictional patient dataset. There is no patient ownership, organization tenancy, audit-grade access tracking, CSRF/session-cookie architecture, or real-time delivery.

## REST API

Successful collection reads return `{ "data": [], "pagination": { "page": 1, "limit": 25, "total": 0, "pages": 0 } }`. Single-resource responses use `{ "data": { ... } }`. Errors use `{ "error": { "code": "...", "message": "...", "details": [] } }`.

All endpoints other than health and login require `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Server/database health. HTTP 503 when MongoDB is disconnected. |
| POST | `/api/auth/login` | Sign in with `{ "email": "...", "password": "..." }`. |
| GET | `/api/auth/me` | Current token identity. |
| GET | `/api/dashboard/summary` | Database-backed patient, appointment, team, and unread counts. |
| GET | `/api/dashboard/activity` | Recent activity records. |
| GET | `/api/patients?q=...&page=1&limit=25` | Search and paginate patients. |
| GET/POST | `/api/patients`, `/api/patients/:id` | List/create and read/update/delete patient records. |
| GET/POST | `/api/patients/:patientId/diagnoses` | List or add a patient's diagnoses. |
| PATCH/DELETE | `/api/diagnoses/:id` | Update or remove a diagnosis. |
| GET/POST | `/api/patients/:patientId/labs` | List or add laboratory results. |
| PATCH/DELETE | `/api/labs/:id` | Update or remove a laboratory result. |
| GET/POST | `/api/appointments` | List/filter and create appointments. Filters include `patient`, `status`, `from`, `to`, `page`, and `limit`. |
| GET/PATCH/DELETE | `/api/appointments/:id` | Read, update, or remove an appointment. Conflicting active patient/professional schedules return 409. |
| GET/POST | `/api/teams` | List or create care-team members. |
| GET/PATCH/DELETE | `/api/teams/:id` | Read, update, or remove a team member. Active assignments prevent removal (409). |
| GET/POST | `/api/patients/:patientId/messages` | Read a patient's thread or add a staff message. |
| GET | `/api/messages/:id` | Read a single message. |
| GET | `/api/notifications` | List persisted demonstration notifications and unread count. |
| PATCH | `/api/notifications/:id/read` | Mark a notification read. |

Example appointment request:

```json
{
  "patient": "MONGODB_PATIENT_ID",
  "teamMember": "MONGODB_TEAM_MEMBER_ID",
  "scheduledAt": "2027-01-15T10:30:00.000Z",
  "type": "Fictional follow-up",
  "status": "Scheduled",
  "notes": "Demonstration record"
}
```

Create operations return HTTP 201, successful updates 200, deletions 204, invalid input 400, unauthenticated/forbidden requests 401/403, missing resources 404, conflicts 409, and rate-limited login attempts 429.

## Tests and checks

```powershell
npm test
npm run check
```

The API tests use an isolated in-memory MongoDB instance, not a configured production database. MongoDB Memory Server may need to download its compatible MongoDB binary on its first run. The test suite covers health and disconnected health states, authentication, unknown routes, patient search/missing/invalid records, appointment persistence/conflicts, team validation, message validation, and summary counts. Browser automation, cross-device visual inspection, Atlas connectivity, and a production deployment are not part of the automated test suite.

## Deployment (Render + MongoDB Atlas)

1. Create a MongoDB Atlas cluster and a database user with only the permissions needed for this app. Restrict Atlas network access to the hosting provider's outbound addresses where available; do not use unrestricted access for a real deployment.
2. Push this project to a private or public Git repository. Do not include `.env`.
3. In Render, choose **New → Blueprint**, connect the repository, and let Render read [`render.yaml`](./render.yaml). The blueprint creates the `care-point` web service, installs with `npm ci`, starts with `npm start`, and uses `/api/health` for health checks. Alternatively, create a Web Service manually with those build/start/health-check settings.
4. In the Render service's Environment settings, supply `MONGODB_URI`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD`. Render generates `JWT_SECRET` from the Blueprint. Do not paste credentials into source files or commit them. The hosting platform provides `PORT`.
5. Before using the deployed app, seed Atlas from your local machine: copy `.env.example` to `.env`, set `MONGODB_URI` to the same Atlas database URI, set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` to the values configured in Render, then run `npm run seed`. The seeder resets the configured admin password and replaces its named demo records each time it runs. Keep `.env` local and uncommitted.
6. Confirm `/api/health` returns HTTP 200 and `{"data":{"status":"ok","database":"connected"}}`, then verify sign-in and core workflows. Never enter real patient information.

The GitHub Actions workflow runs syntax checks and the API test suite on pushes to `main` and pull requests.

The Express service serves the frontend from `public/`; browser API calls use same-origin relative URLs. Troubleshoot a failed health check by checking the host logs, Atlas credentials/IP access, TLS-enabled Atlas URI, and environment variable names. Startup deliberately fails when MongoDB configuration or a sufficiently long JWT secret is missing.

## Limitations and security notes

- Not certified, not HIPAA-compliant, and not intended for any real patient care or real health records.
- Demonstration vitals/labs are generated fictional values; the app makes no medical diagnoses or treatment recommendations.
- Authentication is suitable for a classroom demonstration only. No account recovery, registration, MFA, configurable token revocation, per-record authorization, multi-tenant isolation, production security assessment, or compliance controls are implemented.
- Notifications and activity are durable, shared workspace records rather than per-user records. No real-time event delivery is claimed.
- Chart.js and Font Awesome load from public CDNs; an internet connection is needed for those assets. If unavailable, the rest of the app still loads, but charts/icons may be absent.
- MongoDB cannot provide an atomic transaction for patient deletion on a standalone server; the API removes associated records and the patient record as a coordinated set of operations. Use a replica set and transactions before adapting the workflow beyond this demo.

## Screenshots

Screenshots are not included yet. Add verified desktop and mobile screenshots here if you capture them.

## Acknowledgments and attribution

- Chart.js is loaded from jsDelivr.
- Font Awesome Free icons and styles are loaded from cdnjs.
- No real patient datasets or clinical guidelines are included.
