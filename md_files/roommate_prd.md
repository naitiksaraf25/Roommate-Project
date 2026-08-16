# Product Requirements Document (PRD)
# RoomieMatch — AI-Assisted Roommate & PG Matching Platform
**Build target: Google Antigravity (agentic IDE)**

**Version:** 1.0 (MVP)
**Status:** Ready for agent planning
**Last updated:** August 2026

---

## 0. Notes for the Build Agent

This PRD is written to be handed directly to Antigravity for Planning Mode (Task Artifacts + Implementation Plan generation) before any code is written.

- Treat each numbered section as a candidate task boundary — sections 5–9 are independent enough to be parallelized across subagents (auth, profiles, matching engine, chat, admin) once the shared data model (§6) and API contract (§7) are agreed, since those two are the integration surface every other module depends on.
- Do not invent additional third-party services beyond what's specified below (auth provider, DB, hosting) without flagging it back to the user first.
- Where a requirement says "TBD" or appears in Open Questions (§11), stop and ask rather than assuming.
- Tech stack and library choices in §3 are fixed by the user — do not substitute alternatives (e.g., no NextAuth/Passport instead of BetterAuth, no Postgres instead of MongoDB) even if they seem more conventional for a given feature.

---

## 1. Overview

### 1.1 Problem Statement
Students moving to a new city for college or internships struggle to find compatible, trustworthy roommates. People with vacant PG spots or flats currently rely on unstructured WhatsApp/Facebook groups, resulting in low response quality, mismatched living situations, and wasted time on both sides. There is no system that captures lifestyle preferences and intelligently surfaces compatible matches.

### 1.2 Goal
A web platform where students and space-holders create structured profiles, submit requirements, and receive AI-ranked (rule-based, weighted) top-3 compatible matches.

### 1.3 Success Metrics (MVP)
| Metric | Target (first 3 months post-launch) |
|---|---|
| Verified signups (single city) | 1,000+ |
| Requirement forms submitted | 500+ |
| Match → mutual "interest" rate | ≥ 25% |
| Mutual interest → chat started rate | ≥ 60% |
| Reported/flagged profile rate | < 3% of active users |
| Median time from signup to first mutual match | < 7 days |

### 1.4 Out of Scope (MVP)
- Payments/rent collection
- Multi-city or multi-country support
- LLM-generated match explanations (v2)
- Native mobile apps
- In-app video calls

---

## 2. User Types & Roles

| Role | Definition |
|---|---|
| **Seeker** | Student looking for a room/PG bed |
| **Resident space-holder** | Existing tenant with a spare room, lives in the flat |
| **Landlord** | Owns/manages PG or flat, does not live there |
| **Admin** | Internal platform operator |

A single account can hold the Seeker role and later switch to/add Resident role (same person, different life stage) using the same login identity.

---

## 3. Tech Stack (fixed — do not substitute)

| Layer | Choice |
|---|---|
| Frontend | React + HTML/CSS/JS |
| Backend | Node.js + Express.js + EJS-mate (server-rendered views where applicable) |
| Database | MongoDB |
| **Authentication** | **BetterAuth**, using: <br>• `emailAndPassword` provider (email + password signup/login) <br>• `socialProviders.google` (Google OAuth) <br>• `mongodbAdapter` for session/user/account storage |
| File/ID storage | TBD — see Open Questions §11.3 (needed for landlord ID uploads) |

---

## 4. Authentication Spec (BetterAuth)

### 4.1 Why BetterAuth
BetterAuth provides a unified auth layer with a MongoDB adapter out of the box, native `emailAndPassword` support, and a `google` social provider plugin — avoiding the need to hand-roll session/token management or wire Passport.js strategies manually.

### 4.2 Configuration requirements
```js
// server/auth.js (illustrative — agent to finalize exact file location)
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
    collectionNames: {
      user: "users",
      session: "sessions",
      account: "accounts",
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // sends verification email/link
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },
});
```

### 4.3 Auth flows required
1. **Email/password signup** → BetterAuth creates user + sends verification email → user must verify before accessing profile creation / matching / chat.
2. **Email/password login**.
3. **"Continue with Google"** → BetterAuth handles OAuth redirect/callback, creates or links account by email.
4. **Session handling** — BetterAuth session cookie/token used to protect all authenticated routes (`/api/profile/*`, `/api/match/*`, `/api/chat/*`).
5. **Logout**.
6. **Password reset** (BetterAuth built-in flow) for email/password accounts.

### 4.4 Relationship between BetterAuth identity and platform "verification"
BetterAuth's email verification confirms the person **owns the email address** — it does **not** by itself confirm they're a legitimate student or a legitimate landlord. Platform-level trust verification is a separate business-logic layer on top:

| User type | BetterAuth handles | Platform layer adds |
|---|---|---|
| Seeker / Resident (student) | Email verified (via password flow) or Google-verified email | Check email domain against an allowlist of college/university domains for the launch city; if Google sign-in used with a personal Gmail, prompt user to additionally link/verify a college email |
| Landlord | Email verified or Google-verified email | Government ID upload, reviewed by admin before `platformVerified: true` |

This means every user record needs a **platform-level `verificationStatus`** field independent of BetterAuth's own session/account state (see §6 data model).

### 4.5 Roles & authorization
- Role (`seeker` / `resident` / `landlord` / `admin`) is stored as a custom field on the user record, set during onboarding (post-auth, pre-profile-creation step).
- Admin role is not self-assignable — seeded manually / via internal script only.
- Route-level middleware checks both (a) authenticated session via BetterAuth and (b) role/verification status as required per endpoint (e.g., `/api/match/request` requires `platformVerified: true`).

---

## 5. User Stories & Acceptance Criteria

### 5.1 Onboarding
**US-1:** As a new user, I can sign up with email + password or with Google, and land in an onboarding flow that asks me to pick my role (Seeker / Resident / Landlord).
- AC: Role selection required before any profile form is shown.
- AC: Email/password users must verify email before proceeding past onboarding.
- AC: Google users proceed immediately (email pre-verified by Google) but still hit the platform-verification step for their role.

**US-2:** As a student (Seeker/Resident), after choosing my role I'm prompted to confirm/enter my college affiliation so the platform can check my email domain.
- AC: If email domain matches the allowlist → `verificationStatus: "verified"` automatically.
- AC: If not (e.g., signed up via personal Gmail) → prompt to add a secondary college email; send verification link to that address before granting `verified` status.

**US-3:** As a landlord, after choosing my role I'm prompted to upload a government ID.
- AC: Upload accepted (image/PDF), stored, status set to `pending`.
- AC: Cannot create a listing or appear in matching until admin sets status to `verified`.

### 5.2 Profile Creation
**US-4:** As a Seeker or Resident, I fill a lifestyle profile.
- AC: Required: city, budget range, gender, sleep schedule, cleanliness level, smoking/drinking habits, food preference, guests/parties frequency.
- AC: Optional: profile photo, short bio (max 300 chars).

**US-5:** As a Landlord, I fill house rules + property details instead of a lifestyle profile.
- AC: Required: city/locality, rent, room type, gender preference, house rules (smoking/drinking/pets allowed, guest policy, curfew).
- AC: Optional: link existing verified student tenants already on the platform to this listing.

### 5.3 Matching
**US-6:** As a Seeker, I submit requirements and get the top 3 compatible listings (resident rooms or landlord listings).
**US-7:** As a Space-holder/Landlord, I submit requirements and get the top 3 compatible seeker profiles.
**US-8:** Gender preference is a hard filter (candidates not matching are excluded, not down-ranked).
**US-9:** City and budget are soft filters (affect score, don't exclude).

*(Full scoring spec in §8.)*

### 5.4 Mutual Interest & Chat
**US-10:** I can express interest in a match; if the other party also expresses interest, we're mutually matched.
**US-11:** Chat only unlocks after mutual match; contact info is never auto-shared.

### 5.5 Trust & Safety
**US-12:** I can report a profile or chat message.
**US-13:** Admin can review reports and warn/suspend/ban accounts.
**US-14:** Admin can review and approve/reject pending landlord ID verifications.

---

## 6. Data Model (MongoDB)

> Note: `users`, `sessions`, and `accounts` collections are managed by BetterAuth's MongoDB adapter — do not hand-roll their schema. Platform-specific fields are added to the BetterAuth user document via its custom-fields mechanism, or via a linked `userProfiles` collection keyed by BetterAuth's `userId` (agent to decide based on BetterAuth's recommended extension pattern — flag if unclear).

### `users` (BetterAuth-managed + custom fields)
```
{
  id,                     // BetterAuth user id
  email,
  emailVerified: bool,    // BetterAuth-managed
  name,
  image,                  // from Google if applicable
  // --- custom platform fields ---
  role: "seeker" | "resident" | "landlord" | "admin",
  platformVerification: {
    status: "pending" | "verified" | "rejected",
    method: "college_email" | "government_id",
    collegeEmail,             // if applicable
    idDocumentUrl,            // landlords only
  },
  accountStatus: "active" | "suspended" | "banned",
  createdAt, updatedAt
}
```

### `lifestyleProfiles` (seekers & residents)
```
{
  _id, userId,
  city, locality,
  budgetMin, budgetMax,
  genderPreference, gender,
  sleepSchedule, cleanliness, smokingDrinking, foodPreference, guestsFrequency,
  bio, photoUrl,
  createdAt, updatedAt
}
```

### `landlordListings`
```
{
  _id, landlordId,
  city, locality, rent, roomType, genderPreference,
  houseRules: { smokingAllowed, drinkingAllowed, petsAllowed, guestPolicy, curfew },
  linkedTenantIds: [userId],
  photoUrls: [],
  status: "active" | "filled" | "inactive",
  createdAt, updatedAt
}
```

### `matchRequests`
```
{
  _id, requesterId, requesterType: "seeker" | "spaceHolder",
  criteria: { ...form snapshot },
  results: [{ candidateId, candidateType, score, breakdown }],
  createdAt
}
```

### `matchInterests`
```
{ _id, fromUserId, toUserId, status: "pending" | "matched", createdAt }
```

### `chats` / `messages`
```
chats: { _id, participantIds: [], matchInterestId, createdAt }
messages: { _id, chatId, senderId, text, sentAt, readAt }
```

### `reports`
```
{
  _id, reporterId, reportedUserId, reason, details,
  status: "pending" | "dismissed" | "actioned",
  reviewedBy, reviewedAt, createdAt
}
```

---

## 7. API Endpoints

### Auth (BetterAuth-provided — mount its handler, do not reimplement)
- `POST/GET /api/auth/*` — handled by BetterAuth's Express handler (signup, login, Google OAuth redirect/callback, session, logout, password reset)

### Platform-specific
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/onboarding/role` | Set user role after first auth |
| POST | `/api/verification/college-email` | Submit/verify secondary college email |
| POST | `/api/verification/landlord-id` | Upload government ID |
| POST | `/api/profile/lifestyle` | Create/update lifestyle profile |
| POST | `/api/profile/landlord-listing` | Create/update landlord listing |
| POST | `/api/match/request` | Submit requirement form → top 3 results |
| GET | `/api/match/:matchRequestId` | Retrieve past match results |
| POST | `/api/interest` | Express interest in a candidate |
| GET | `/api/interest/status/:userId` | Check mutual match status |
| GET | `/api/chat/:chatId/messages` | Fetch chat history |
| POST | `/api/chat/:chatId/messages` | Send message |
| POST | `/api/report` | Submit a report |
| GET | `/api/admin/reports` | Admin: list reports |
| POST | `/api/admin/reports/:id/action` | Admin: dismiss/warn/suspend/ban |
| GET | `/api/admin/verifications` | Admin: pending verification queue (college email edge cases + landlord IDs) |
| POST | `/api/admin/verifications/:id/action` | Admin: approve/reject |

All platform-specific routes (except `/api/verification/*` during onboarding) require: (a) valid BetterAuth session, (b) `accountStatus: "active"`, and where noted, (c) `platformVerification.status: "verified"`.

---

## 8. Matching Engine — Detailed Spec

### 8.1 Hard Filters (disqualify before scoring)
1. Gender preference match
2. `accountStatus: "active"` and `platformVerification.status: "verified"`
3. Not the requester's own profile/listing

### 8.2 Weighted Scoring (0–100, starting weights — tune post-launch)
| Factor | Weight | Logic |
|---|---|---|
| Cleanliness level | 25 | Exact = full; 1 level apart = partial; 2+ apart = 0 |
| Sleep schedule | 20 | Compatible = full; conflicting = low/0 |
| Smoking/drinking habits | 20 | Exact = full; opposed = 0 |
| Food preference | 15 | Exact = full; compatible = partial (predefined table) |
| Guests/parties frequency | 10 | Exact = full; close = partial |
| City proximity | 5 | Same locality = full; same metro = partial; different city = 0 |
| Budget closeness | 5 | Within 10% = full; linear decay to 0 at >40% diff |

Landlord listings without a personal lifestyle profile score the lifestyle-weighted portion using house rules as proxies (e.g., `smokingAllowed` vs. seeker's `smokingDrinking` habit).

### 8.3 Output & Edge Cases
- Return top 3 by score; if fewer than 3 eligible, return what exists with an explanatory UI message.
- If landlord has `linkedTenantIds`, blend house-rules score with average linked-tenant lifestyle score (suggested 50/50 — confirm before build, see §11).
- Cache match results per `matchRequest` for 24h before recomputation on revisit.

---

## 9. Trust, Safety & Admin

- Report button on profiles and chat messages → `reports` collection, admin review queue.
- Admin actions: dismiss, warn (email), suspend, ban.
- Admin verification queue: college-email edge cases (manual override) + landlord ID approvals.
- Banned/suspended users immediately excluded from matching candidate pools and cannot log in (BetterAuth session should be invalidated on ban — confirm BetterAuth supports forced session revocation).

---

## 10. Non-Functional Requirements
- Match scoring response < 3s for candidate pools up to ~5,000 profiles (single-city MVP scale).
- Passwords/sessions fully managed by BetterAuth (no custom password hashing).
- ID documents stored in access-controlled storage, visible only to admin reviewers.
- HTTPS everywhere; Google OAuth credentials in environment variables, never committed.
- No hard-coded city — architecture should allow future multi-city expansion.

---

## 11. Open Questions (resolve before/while building — do not assume)

1. **BetterAuth custom fields vs. linked collection:** Confirm whether platform fields (`role`, `platformVerification`, `accountStatus`) live directly on the BetterAuth user document (via its additional-fields config) or in a separate `userProfiles` collection joined by `userId`. This affects how every other module queries user data.
2. **File/ID storage provider:** Not yet chosen (e.g., local disk for MVP vs. S3/Cloudinary). Needed for landlord ID uploads and profile photos.
3. **College email allowlist source:** Needs an actual maintained list of valid institutional domains for the launch city, or a manual-review fallback.
4. **Session revocation on ban:** Confirm BetterAuth's support for force-invalidating an active session when admin bans a user.
5. **Match exclusivity:** Can a Seeker be mutually matched with multiple listings in parallel, or does one mutual match lock out others? (Recommend: allow parallel until one side marks "filled"/"moved in".)
6. **Landlord blended scoring weight** (house rules vs. linked tenant lifestyle): default 50/50 — validate with early users.
7. **Listing expiry policy:** No auto-deactivation yet; recommend manual "mark as filled" + 30-day reminder.

---

## 12. Release Plan
**Phase 1 (this PRD):** Single city, BetterAuth-based auth, core matching, mutual-interest chat, platform verification layer, admin moderation.
**Phase 2:** LLM-based match explanations, user-ranked factor weighting, listing expiry automation, post-move-in ratings.
**Phase 3:** Multi-city expansion, monetization, mobile app.
