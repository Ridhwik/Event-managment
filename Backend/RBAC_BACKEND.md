# Role-Based Access (Admin, Director, Team Leader)

Two authentication flows:

| Role | Account | Login | JWT `role` |
|------|---------|-------|------------|
| **Admin** | `Admin` collection | `POST /api/admin/login` | `admin` |
| **Director** | `User` with `role: "director"` | `POST /api/user/login` | `director` |
| **Team Leader** | `User` with `role: "teamLeader"` | `POST /api/user/login` | `teamLeader` |

Use header: `Authorization: Bearer <token>`.

---

## Admin (`/api/admin/*`)

- **Sees everything:** all users, all events, all financial modules.
- **Users:** `GET /api/admin/users`
- **Events:** full CRUD — `GET|POST /api/admin/events`, `PUT /api/admin/events/:id`, `DELETE /api/admin/events/:id`, `PATCH /api/admin/events/:id/assign`, `PATCH /api/admin/events/:id/approval`  
  - Admin may set Director / Team Leader by **`directorEmail`** / **`teamLeaderEmail`** (or legacy `director` / `teamLeader` ids); see `ADMIN_BACKEND_DOCS.md`.
- **Delete events:** **only** via Admin (`DELETE /api/admin/events/:id`). Directors and Team Leaders **cannot** delete events through user APIs.

---

## Director (`/api/user/*` with Director JWT)

- **Create events:** `POST /api/user/events`  
  - Becomes the event **director** automatically if `director` is omitted (`director` defaults to self).
  - Optional **`teamLeaderEmail`**: resolves a registered user with role `teamLeader` (or legacy **`teamLeader`** id). Email overrides id when both are sent.
- **Assign Team Leader:** `PATCH /api/user/events/:id/assign` with **`teamLeaderEmail`** and/or **`teamLeader`** (same resolution rules).  
  - Only if they are the event’s **director** or **creator** (`createdBy`).
- **Update own events:** `PUT /api/user/events/:id`  
  - May update whitelisted fields including `teamLeader` or **`teamLeaderEmail`** (directors only for TL assignment).
  - An event is “theirs” if `event.director` **or** `event.createdBy` is their user id.
- **See running events only (assigned):** `GET /api/user/events/running`  
  - Approved events where today is between `startDate` and `closingDate`, and they are `director` or `teamLeader` on the event.
- **Dashboard stats:** `GET /api/user/dashboard` (counts for assigned events).

---

## Team Leader (`/api/user/*` with Team Leader JWT)

- **Create events:** `POST /api/user/events`  
  - Becomes the **team leader** automatically if omitted; **cannot** set `director` (403 if `director` sent).
- **Update assigned events:** `PUT /api/user/events/:id`  
  - Only if `event.teamLeader` is their user id.  
  - **Cannot** set `director` (forbidden).
- **Cannot** call `PATCH /api/user/events/:id/assign` (director-only route).
- **Cannot delete** events (no delete route; use Admin).
- **Running list / dashboard:** same endpoints as Director (`/events/running`, `/dashboard`).

---

## General rules (enforced)

1. **Only Admin** has global visibility (`/api/admin/...` and `GET /api/admin/users`, `GET /api/admin/events`).
2. **Director & Team Leader** share **running** visibility via `GET /api/user/events/running` (only approved, in-date-range events where they are assigned).
3. **Team Leader** cannot delete events and cannot assign a director.
4. **Director** can assign **Team Leaders** only on events they direct or created.

---

## Quick reference

| Action | Admin | Director | Team Leader |
|--------|-------|----------|-------------|
| List all users | ✅ | ❌ | ❌ |
| List all events | ✅ | ❌ | ❌ |
| Create event | ✅ | ✅ | ✅ |
| Update event (scoped) | ✅ any | ✅ own | ✅ if `teamLeader` |
| Delete event | ✅ | ❌ | ❌ |
| Assign director/TL (admin) | ✅ | — | — |
| Assign TL (user route) | — | ✅ own events | ❌ |
| Running events list | all (via admin) | assigned | assigned |
