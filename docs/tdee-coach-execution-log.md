# TDEE Coach — Execution Log

Running log of all work executing `tdee-coach-plan.md`. Newest entries at the bottom.

## 2026-07-06 — Session 1

**Decisions locked** (plan §8): UI name "Coach"; weigh-in unit backfill from current client `weightUnit`; rate stored as %BW/week, displayed in user units; fixed Monday check-in; HealthKit optional.

### Work items
- [ ] Phase 0 BE: Prisma migration (users profile columns, weigh-in unit, coach tables), `PUT /user/profile`, `last_active_at` middleware
- [ ] Phase 1 BE: engine + unit tests (vitest), `GET /coach/state` on-read compute, coach routes
- [ ] Phase 0/1 client: profile sync on login, wire `PUT /user/targets`, coach query module, BodyTab trend line, Expenditure card, CoachCard teaser
- [ ] Verify: tests green, backend running locally, app launched in simulator, endpoints exercised

### Notes / discoveries

**Backend Phase 0 + Phase 1 complete (all in `state-of-health-be`, branch `main`, uncommitted):**

- ⚠️ **`state-of-health-be/.env` points `DATABASE_URL` at the PRODUCTION VPS DB.** Never run `prisma db push`/migrations from a dev machine without overriding it. Local dev now uses Homebrew PostgreSQL 17 on **port 5433** (`postgresql://kennygunderman:localdev@localhost:5433/state_of_health_dev`), because an EnterpriseDB Postgres 17 already occupies 5432 (running since April, password unknown). Homebrew install had a broken `pkglibdir` (`$libdir/dict_snowball` missing); fixed with `ln -sfn /opt/homebrew/opt/postgresql@17/lib/postgresql /opt/homebrew/lib/postgresql@17`. Start cmd: `pg_ctl -D /opt/homebrew/var/postgresql@17 -o "-p 5433" start`.
- **Schema** (`prisma/schema.prisma` + hand-written `prisma/migrations/coach/001_add_coach_foundations.sql`, matching repo convention): users gains `sex/birth_date/height_cm/weight_unit/timezone/last_active_at`; `body_weight_entries.unit`; new tables `coach_profiles`, `expenditure_snapshots`, `coach_weekly_plans`. Migration SQL verified two ways: diffed against `prisma migrate diff` canonical output (only ordering differs) and executed against a scratch DB restored to the old schema (`ON_ERROR_STOP`, clean). **Not yet applied to prod.**
- **Engine** `src/services/coach/engine.ts` — pure module: gap-aware EMA trend weight (α=0.1, linear interpolation between weigh-ins, warm-up before window for idempotency), adaptive TDEE (β=0.06, implied-TDEE clamp 1000–6000, 7700 kcal/kg), Mifflin-St Jeor cold start ×1.4 blended out over 21 qualifying days, qualifying-day gates (800 kcal floor, 50%-of-median, post-gap exclusion), confidence tiers, and `computePlan()` (weekly targets + guardrails: 1200/1500 floors, ±150 kcal swing, macro squeeze) for Phase 2.
- **Tests**: vitest added (`npm test`); 21 tests in `src/services/coach/__tests__/engine.test.ts` — convergence (loser/gainer/noisy/sparse synthetic users), idempotency, degenerate inputs, guardrails. All green. tsconfig now excludes tests from `dist`.
- **Endpoints**: `GET/PUT /api/user/profile` (per-route auth, validates sex/birthDate/heightCm 90–250/weightUnit/IANA tz; weightUnit write backfills null weigh-in units per plan §8.2); `GET /api/coach/state` (recomputes 90-day snapshot window through yesterday in the user's tz on every read — delete+createMany transaction; returns mode/tdee/trend/confidence + 30-day series); `POST /api/weigh-in` now accepts optional `unit`. `trackLastActive` middleware (1 write/user/hour, fire-and-forget) mounted after auth in app.ts.
- **E2E verified locally** (server on :3001 against the 5433 dev DB): real Firebase ID token minted via Auth REST API for dev user `soh-coach-dev-test@example.com` (uid `Ifv85FhdIJgszBRQxQj2FxmNYqC2` — exists in the production Firebase Auth project; harmless, reusable for dev). Seeded 60 days of synthetic history (true TDEE 2800, intake 2300/day, daily lbs weigh-ins with noise): **`/coach/state` returned tdee 2791 (0.3% error), confidence high**, 30-point series, idempotent repeat reads, 90 snapshot rows persisted.
- Firebase web API key (from GoogleService-Info.plist, safe client-side key): used only for minting dev tokens.

**Client Phase 0 + Phase 1 complete (all in `state-of-health-tracker`, uncommitted):**

- **New endpoints/keys**: `Endpoints.UserProfile`, `Endpoints.CoachState`; query key `coachState` (added to `PERSISTED_QUERY_KEYS` for offline display), `dailyMacrosAll` bare key for prefix invalidation; mutation keys `syncProfile`, `updateMacroTargets`.
- **Data layer**: `@data/models/CoachState.ts`; io-ts codecs in `queries/api/coach/decoder/CoachDecoder.ts`; API fns `fetchCoachState`, `updateProfile`, and `updateMacroTargets` (**finally wires the previously-dead `PUT /user/targets`**); hooks `useCoachStateQuery`, `useSyncProfileMutation`, `useUpdateMacroTargetsMutation`.
- **ProfileSync** (`src/components/ProfileSync`, headless, mounted in App.tsx inside the query provider): on auth + on weight-unit change, PUTs device IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) + weight unit to `/user/profile`, fire-and-forget. This also triggers the server-side weigh-in unit backfill.
- **Weigh-ins now send `unit`** (LogWeight screen, from the `useUserData` store). Discovered the app supports **stones ('st')** — widened unit handling across BE + client (`toKg` in engine handles lbs/kg/st).
- **TargetCaloriesModal** now syncs calories to the server after the Zustand write (fire-and-forget; Zustand stays the offline fallback).
- **ExpenditureCard** (`src/screens/Progress/components/ExpenditureCard/`): TDEE value + confidence chip (Calibrating/Rough/Good/Measured) + 30-day MiniLineChart + adherence-neutral caption; rendered in Progress ▸ Body below the weight card, gated by new remote-config flag `coach_enabled` (default true, kill switch).
- Both projects typecheck clean; ESLint clean on all touched files (auto-fixed import order + prettier nits); backend tests still 21/21.
- **TEMP change for simulator testing**: `src/constants/endpoints.ts` baseApiUrl → `http://localhost:3001/api` (marked with `TEMP(local-dev)` comment — **revert before committing/building for TestFlight**). Info.plist already allows local networking.

**End-to-end verification in the iOS simulator (PASSED):**

- Built and launched the dev client on iPhone 16 Pro via `npx expo run:ios` (Xcode 26.1, build succeeded first try with the new code).
- Drove the UI with **Maestro** (installed via brew; flows in the session scratchpad). Learnings for future flows: expo dev-menu sheet interrupts on launch (guard with conditional taps); `hideKeyboard` is flaky on iOS (tap neutral text instead); React Navigation tab labels match as `"Progress, tab, 2 of 5"`, not `"Progress"`; `inputText` appends, so `launchApp: stopApp: true` first; two booted sims break the driver — pass `--device <udid>`; first driver install needs `MAESTRO_DRIVER_STARTUP_TIMEOUT=300000`.
- Logged out, logged in as `soh-coach-dev-test@example.com` (dev user, password in session notes: CoachDevTest123!), navigated Progress ▸ Body.
- **Verified on screen** (screenshot: `tdee-coach-verification.png` in workspace root): Body Weight card shows the seeded 60-day downtrend (199.2 lbs latest); **Expenditure card shows 2,791 kcal/day, "Measured" chip, 30-point chart, caption** — matching `GET /coach/state` exactly; true simulated TDEE was 2,800 (0.3% engine error).
- `users.last_active_at` updated by real app traffic (trackLastActive middleware verified live).
- Client jest: ExpenditureCard util tests 4/4 green. Backend vitest: 21/21 green. Both tsc typechecks clean; ESLint clean.

### Current dev-environment state (for next session)
- Local Postgres 17: `pg_ctl -D /opt/homebrew/var/postgresql@17 -o "-p 5433" start` (may need restarting after reboot; NOT registered with brew services).
- Backend: `DATABASE_URL="postgresql://kennygunderman:localdev@localhost:5433/state_of_health_dev" PORT=3001 npm run dev` in `state-of-health-be`.
- Metro: `npx expo start --dev-client` in `state-of-health-tracker` (or `expo run:ios` to rebuild).
- **Prod migration still pending**: `prisma/migrations/coach/001_add_coach_foundations.sql` — apply on the VPS (after a pg_dump backup) when deploying the backend, then `pm2 restart`.

## 2026-07-06 — Session 1 (continued): Phase 2 built + SHELVED

**Phase 2 (coached targets) is fully built and mostly verified. All work committed to branch `coach-tdee-shelved` in BOTH repos** (see Shelving below).

### Backend (28/28 vitest green, typecheck clean, all endpoints curl-verified)
- `engine.ts`: added `weekStartFor` (Monday local weeks), `fallbackWeightKg`.
- `planBuilder.ts` (pure, tested): weekly plan from latest snapshot + profile; **holds last week's targets while calibrating** (never holds the first plan); swing guardrail vs previous plan; structured `rationale` (tdee, previousTdee, confidence, guardrails, held).
- `coach.service.ts`: `ensureCurrentWeekPlan` — lazily generates the current local week's plan on any coached `/coach/state` read (no cron yet; P2002 race-safe), writes `users.target_*` so the existing daily-macros response carries coached targets with zero client changes to that path. `enrollCoach` (upserts profile fields + coach_profiles, regenerates current week's plan, **pre-acks the first plan** — the wizard reveal IS the first check-in), `updateCoachSettings` (goal/rate change deletes + regenerates this week's plan; pause/resume), `deleteCoach` (back to manual, targets keep last values), `acknowledgeCheckIn`.
- Routes: `POST /coach/enroll`, `PUT /coach/settings`, `DELETE /coach`, `POST /coach/checkin/:planId/ack`. Validation mirrors wizard presets (lose 0.25–1.0 %BW/wk, gain 0.1–0.5, maintain 0).
- **Curl-verified lifecycle** (seeded user): enroll lose@0.5% → plan 2,300 kcal / P195 C235 F65 (math checks: TDEE 2,791 − 482 deficit, round25; macros sum ≈ target), pre-acked; rate→0.75% → plan 2,075, unacked (pendingCheckIn set); ack works, double-ack 404s; pause keeps plan visible, stops regeneration; invalid rate 400s.
- NOTE: an unauthenticated `GET /health` endpoint (Coolify checks, `GIT_SHA`) appeared in app.ts from separate local work — it ships in this branch's commit.

### Client (typecheck + ESLint clean)
- Models/codec/api/hooks for the full lifecycle (`useEnrollCoachMutation` etc.; enroll/settings responses are written straight into the coachState cache; ack is a local cache patch to avoid a full server recompute).
- **Wizard** (MacrosStack): `CoachIntro` → `CoachSetup` (goal segmented + rate presets w/ ≈lbs-per-week projections) → `CoachProfile` (sex/age/height, optional, unit-aware ft-in vs cm) → `CoachReveal` (estimate + Start Coach). Shared `GoalRateSelector` component.
- **CoachCard** on Macros (flag `coach_enabled`): pitch state → wizard; enrolled state (target + expenditure + Manage) → `CoachSettings` screen (goal/rate editing w/ save, pause/resume, Turn off w/ ConfirmModal).
- **WeeklyCheckInSheet**: auto-opens via global bottom sheet when `pendingCheckIn` exists (module-level shown-set prevents re-showing per session); expenditure + delta, held vs updated copy, targets grid, Sounds good → ack.
- Gotcha fixed: `stringWithParameters` placeholders are `%0 %1`, not `{0}`.

### Simulator verification (screenshots in workspace root / scratchpad)
- ✅ Coached targets live: summary ring shows 2,300 (server plan → users.target_* → daily macros → ring).
- ✅ CoachCard enrolled state renders (`tdee-coach-phase2-checkin.png` shows sheet + card).
- ✅ Check-in sheet auto-opens with correct data; "Sounds good" ack persists to DB.
- ✅ CoachSettings opens (goal/rate/pause/turn-off UI); turn off + confirm returns card to "Set up Coach" pitch; targets retain last values.
- ⚠️ Not UI-driven end-to-end: the wizard screens (Intro→Setup→Profile→Reveal→enroll). Maestro's iOS driver was flaky tapping the card touchables (text taps inside RN touchables intermittently invisible to its tree — same reason sheet asserts fail). The enroll API path is fully verified via curl; the screens compile/lint. First manual test should walk the wizard once.

### Shelving (2026-07-06)
- Branch **`coach-tdee-shelved`** pushed in `state-of-health-be` and `state-of-health-tracker`. The TEMP localhost baseApiUrl was reverted before committing.
- `state-of-health-tracker`: returned to `main` (working tree clean).
- `state-of-health-be`: **left checked out on `coach-tdee-shelved`** — the working tree also contained separate in-flight deployment work (Dockerfile, .github/, DEPLOY.md, .env.example, prisma migrations restructure into `manual-migrations/` + a generated `20260706000000_init`, env-based firebase.ts, /health endpoint) interleaved with coach changes in shared files (app.ts). Everything is committed together on the branch so nothing is lost; switching to main would remove those files from the working tree, so that choice is deferred. To extract the deploy work later: `git checkout main && git checkout coach-tdee-shelved -- Dockerfile .dockerignore DEPLOY.md .env.example .github prisma/manual-migrations prisma/migrations src/utils/firebase.ts` (app.ts /health needs a manual copy).
- These .md docs are committed under `docs/` on both branches for future reference.
- Local dev env: Postgres 17 on :5433 stopped after shelving; dev DB `state_of_health_dev` retains the seeded test user + coach data for when work resumes. Dev Firebase user: `soh-coach-dev-test@example.com` / `CoachDevTest123!`.
- **Prod migration was never applied** — `prisma/migrations/coach/001_add_coach_foundations.sql` runs only when this branch ships.
- To resume: checkout `coach-tdee-shelved`, start Postgres (`pg_ctl -D /opt/homebrew/var/postgresql@17 -o "-p 5433" start`), backend (`DATABASE_URL=postgresql://kennygunderman:localdev@localhost:5433/state_of_health_dev PORT=3001 npm run dev`), point `baseApiUrl` at `http://localhost:3001/api`, `npx expo run:ios`.

### Remaining for later phases
Phase 3: push notifications (expo-notifications + devices table + node-cron tick + weekly check-in push + nudges + inactivity win-back). Phase 4: training-day macros, diet breaks, premium gating. Also: manual wizard walkthrough, and consider `maestro hierarchy`-based selectors or testIDs for reliable UI automation.
