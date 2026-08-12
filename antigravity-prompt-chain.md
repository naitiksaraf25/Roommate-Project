# Antigravity Prompt Chain — RoomieMatch MVP
Build order for feeding Antigravity one prompt at a time. Each prompt assumes the previous ones have already been run and accepted in the same project. Attach `roommate-matcher-PRD-antigravity.md` to the project/context once at the start — every prompt below refers back to it instead of repeating the full spec.

Two defaults I've assumed to keep the chain concrete (flag if you want them changed before Prompt 1):
- **File/ID storage (Open Question §11.2):** local disk via `multer` for MVP, behind an interface that can be swapped for S3/Cloudinary later.
- **BetterAuth custom fields (Open Question §11.1):** stored directly on the BetterAuth user document via its additional-fields config, not a separate `userProfiles` collection — simpler for MVP, one less join everywhere.

---

## Prompt 1 — Environment & Project Scaffolding

```
Attached is the PRD for RoomieMatch (roommate-matcher-PRD-antigravity.md). For this first task, only set up the base project environment — do not build any features yet.

Do the following:
1. Create the folder structure for a full-stack app with:
   - /server (Node.js + Express.js backend, EJS-mate for server-rendered views where needed)
   - /client (React frontend)
   - Shared root-level config (package.json workspaces or two separate package.json files — your call, explain which you chose and why)
2. Install and pin these dependencies in the backend: express, mongoose (or the official mongodb driver — pick one and note why), better-auth, cors, dotenv, multer, nodemon (dev).
3. Install React in /client via a standard, lightweight setup (Vite preferred over CRA — confirm before assuming).
4. Create a .env.example file at the project root (and a real, gitignored .env for local dev) with placeholders for:
   - PORT
   - MONGODB_URI
   - BETTER_AUTH_SECRET
   - BETTER_AUTH_URL
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - CLIENT_URL
5. Add a basic Express server entrypoint that starts the server and successfully connects to MongoDB (log success/failure clearly), with no routes/features yet beyond a health-check endpoint (GET /api/health).
6. Set up .gitignore (node_modules, .env, uploads folder placeholder).
7. Confirm the app runs locally end to end: backend health check responds, frontend dev server starts and renders a placeholder page.

Do not implement auth, profiles, matching, or any other feature yet — this task is scaffolding only. Ask me before making any tech choice not already specified in the PRD or this prompt.
```

---

## Prompt 2 — BetterAuth Setup (Email/Password + Google OAuth)

```
Using the environment from Prompt 1, implement authentication per §4 of the PRD.

1. Configure BetterAuth in /server per the example in PRD §4.2 — MongoDB adapter, emailAndPassword provider with requireEmailVerification: true, and socialProviders.google using the env vars already in .env.
2. Mount BetterAuth's Express handler at /api/auth/*  per PRD §7 — do not hand-roll signup/login/session logic.
3. Implement the 6 auth flows listed in PRD §4.3: email/password signup, login, Google OAuth, session handling/middleware to protect routes, logout, password reset.
4. Add a minimal auth middleware (e.g. requireAuth) that other route groups will import later to check for a valid BetterAuth session.
5. On the frontend, build minimal (unstyled is fine for now) signup, login, and "Continue with Google" pages/components that hit these endpoints and show success/failure state.
6. Verify manually: I should be able to sign up with email/password, receive a verification email (log it to console or a dev email catcher if no real email service is configured yet — flag this and ask how I want to handle email delivery in dev), verify, log in, log out, and separately sign in with Google.

Do not implement role selection, platform verification (college email / landlord ID), profiles, or matching yet — those come in later prompts. If BetterAuth's additional-fields mechanism isn't clear for attaching custom platform fields later (see PRD §11.1), research it now and tell me how it works before we get to Prompt 3, since it affects the data model going forward.
```

---

## Prompt 3 — User Roles & Platform Verification Layer

```
Building on Prompts 1–2, implement PRD §4.4–4.5 and the onboarding user stories (US-1, US-2, US-3 in §5.1).

1. Extend the BetterAuth user document with the custom fields from PRD §6 (`role`, `platformVerification`, `accountStatus`) using BetterAuth's additional-fields config confirmed in Prompt 2.
2. Build the onboarding flow: after first login, if role is unset, force the user to a role-selection screen (Seeker / Resident / Landlord) before anything else is accessible. Implement POST /api/onboarding/role.
3. For Seeker/Resident: implement the college email check (US-2) — for now, use a placeholder allowlist of 3-5 example college domains (ask me for the real list for our launch city, or I'll provide it before this ships to production). If the signup/Google email matches → auto-verified. If not → prompt for a secondary college email and send a verification link to it (reuse BetterAuth's email verification mechanism if possible, or build an equivalent lightweight token-link flow — explain which you chose). Implement POST /api/verification/college-email.
4. For Landlord: implement government ID upload (US-3) using multer + local disk storage (per our agreed default), storing the file path and setting platformVerification.status to "pending". Implement POST /api/verification/landlord-id.
5. Add middleware (e.g. requireVerified) that checks platformVerification.status === "verified", to be reused by future protected routes (profile creation, matching, chat).
6. No admin approval UI yet — that comes later. For now it's fine if landlord verification just sits at "pending" with no way to approve it manually except directly editing the DB; note this limitation back to me.

Ask me before finalizing the real college email allowlist — don't invent institution domains.
```

---

## Prompt 4 — Lifestyle Profiles & Landlord Listings

```
Building on Prompts 1–3, implement PRD §5.2 (US-4, US-5) and the corresponding collections in §6.

1. Backend: implement the lifestyleProfiles collection/schema and landlordListings collection/schema exactly as specified in PRD §6.
2. Implement POST /api/profile/lifestyle (Seeker/Resident) and POST /api/profile/landlord-listing (Landlord) — both should support create and update (upsert by userId/landlordId).
3. Enforce PRD's required vs optional fields per role (§5.2 US-4 and US-5). Reject incomplete submissions on required fields with clear validation errors.
4. Both endpoints must be protected by requireAuth + role check (right form for right role) — verification status is NOT required yet to create a profile (only to appear in matching later), confirm this matches your understanding of the PRD before proceeding, since it's not explicitly stated.
5. Support optional profile photo upload (multer, local disk, same pattern as the landlord ID upload) and store photoUrl.
6. Frontend: build the two profile forms (lifestyle profile for Seeker/Resident, house-rules + property form for Landlord), routed to appropriately based on the user's role after onboarding. Basic styling only — polish comes later.
7. Landlord form should also support the optional "link existing verified student tenants" field (linkedTenantIds) — for now this can be a simple search-and-select by email among existing Resident users; full UX polish not required yet.

Do not build matching, interest, or chat yet.
```

---

## Prompt 5 — Matching Engine (Scoring Logic)

```
Building on Prompts 1–4, implement the matching engine per PRD §8.

1. Build this as a standalone, testable service/module (e.g. /server/services/matchingEngine.js) — it should be a pure function wherever possible: given a requester's criteria and a list of candidate profiles, return scored + sorted results. Keep it decoupled from Express so it's easy to unit test.
2. Implement the hard filters from §8.1 (gender match, active+verified status, exclude requester's own profile).
3. Implement the weighted scoring table from §8.2 exactly as specified (cleanliness 25, sleep schedule 20, smoking/drinking 20, food preference 15, guests/parties 10, city proximity 5, budget closeness 5). Make the weights easy to find/adjust in one place (e.g. a config object at the top of the file) since we expect to tune them post-launch.
4. Implement the landlord-without-lifestyle-profile proxy scoring described in §8.2 (house rules standing in for lifestyle factors), and the linked-tenant blending (50/50 with house rules) described in §8.3 — flag this 50/50 default back to me as still-unconfirmed per PRD §11.6.
5. Write unit tests covering: exact match scoring, hard filter exclusion, budget/city decay curves, top-3 truncation, and the fewer-than-3-eligible-candidates case.
6. Do not wire this into an API endpoint yet — that's the next prompt. This task is the scoring engine and its tests only.
```

---

## Prompt 6 — Match Request API & Results UI

```
Building on Prompts 1–5, wire the matching engine into the product per PRD §5.3 (US-6 through US-9) and §7.

1. Implement POST /api/match/request — accepts a requirement-form submission (criteria per PRD §6 matchRequests.criteria), runs it through the matching engine from Prompt 5 against the appropriate candidate pool (seekers matching against listings, or space-holders/landlords matching against seekers — both directions), stores the matchRequests document with results, and returns the top 3.
2. Implement GET /api/match/:matchRequestId to retrieve a past result.
3. Add the 24h caching behavior described in PRD §8.3 (don't recompute if a recent matchRequest with the same requester+criteria exists and is under 24h old — recompute otherwise).
4. Protect this route with requireAuth + requireVerified (matching should only be available to platform-verified users).
5. Frontend: build the requirement-submission form (mirrors the profile form fields plus any matching-specific criteria) and a results screen showing the top 3 matches with compatibility score, key overlapping/mismatched factors, city/rent, and photo if available. Handle the fewer-than-3-results case with the explanatory message from §8.3.

Do not implement the "express interest" / mutual match mechanism yet — matches should just be viewable for now.
```

---

## Prompt 7 — Mutual Interest System

```
Building on Prompts 1–6, implement PRD §5.4 (US-10) and the matchInterests collection from §6.

1. Implement POST /api/interest — records a "fromUserId expressed interest in toUserId" record, status "pending".
2. If the reverse record already exists (toUserId had already expressed interest in fromUserId), update both records' status to "matched" and trigger creation of a chat (see Prompt 8 — for now just create the chats document with both participantIds; messaging UI comes next).
3. Implement GET /api/interest/status/:userId — lets the frontend check whether a given candidate is pending, matched, or no interest expressed yet, from the current user's perspective.
4. Frontend: add an "Express Interest" button on each of the top-3 match results from Prompt 6, with state reflecting pending/matched status. Add a simple in-app notification (even just a toast/banner on next page load is fine for MVP) when a mutual match occurs.
5. Do not expose contact info anywhere in this flow — confirm no email/phone leaks into any API response used by the opposite party before a mutual match, and even after, contact info should only be shared voluntarily inside chat (next prompt), never automatically.

Do not build the chat messaging UI yet — that's the next prompt.
```

---

## Prompt 8 — In-App Chat

```
Building on Prompts 1–7, implement PRD §5.4 (US-11) chat functionality using the chats/messages collections from §6.

1. Implement GET /api/chat/:chatId/messages and POST /api/chat/:chatId/messages, both protected by requireAuth and a check that the requesting user is a participant of that chatId.
2. Choose a transport for near-real-time updates — polling (simple, sufficient for MVP) or WebSockets (better UX, more setup). Recommend polling for MVP speed unless I say otherwise; ask before committing if you think WebSockets are warranted.
3. Frontend: build a basic chat UI — list of active matched chats, and a message thread view with send box, read/unread indication if feasible.
4. Confirm mutual-match-only access: a chat should be completely inaccessible (404/403) to anyone who isn't one of the two matched participants.

Do not implement reporting or admin moderation yet — that's next.
```

---

## Prompt 9 — Reporting & Admin Dashboard

```
Building on Prompts 1–8, implement PRD §9 (US-12, US-13, US-14) and the reports collection from §6.

1. Implement POST /api/report — available from any profile view and from within chat, per PRD US-12. Require a reason (dropdown) + optional free text.
2. Build a simple, internal-only admin dashboard (route-protected — only role: "admin", which per PRD §4.5 must be seeded manually; add a small seed script or CLI command to promote a user to admin for local dev/testing).
3. Implement GET /api/admin/reports and POST /api/admin/reports/:id/action (dismiss / warn / suspend / ban) per PRD §9.
4. Implement GET /api/admin/verifications and POST /api/admin/verifications/:id/action (approve/reject) — this finally closes the gap flagged back in Prompt 3 for landlord ID and college-email edge-case approvals.
5. On ban/suspend: set accountStatus accordingly, immediately exclude the user from future matching candidate pools (matching engine already filters on accountStatus per §8.1, confirm this is sufficient), and attempt to revoke their active BetterAuth session — research whether BetterAuth supports forced session invalidation (PRD open question §11.4) and report back what you find; if not directly supported, propose a workaround (e.g. a session-validity check against accountStatus on every authenticated request).
6. Admin dashboard UI can be minimal/utilitarian — internal tool, not consumer-facing polish.

This closes out the MVP feature set from PRD §12 Phase 1. After this prompt, do a full pass against every Acceptance Criteria in PRD §5 and flag anything not yet satisfied.
```

---

## Prompt 10 — End-to-End QA Pass & Hardening

```
All Phase 1 features from the PRD should now be implemented (Prompts 1–9). This final prompt is a review and hardening pass, not new features.

1. Go through every user story and acceptance criterion in PRD §5 one by one and confirm each is actually met by the current codebase — list any gaps explicitly rather than assuming.
2. Confirm every protected route has the correct combination of requireAuth / role check / requireVerified middleware per PRD §7's access rules.
3. Confirm no endpoint ever returns another user's email or phone number outside of the mutual-match + chat context.
4. Review error handling across all API routes — consistent error response shape, no unhandled promise rejections, no stack traces leaked to the client in production mode.
5. Confirm environment variables are used correctly everywhere (no hardcoded secrets, URLs, or city names — per PRD §10's "no hard-coded city" requirement).
6. Summarize remaining Open Questions from PRD §11 that are still unresolved, and anything you had to assume along the way that I should explicitly confirm before this goes further than local dev.
```
