# OptiTrace Admin Web

Admin dashboard for the OptiTrace platform, built with Next.js App Router, Firebase (Auth + Firestore), and server-side Firebase Admin APIs.

## What This App Does

- Authenticated admin login using Firebase Authentication
- Role-based authorization for `admin` and `master_admin`
- Doctor onboarding workflow:
  - Review pending doctor verification requests
  - Approve/reject pending doctors
  - Revoke access from approved doctors
  - Require admin-provided reasons for reject/revoke actions
  - Trigger transactional email notifications for approval/rejection/revocation
- Analytics dashboard for screenings:
  - Total scans, verification status, agreement rate
  - Disease distribution, trend charts, seasonality chart
  - Manual date range filtering and preset range filters
  - CSV export
- Master-admin-only account provisioning for new admin users
- Master-admin role governance for all users (`Manage Roles`)
- Settings screen for:
  - theme preference (light/dark) with persistence
  - password change with secure re-authentication

## Tech Stack

- Framework: Next.js 16 (App Router)
- Language: TypeScript + React 19
- Styling: Tailwind CSS v4 + custom CSS
- Auth/DB: Firebase Auth + Firestore
- Admin/Server APIs: Firebase Admin SDK
- Email: Nodemailer (Gmail app password transport)
- Charts/Visualizations: Recharts
- Motion/Animation: Framer Motion

## Project Structure

```text
src/
  app/
    api/
      create-admin/route.ts
      send-approval-email/route.ts
      send-rejection-email/route.ts
      send-revoke-email/route.ts
      update-user-role/route.ts
    dashboard/
      analytics/page.tsx
      approvals/page.tsx
      components/ReasonModal.tsx
      create-admin/page.tsx
      layout.tsx
      manage-doctors/page.tsx
      manage-roles/page.tsx
      page.tsx
      settings/page.tsx
    login/page.tsx
    layout.tsx
    page.tsx
    globals.css
  lib/
    firebase.ts
    firebaseAdmin.ts
```

## Routing Map

- `/` -> redirects to `/login`
- `/login` -> admin sign-in form
- `/dashboard` -> overview/command-center metrics
- `/dashboard/approvals` -> pending doctor verification queue
- `/dashboard/manage-doctors` -> approved doctors and revoke flow
- `/dashboard/analytics` -> metrics, filters, charts, CSV export
- `/dashboard/settings` -> password update form
- `/dashboard/create-admin` -> create admin account (master-admin only)
- `/dashboard/manage-roles` -> role management for all users (master-admin only, password-gated)

API routes:

- `POST /api/create-admin` -> create Firebase Auth user + Firestore `users` doc (requires bearer token + `master_admin`)
- `POST /api/send-approval-email` -> sends approval notification email
- `POST /api/send-rejection-email` -> sends rejection notification email (includes admin reason)
- `POST /api/send-revoke-email` -> sends access revocation email
- `POST /api/update-user-role` -> updates a user's role (requires bearer token + `master_admin`)

## Authorization and Access Control

Client-side guards:

- Login checks `users/{uid}.role` and only permits `admin` or `master_admin`
- Dashboard layout enforces authenticated session and role checks
- Create Admin page verifies current user role is `master_admin`
- Manage Roles page verifies current user role is `master_admin`
- Manage Roles page requires password re-authentication before role editor is shown

Server-side guard:

- `/api/create-admin` validates Firebase ID token and confirms caller role is `master_admin` before creating a new admin
- `/api/update-user-role` validates Firebase ID token and confirms caller role is `master_admin` before role changes

## Firestore Data Expectations

### `users` collection

Used fields (inferred from app code):

- `uid: string`
- `email: string`
- `displayName?: string`
- `name?: string`
- `role: "patient" | "doctor" | "admin" | "master_admin"`
- `verificationStatus: "none" | "pending" | "approved" | "rejected"` (current flows use `pending`, `approved`, `none`)
- `badgeUrl?: string`
- `createdAt?: string`

### `screenings` collection

Used fields:

- `patientId?: string`
- `patientName?: string`
- `patientDisplayName?: string`
- `aiDiagnosis?: string`
- `finalDiagnosis?: string`
- `createdAt?: Timestamp | string`
- `timestamp?: Timestamp | string`

## Environment Variables

Create `.env.local` with the following keys (do not commit real secrets):

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

EMAIL_USER=
EMAIL_APP_PASSWORD=
```

Notes:

- `NEXT_PUBLIC_*` values are used by client Firebase SDK initialization
- `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` are used by Firebase Admin SDK
- `FIREBASE_PRIVATE_KEY` should preserve newlines (the code supports escaped `\n`)
- `EMAIL_USER`/`EMAIL_APP_PASSWORD` are used by Nodemailer Gmail transport

## Theme System

- Theme preference is stored in `localStorage` under `optitrace-theme`
- Theme is applied via `html.dark` class and CSS variables in `globals.css`
- Settings page controls theme selection
- Dashboard layout re-applies saved theme on page refresh

## Local Development

1. Install dependencies:

```bash
npm install
```

1. Add environment variables in `.env.local`
1. Start dev server:

```bash
npm run dev
```

1. Open [http://localhost:3000](http://localhost:3000)

## Available Scripts

- `npm run dev` - start development server
- `npm run build` - create production build
- `npm run start` - run production server
- `npm run lint` - run ESLint checks

## Feature Details

### Login

- Uses `signInWithEmailAndPassword`
- Immediately fetches Firestore role document
- Non-admin roles are signed out and blocked

### Approvals

- Real-time snapshot query for `verificationStatus == "pending"`
- Approve action updates status and role to `doctor`
- Reject action requires a reason
- Reject action updates verification status to `none`
- Approval email sent via server API
- Rejection email sent via server API (includes reason)

### Manage Doctors

- Real-time snapshot query for `role == "doctor"` and `verificationStatus == "approved"`
- Revoke action requires a reason
- Revoke action sets role to `patient`, verification status to `none`
- Revocation email sent via server API (includes reason)

### Analytics

- Reads all `screenings` documents and derives:
  - agreement/accuracy metrics
  - disease distribution
  - scan volume over time
  - seasonality trends
  - unverified counts
- Supports custom date range filtering
- Supports preset filters (`Today`, `Last 7 Days`, `Last 30 Days`, `Quarterly`, `Yearly`, `All Time`, `Custom`)
- CSV report export from filtered dataset
- Scan volume series is chronologically sorted before chart rendering

### Settings

- Theme preferences (`Light` / `Dark`)
- Requires current password re-authentication for password changes
- Calls Firebase Auth `updatePassword` after successful re-auth

### Create Admin

- Client sends authenticated bearer token
- Server verifies token + role
- Creates Firebase Auth account + Firestore profile with `role: "admin"`

### Manage Roles (Master Admin)

- Lists all users from Firestore in real time
- Includes search by user name
- Allows selecting and saving roles:
  - `patient`, `doctor`, `admin`, `master_admin`
- Page requires password confirmation before role table is unlocked
- Saves via protected `/api/update-user-role`

## Security Notes

- Keep `.env.local` secret and out of version control
- Rotate any exposed credentials immediately if they were ever shared
- Use least-privilege Firebase and email accounts in production
- Prefer server-side authorization for all sensitive writes
- Re-authentication gate is enabled for Manage Roles UI access

## Current Limitations / Improvements

- No test suite yet (unit/integration/e2e)
- Email routes are currently callable without explicit auth checks
- Metadata in root layout still contains default Next.js template values
- No explicit error-boundary UI for server/API failures
- Chart pages fetch full collections client-side; large datasets may need pagination/aggregation

## Deployment

Any Next.js-compatible host works (Vercel recommended).

High-level production checklist:

- Set all environment variables in host secrets
- Validate Firebase Admin credentials in runtime
- Validate outbound email provider configuration
- Run `npm run build` and `npm run lint` in CI
- Confirm Firestore security rules align with admin workflows
