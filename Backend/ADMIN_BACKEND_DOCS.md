# Admin Backend API Documentation

This document describes the **Admin Backend Module** APIs for the Event Management System.

## Tech Stack

- Node.js + Express.js
- MongoDB + Mongoose
- JWT Authentication
- Role-Based Access Control (RBAC)

## Base URL

- Default server port: `http://localhost:3000`
- Admin base path: `/api/admin`
- User base path: `/api/user`

## Authentication

### JWT header

For all protected admin APIs, send:

- `Authorization: Bearer <token>`

### Admin login

- **POST** `/api/admin/login`

**Request body**

```json
{ "email": "admin@example.com", "password": "yourPassword" }
```

**Response (success)**

```json
{
  "message": "Login successful",
  "token": "JWT_TOKEN_HERE",
  "admin": { "id": "...", "name": "...", "email": "...", "role": "admin" }
}
```

## Admin Auth APIs

- **POST** `/api/admin/register` (creates admin)
- **POST** `/api/admin/login` (returns JWT)
- **POST** `/api/admin/logout` (protected; stateless logout)

## Dashboard APIs

### Dashboard stats (counts)

- **GET** `/api/admin/dashboard/stats` (protected)

Returns totals of users, events, bookings, and events by status.

### Dashboard overview (EventCo-style)

- **GET** `/api/admin/dashboard/overview` (protected)

Returns cards + recent activity:

```json
{
  "activeEvents": 4,
  "bills": { "total": 10, "pending": 5 },
  "totalSpent": 855500,
  "paymentRequests": { "total": 5, "pending": 2 },
  "recentActivity": [
    {
      "id": "...",
      "type": "bill",
      "entityName": "Sharma Caterers",
      "detailLine": "Sneha Patel · IPL Season 2026",
      "initials": "SP",
      "amount": 45000,
      "status": "approved",
      "updatedAt": "2026-04-18T..."
    }
  ]
}
```

## Event Management APIs

### List events (includes computed `spent` and `lifecycleStatus`)

- **GET** `/api/admin/events` (protected)

Each event includes:

- `lifecycleStatus`: `active | closed | upcoming`
- `spent`: sum of **approved** Bills + **approved** Payment Requests for this event

### Create event

- **POST** `/api/admin/events` (protected)

**Request body** (typical fields)

- Event fields: `date`, `accountNumber`, `activityName`, `startDate`, `closingDate`, `budget`, `cashAmount`, `sign`, etc. (see controller validation).
- **Director / Team Leader (admin):** send either MongoDB ids **or** emails. If both are present for the same slot, **email wins**.
  - `director` — ObjectId string (optional)
  - `teamLeader` — ObjectId string (optional)
  - `directorEmail` — string; user must exist with role `director`
  - `teamLeaderEmail` — string; user must exist with role `teamLeader`

```json
{
  "activityName": "IPL Season 2026",
  "accountNumber": "CLO-2026-0001",
  "date": "2026-04-01T00:00:00.000Z",
  "startDate": "2026-04-10T00:00:00.000Z",
  "closingDate": "2026-05-20T00:00:00.000Z",
  "budget": 500000,
  "cashAmount": 0,
  "sign": "Admin",
  "directorEmail": "director@example.com",
  "teamLeaderEmail": "tl@example.com"
}
```

### Update event

- **PUT** `/api/admin/events/:id` (protected)

You may include `director`, `teamLeader`, `directorEmail`, and/or `teamLeaderEmail` with the same rules as create. **Omit** a field entirely if you do not want to change that assignment (sending only `directorEmail` does not clear an existing team leader).

### Delete event

- **DELETE** `/api/admin/events/:id` (protected)

### Assign director/team leader

- **PATCH** `/api/admin/events/:id/assign` (protected)

**Request body:** at least one of `director`, `directorEmail`, `teamLeader`, `teamLeaderEmail`. You can update only the director or only the team leader; omitted roles keep their current event values. Email fields resolve to users and require the matching role (`director` / `teamLeader`).

```json
{ "directorEmail": "new-director@example.com" }
```

```json
{ "teamLeaderEmail": "new-tl@example.com" }
```

### Approve / reject event

- **PATCH** `/api/admin/events/:id/approval` (protected)

**Request body**

```json
{ "status": "approved" }
```

Allowed: `approved | rejected`

## Bookings

- **GET** `/api/admin/bookings` (protected)

## Bills APIs

### Create bill

- **POST** `/api/admin/bills` (protected)

**Request body**

```json
{
  "entityName": "Quick Print Hub",
  "amount": 12000,
  "event": "EVENT_ID",
  "contactPerson": "USER_ID",
  "description": "Banners & standees",
  "paidBy": "company"
}
```

Notes:
- `paidBy` is optional, default is `"company"`. Allowed: `company | own`.

### List bills (tabs via query param)

- **GET** `/api/admin/bills` (protected) → all
- **GET** `/api/admin/bills?status=pending|review|approved|rejected` (protected)

### Update bill (only `pending` or `review`)

- **PUT** `/api/admin/bills/:id` (protected)

### Review bill (move to review / approve / reject)

- **PATCH** `/api/admin/bills/:id/review` (protected)

**Request body**

```json
{ "status": "approved" }
```

Allowed: `review | approved | rejected`

### Delete bill

- **DELETE** `/api/admin/bills/:id` (protected)

## Payment Requests APIs

### Create payment request

- **POST** `/api/admin/payment-requests` (protected)

**Request body**

```json
{
  "title": "Transport advance",
  "amount": 50000,
  "description": "Equipment transport advance",
  "event": "EVENT_ID",
  "submittedBy": "USER_ID",
  "usedAmount": 28000,
  "returnAmount": 22000
}
```

Notes:
- `usedAmount` / `returnAmount` default to `0` (used for closing sheets + accounts).

### List payment requests (tabs via query param)

- **GET** `/api/admin/payment-requests` (protected) → all
- **GET** `/api/admin/payment-requests?status=pending|approved|rejected` (protected)

Response includes `initials` for the submitter.

### Approve / reject payment request

- **PATCH** `/api/admin/payment-requests/:id/review` (protected)

**Request body**

```json
{ "status": "approved" }
```

Allowed: `approved | rejected`

## Team Management APIs

### List team members (with metrics)

- **GET** `/api/admin/team` (protected)
- Optional: **GET** `/api/admin/team?role=director|teamLeader|employee|organizer`

Each member includes:
- `initials`
- `metrics.events`, `metrics.bills`, `metrics.spent`

### Create team member

- **POST** `/api/admin/team` (protected)

**Request body**

```json
{
  "name": "Amit Joshi",
  "email": "amit@example.com",
  "password": "secret",
  "role": "employee",
  "phone": "+91 9XXXXXXXXX"
}
```

### Update team member

- **PATCH** `/api/admin/team/:id` (protected)

Allowed fields: `name`, `phone`, `role`

## Closing Sheets APIs

### List events for closing sheets page

- **GET** `/api/admin/closing-sheets` (protected)

### Get a single event closing sheet

- **GET** `/api/admin/events/:id/closing-sheet` (protected)

Returns:
- `totals`: `totalSpent`, `companyOwesEmployees`, `employeesReturn`
- `rows[]` per employee: `bills`, `spent`, `company`, `own`, `advance`, `used`, `return`, `owed`

## Accounts & Settlements APIs

### Accounts overview (cards + employee settlement list)

- **GET** `/api/admin/accounts/overview` (protected)

Returns:
- `totals.payableToEmployees`
- `totals.receivableFromEmployees`
- `totals.pendingApprovals`
- `employeeSettlement[]` with balances:
  - `balances.payableToEmployee`
  - `balances.receivableFromEmployee`

### Record a settlement

- **POST** `/api/admin/accounts/settlements` (protected)

**Request body**

```json
{
  "userId": "USER_ID",
  "type": "receivable_from_employee",
  "amount": 22000,
  "method": "transfer",
  "note": "Collected cash"
}
```

Allowed `type`: `payable_to_employee | receivable_from_employee`

### Record a reminder (backend-only placeholder)

- **POST** `/api/admin/accounts/reminders` (protected)

**Request body**

```json
{ "userId": "USER_ID", "note": "Reminder sent" }
```

## Permissions Matrix API

- **GET** `/api/admin/permissions/matrix` (protected)

Returns:
- `roles[]`, `permissions[]`, `matrix` (true/false), and `keyAccessRules[]`

## Environment Variables

Create `.env` in project root OR `Backend/.env`:

- `JWT_SECRET` (required)
- `DATABASE_URL` (optional)
- `CLIENT_ORIGIN` (optional)

See `.env.example` for the template.

