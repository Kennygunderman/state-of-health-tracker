# TDEE Mode ("Coach") — Technical Plan

**Date:** July 6, 2026
**Scope:** Adaptive TDEE engine + coached macro targets, the weekly check-in push loop, and general-purpose push notifications (including inactivity win-back). Grounded in the current `state-of-health-be` (Express 4 / Prisma 6 / Postgres, single pm2 process) and `state-of-health-tracker` (Expo 57 / RN 0.86 / TanStack Query v5 / Zustand v5) codebases.
**Monetization note:** ships free-for-now behind a feature flag with an entitlement stub, mirroring the AI quota pattern, so a paywall can gate it later without rework.

---

## 1. Product spec

### 1.1 Two modes, one targets pipeline

| | **Manual mode** (today's behavior, kept) | **Coached mode** ("TDEE Mode") |
|---|---|---|
| Calorie target | User-set (Zustand `targetCalories`, now also synced to server) | Computed weekly from measured expenditure + goal rate |
| Macro split | Fallback gram splits (as today) or user-set | Computed: protein from body weight, fat floor, carbs remainder |
| Changes over time | Only when user edits | Weekly check-in adjusts automatically (guardrailed) |
| Who it's for | Users with a coach / fixed plan | The flagship experience |

Key architectural decision: **coached plans write into the existing `users.target_*` columns** (in addition to their own history table). The Macros screen already consumes targets embedded in the `GET /macros/:date` response — so the entire existing daily UI (`DailySummaryCard` ring, `resolveMacroTargets`) works with zero changes on day one. Coached mode is a *writer* of targets, not a new consumer path.

Mode is opt-in. Entry point: a flag-gated `CoachCard` on the Macros screen (mirror `LogWithAICard` + `coach_enabled` remote config flag) that launches the enrollment wizard. Users can switch back to manual anytime, or **pause** coaching (vacation/illness) — paused = targets frozen, engine keeps observing.

### 1.2 Enrollment wizard (5 steps)

1. **Intro** — what it does, adherence-neutral promise ("no red numbers, no judgment — just better targets every week").
2. **Goal** — lose / maintain / gain.
3. **Rate** — expressed as %BW/week (UI shows lbs-or-kg/week using their unit). Bounds: lose 0.25–1.0 %BW/wk, gain 0.1–0.5 %BW/wk. Default: lose 0.5%, gain 0.25%.
4. **Profile** — sex, birth date, height (+ confirm weight unit). Needed only for the cold-start formula; copy says exactly that. All fields have a "prefer not to say" path (falls back to population averages).
5. **Reveal** — initial estimate ("Starting estimate: ~2,610 kcal/day · **Calibrating** — log meals and weigh in regularly; in ~2 weeks this becomes *your measured* expenditure, not a formula").

### 1.3 The weekly check-in ritual

Every Monday (user-local), the engine produces next week's plan. The user experiences it as an event, not a silent mutation:

- Push: "Your week is ready — expenditure 2,640 (▲40), new target 2,390."
- In-app: `WeeklyCheckInSheet` (global bottom sheet) on next app open if unacknowledged: expenditure trend sparkline, weight trend vs. goal rate, what changed and *why*, new macros, "Sounds good" (ack) / "Adjust" (opens settings).
- If they never open the sheet, the new targets still apply (plan is authoritative); the sheet just explains.

### 1.4 Product guardrails & edge cases

- **Calorie floor:** never target below 1,200 (female/unspecified) / 1,500 (male). If the rate demands less, clamp and tell the user their rate was reduced.
- **Max weekly swing:** target moves ≤150 kcal/week unless the user changed goal/rate (then full recompute).
- **Adherence-neutral always:** the engine treats every honestly-logged day as data. Over target is never an error state; copy never scolds.
- **Sparse data:** below minimum data quality (see §2.4), the check-in says "not enough data to update — targets unchanged" with a specific ask ("2 more weigh-ins this week does it").
- **Long gaps (>14 days of no logging):** engine re-enters calibrating state; targets frozen until re-calibrated.
- **Unit switching:** engine is canonical-metric internally (kg, cm, kcal); switching display units never touches stored data.
- **Multiple weigh-ins/day:** averaged per local day before trend smoothing.
- **Manual overrides inside coached mode:** user can pin protein (g/kg preference) and fat/carb bias; calories stay engine-owned. Full manual = switch modes.
- **Disclaimers:** not medical advice; nudge toward professional help if BMI-derived targets would be unsafe; require 18+ for coached mode (birth date is collected anyway).

---

## 2. The engine (pure math, no infra)

Lives in `services/coach/engine.ts` on the backend as a **pure, deterministic module**: `(profile, weighIns[], dailyIntakes[], priorSnapshot?) → snapshots[]`. No DB access inside — fully unit-testable with synthetic scenarios.

### 2.1 Trend weight

Exponentially-weighted moving average over per-local-day weigh-in averages, gap-aware:

```
trend_d = trend_prev + (1 − α_eff) is decayed across gaps:
α_eff = 1 − (1 − α)^daysSinceLastEntry,  α = 0.10
trend_d = trend_prev + α_eff × (weight_d − trend_prev)
```

Output stored per day. This also upgrades the existing BodyTab chart for free (plot trend line over raw scatter — the `MiniLineChart` already supports a reference line).

### 2.2 Expenditure (adaptive TDEE)

Energy balance over each qualifying day, smoothed:

```
impliedTDEE_d = intake_d − (Δtrend_d × 7700 kcal/kg)     // Δtrend in kg/day
TDEE_d = TDEE_prev + β × (impliedTDEE_d − TDEE_prev)      // β = 0.06
```

- Clamp `impliedTDEE_d` to [1,000, 6,000] before smoothing (single-day outlier protection).
- `TDEE_0` (cold start) = Mifflin-St Jeor from profile × activity factor derived from observed data we already have (avg steps from HealthKit activity + logged workout frequency), not a self-reported "activity level" — one less form field and more honest.
- **Blend-in:** during calibration, `TDEE_shown = w×TDEE_formula + (1−w)×TDEE_measured`, with `w` decaying from 1 → 0 as qualifying days accumulate (0 by ~day 21).

### 2.3 Weekly plan generation (Mondays, user-local)

```
weeklyDeficit = rate%BW × trendWeight × 7700        // negative for gain
targetCalories = round25(TDEE − weeklyDeficit / 7)   // then clamp: floor, ±150/wk swing
protein_g = clamp(1.6–2.2 g/kg by goal, user preference wins) × trendWeight
fat_g     = max(0.6 g/kg, 25% kcal)                  // adjustable bias
carbs_g   = remainder / 4
```

Store the plan with a machine-readable `rationale` (old/new TDEE, weight trend vs expected, which guardrails fired) — this powers the check-in copy and, later, the AI coach report.

### 2.4 Data quality gates

A day **qualifies** for the TDEE update if: total logged ≥ max(800 kcal, 50% of user's 14-day median) AND at least one meal entry exists AND it's not the first day after a ≥3-day gap. A weekly plan **updates targets** only if the trailing 14 days contain ≥8 qualifying intake days AND ≥4 weigh-in days; otherwise targets hold. Confidence = low/medium/high from those same counts (drives UI copy and the calibrating badge).

### 2.5 Testing

- Unit tests: synthetic users (steady loss, plateau, weekend-binger, sparse logger, gainer, unit-switcher, gap-then-return) with known ground-truth TDEE — engine must converge within ±100 kcal in ≤21 simulated days and never violate guardrails.
- Property tests: no NaN/∞ on degenerate input; idempotent recompute (same inputs → same snapshots) — this is what makes "recompute on read" safe.

---

## 3. Server architecture

### 3.1 Schema changes (Prisma)

```prisma
// users — add columns (all nullable; coached mode requires them, manual doesn't)
sex             String?   // 'male' | 'female' | 'unspecified'
birth_date      DateTime? @db.Date
height_cm       Float?
weight_unit     String?   // 'lbs' | 'kg' — promoted from client-only Zustand
timezone        String?   // IANA, e.g. 'America/Chicago'
last_active_at  DateTime? // for inactivity win-back (see §5)

// body_weight_entries — add unit provenance (existing rows backfilled on first
// authenticated request that includes the client's current weightUnit)
unit            String?   // 'lbs' | 'kg'; engine converts to kg

model coach_profiles {
  user_id     String   @id
  mode        String   // 'coached' | 'paused'   (absence of row = manual)
  goal        String   // 'lose' | 'maintain' | 'gain'
  rate_pct_bw Float    // %BW per week, signed by goal
  protein_pref Float?  // g/kg override
  fat_bias    String?  // 'low' | 'balanced' | 'high'
  started_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
}

model expenditure_snapshots {
  user_id        String
  day            DateTime @db.Date   // user-local day
  trend_weight_kg Float?
  tdee_kcal      Int
  confidence     String   // 'calibrating' | 'low' | 'medium' | 'high'
  @@id([user_id, day])
}

model coach_weekly_plans {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id      String
  week_start   DateTime @db.Date     // user-local Monday
  calories     Int
  protein_g    Int
  carbs_g      Int
  fat_g        Int
  tdee_kcal    Int                   // TDEE at generation
  rationale    Json
  acknowledged_at DateTime?
  created_at   DateTime @default(now())
  @@unique([user_id, week_start])    // idempotency for the cron
}

model devices {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id       String
  expo_push_token String @unique
  platform      String   // 'ios' | 'android'
  last_seen_at  DateTime @updatedAt
  created_at    DateTime @default(now())
}

model notification_settings {
  user_id        String  @id
  checkin        Boolean @default(true)
  logging_nudges Boolean @default(true)
  inactivity     Boolean @default(true)
  quiet_start    Int     @default(21)   // 21:00 local
  quiet_end      Int     @default(9)    // 09:00 local
}

model notification_log {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id   String
  type      String   // 'weekly_checkin' | 'weigh_nudge' | 'log_nudge' | 'inactivity_d3' | ...
  dedupe_key String  @unique   // e.g. 'weekly_checkin:uid:2026-07-06'
  sent_at   DateTime @default(now())
}
```

### 3.2 Endpoints (new `routes/coach.routes.ts`, `routes/device.routes.ts`)

```
POST   /coach/enroll        { goal, ratePctBw, sex?, birthDate?, heightCm?, weightUnit, timezone }
GET    /coach/state         → { mode, goal, rate, tdee, trendWeight, confidence,
                                 pendingCheckIn: WeeklyPlan | null, expenditureSeries[30d] }
PUT    /coach/settings      { goal?, ratePctBw?, proteinPref?, fatBias?, mode? ('coached'|'paused') }
DELETE /coach               → back to manual (profile row deleted; users.target_* left as-is)
POST   /coach/checkin/:planId/ack
PUT    /user/targets        → FINALLY WIRED (manual-mode writes; endpoint already exists server-side)
PUT    /user/profile        { sex?, birthDate?, heightCm?, weightUnit?, timezone }  // tz refreshed on every login
POST   /devices             { expoPushToken, platform }     // upsert, re-associates token to current user
DELETE /devices/:token
PUT    /notification-settings
```

**Recompute strategy — on-read, cron only for pushes.** `GET /coach/state` incrementally extends snapshots from the last stored day to "yesterday" (user-local) before responding — cheap because it's incremental, and idempotent by design (§2.5). The cron (§3.3) does the same computation when generating Monday plans, so plans exist (and push) even if the user never opens the app. No queue infra needed; follows the existing lazy-compute pattern (USDA cache refresh).

### 3.3 Scheduler

Add **`node-cron` inside the existing Express process** (single VPS, pm2 — no Redis/BullMQ; revisit only if user count makes the hourly sweep slow, and note pm2 `instances: 1` must stay 1 or the cron double-fires).

One tick, every 15 minutes: `services/scheduler/tick.ts`
1. **Weekly plans:** users in coached mode whose local time is Monday ≥ 08:00 and have no `coach_weekly_plans` row for this local week → run engine, insert plan, write `users.target_*`, enqueue check-in push. `@@unique([user_id, week_start])` + `notification_log.dedupe_key` make restarts/overlaps harmless.
2. **Nudges & win-back:** evaluate rules in §5 against `last_active_at`, meal entries, and weigh-ins; respect quiet hours, per-category settings, and the global ≤1 push/user/day cap (checked against `notification_log`).
3. **Push delivery:** send via `expo-server-sdk` in batches; process receipts; prune `devices` rows on `DeviceNotRegistered`.

`users.last_active_at` is maintained by a tiny middleware after auth (throttled: update at most once/hour per user to avoid a write per request).

### 3.4 Push provider decision

**Expo Push Service** (`expo-notifications` client + `expo-server-sdk` server). Rationale: the app is a managed Expo/EAS app — credentials are already handled by EAS; no new native module (RN Firebase messaging would require one); one API covers iOS now and Android later. `firebase-admin` FCM stays as a documented fallback. Kill switches: `PUSH_ENABLED` env + `push_enabled` remote config (client-side suppression of the prime card).

### 3.5 Timezone policy

Client sends `Intl.DateTimeFormat().resolvedOptions().timeZone` on enroll and on every login (`PUT /user/profile`). All coach math and scheduling use the stored IANA tz (via `date-fns-tz`, sibling of the existing `date-fns` dep). Macro day-keying stays client-supplied (unchanged, consistent with the app); the engine simply consumes `meal_entries.date` as the user-local day it already is. Known pre-existing quirk (AI quota resets on UTC) is out of scope.

---

## 4. Client architecture

### 4.1 New query module — `src/queries/coach/`

Follows the house pattern exactly (endpoint → io-ts codec → api fn → hook with centralized keys):

- `useCoachStateQuery` — key `queryKeys.coachState` (`['coachState']`); **added to `PERSISTED_QUERY_KEYS`** so targets/TDEE render offline.
- `useEnrollCoachMutation`, `useUpdateCoachSettingsMutation`, `useAckCheckInMutation`, `useUpdateProfileMutation`, `useRegisterDeviceMutation`.
- Mutations invalidate `coachState` **and `dailyMacros(today)`** (targets embedded there change when a plan lands).
- Codecs in `src/queries/api/coach/decoder/CoachDecoder.ts` using the existing `nullableNumber` helpers.

### 4.2 Screens & components

- **Enrollment wizard:** new screens in `MacrosStack` (`CoachIntro`, `CoachGoal`, `CoachRate`, `CoachProfile`, `CoachReveal`) — flat `Stack.Screen` additions + `Screens.*` constants; wizard-local state in a small Zustand store discarded on completion.
- **`CoachCard`** on Macros screen (in `renderDay`, gated by `isCoachEnabled()` remote-config getter added to `setDefaults`): pre-enrollment = pitch CTA; enrolled = compact status (TDEE, confidence chip, next check-in day). Template: `LogWithAICard`.
- **`DailySummaryCard`:** add a "Coached" chip when `coachState.mode === 'coached'` — targets themselves keep arriving via the daily macros response (no data-flow change).
- **`WeeklyCheckInSheet`:** content component for `openGlobalBottomSheet(...)`; triggered in Macros screen effect when `coachState.pendingCheckIn` is set, and by push deep link. Sparkline via existing `MiniLineChart`.
- **Progress > BodyTab:** overlay trend-weight line on the existing weigh-in chart; new **Expenditure card** (30-day TDEE `MiniLineChart` + confidence badge + "what is this?" → info bottom sheet, template `BurnInfoBottomSheet`).
- **Account screen:** new "Coach" section (goal/rate/pause/switch-to-manual via `InputModal`-style dialogs) + "Notifications" section (per-category toggles backed by `notification_settings`).
- **Manual-mode change:** `TargetCaloriesModal` (and a new macro-split modal, optional) now also calls `PUT /user/targets` so server and client stop diverging; Zustand value remains the offline fallback exactly as `resolveMacroTargets` works today.

### 4.3 Push client & deep linking

- Add `expo-notifications`. **Permission priming:** copy the HealthKit "Connect" card pattern (soft in-app card → real OS prompt via mutation → denied-state card linking to `Linking.openSettings()`). Prime at high-intent moments only: end of coach enrollment ("get your Monday check-in") and after a 3-workout week — never at cold launch.
- Token lifecycle: on auth + permission grant → `POST /devices`; on logout → `DELETE /devices/:token`.
- **Deep linking (greenfield):** add `linking` config to `NavigationContainer` with scheme `soh://` — `soh://checkin` (Macros + open check-in sheet), `soh://macros`, `soh://workouts`. Notification payloads carry the URL; foreground/background tap handlers route through it.

---

## 5. Notification loops

All pushes: adherence-neutral copy, quiet hours (default 21:00–09:00 local), per-category opt-out, global cap **≤1 push/user/day** (weekly check-in exempt from the cap but not from quiet hours), every send recorded in `notification_log` with a dedupe key.

### 5.1 Weekly check-in (coached users) — the flagship loop
- **When:** Monday 08:00–09:00 local (first tick after 08:00).
- **Copy (data present):** "Your week is ready — expenditure 2,640 (▲40). New target: 2,390 kcal."
- **Copy (held):** "Targets holding steady this week — 2 more weigh-ins would sharpen your estimate."
- **Tap →** `soh://checkin`.

### 5.2 Calibration & logging nudges (coached users, opt-out-able)
- **Weigh-in nudge:** no weigh-in logged by 10:00 local → "30 seconds on the scale keeps your expenditure accurate." Max 3/week, only while confidence < high.
- **Evening log nudge:** < 800 kcal logged by 19:30 local → "Quick check-in? Even a rough AI log keeps your numbers honest." Max 2/week. (Reuses the §2.4 qualifying-day threshold — one definition of "logged enough" everywhere.)
- Both suppressed entirely during `paused` mode.

### 5.3 Inactivity win-back (ALL users — independent of coach)
Trigger on `last_active_at` age; one shot per tier, sent ~18:00 local; stops permanently after D30 unless the user returns (return resets tiers):

| Tier | Copy angle |
|---|---|
| D3 | Utility: "Your streak isn't broken yet — log today in 10 seconds with AI." |
| D7 | Value: "A week of data makes your trends better, not worse. Pick up where you left off." |
| D14 | Coached: "Your expenditure estimate is going stale — one weigh-in revives it." / Non-coached: feature tease (AI logging quota reset) |
| D30 | Honest last touch: "We'll stop nudging. Your data's safe whenever you're back." |

### 5.4 Later (out of scope here, rails already built)
Workout-day reminders tied to `targetWorkouts`, streak protection, PR celebrations — all become trivial rule additions to the scheduler tick.

---

## 6. Premium hooks (design-only for now)

- `coach_enabled` remote-config flag (kill switch) + server env `COACH_ENABLED`.
- `entitlement.service` grows `assertCoachAccess(userId, email)` — currently always-allow with `COACH_UNLIMITED_EMAILS`-style whitelist plumbing, so the future paywall (per `ai-premium-plan.md` / `premium-paywall-shelved` branch) only swaps the check's internals. UI shows "Free for a limited time" chip like AI logging does.
- The natural premium bundle later: coached targets + weekly check-in + unlimited AI + (future) coach report. Manual mode and all logging stay free forever (see roadmap research: never claw back shipped free features).

---

## 7. Phasing & sequencing

**Phase 0 — Foundations (schema + profile).** Prisma migration (§3.1 users/devices/settings columns & tables), `PUT /user/profile`, wire `PUT /user/targets` client-side, weigh-in `unit` backfill, tz capture on login. *No visible feature yet; fully shippable.*

**Phase 1 — Engine, read-only.** `engine.ts` + tests, `expenditure_snapshots`, `GET /coach/state` (no plans yet), trend line on BodyTab, Expenditure card with "calibrating" state, `CoachCard` teaser ("Your measured expenditure — coming to your targets soon"). *Ships value immediately, builds the data runway and user trust in the number before it controls anything.*

**Phase 2 — Coached targets.** Enrollment wizard, `coach_profiles`, Monday plan generation (on-read: generated when the user opens the app during week N if missing — no cron yet), `WeeklyCheckInSheet`, plans write `users.target_*`, Account coach settings. *The core feature, still zero new infra.*

**Phase 3 — Push.** `expo-notifications` + devices endpoints + permission prime, `node-cron` tick, weekly check-in push (cron now generates plans server-side), logging/weigh-in nudges, inactivity win-back, notification settings UI, deep linking. *The retention loop.*

**Phase 4 — Polish & premium.** Training-day/rest-day calorie distribution (uses `workout_days` — the thing MacroFactor can't do), diet-break support, confidence UI refinements, entitlement flip when the paywall relaunches.

Each phase is independently shippable; 1→2→3 is the recommended order even if TestFlight-only between them (Phase 1's calibration runway means Phase 2 users get real coached targets on day one).

---

## 8. Decisions (resolved July 6, 2026 — recommendations accepted)

1. **Branding:** "Coach" — both as code name and UI name ("Coach" tab-less feature, marketed as adaptive targets). Simple, human, matches the adherence-neutral tone.
2. **Weigh-in history:** backfill `body_weight_entries.unit` from the user's current client `weightUnit` on first authenticated profile sync. Users essentially never switch units; pragmatic and preserves trend history.
3. **Rate input:** %BW/week stored (`rate_pct_bw`), displayed as lbs/kg-per-week in the UI. Correct across body sizes, legible on screen.
4. **Check-in day:** fixed Monday for v1. One less setting, stronger ritual.
5. **HealthKit:** not required for enrollment. Steps refine the cold-start activity factor when available; feature never gates on the permission.

Execution is tracked in `tdee-coach-execution-log.md`.
