# State of Health — Feature Roadmap & Differentiation Research

**Date:** July 6, 2026
**Method:** Multi-agent web research (103 agents, 21 sources fetched, 98 claims extracted, top 25 adversarially verified — 20 confirmed, 5 refuted) + full inventory of the current SoH codebase.

**How to read confidence labels:**
- ✅ **Verified** — survived 3-vote adversarial fact-checking against primary sources (RevenueCat/Adapty reports, MacroFactor's own docs, peer-reviewed papers).
- 📊 **Directional** — from credible sources (aggregated app reviews, comparison articles, Reddit syntheses) but not independently verified. Treat as signal, not gospel.
- ⚠️ Specific competitor dollar prices repeatedly failed verification (they change often and vary by region). All prices below are approximate; re-check App Store listings before anchoring your own pricing.

---

## 1. TL;DR — the five things that matter most

1. **Adaptive TDEE is your single most defensible feature gap.** ✅ Among MyFitnessPal, Cronometer, and MacroFactor, *only* MacroFactor has an adaptive expenditure algorithm (intake + weight trend → actual TDEE, auto-adjusting targets). It's the reason a paid-only app grew 35k → 400k+ users in 3 years. You already collect everything it needs (food logs, weigh-ins, workouts, runs, steps). It's math + product design, not a big-team feature — and **you can go one better than MacroFactor by feeding actual training data into it** (they don't have workout logging at all).
2. **The "all-in-one" positioning only works if the integration creates value neither half has alone.** 📊 Reddit lifters actively distrust all-in-one apps ("they do both things poorly") and the accepted norm is a two-app stack (Hevy/Strong + MacroFactor/MFP). Even Caliber — a "combined" app — outsources nutrition to Cronometer. Don't market "one app does both." Market what the two-app stack *can't do*: training-aware nutrition, expenditure driven by real logged training, one weekly picture of lift + eat + run + weight.
3. **Close the table-stakes gaps: barcode scanner, rest timer, watch app, widgets/Live Activities, push notifications, body measurements/photos.** ✅/📊 Barcode scanning behind MFP's paywall is still generating 1-star reviews in mid-2026 — shipping it free is a cheap, known-grievance wedge. Real-time Apple Watch sync is the single most praised stickiness feature in Hevy reviews. SoH currently has none of these.
4. **Monetization: reinstate the shelved paywall with an annual-anchored plan and a 2–4 week trial.** ✅ Health & Fitness is the best-monetizing app category there is (highest download→paid conversion, highest payer LTV). Yearly plans are ~67% of subscriptions sold in the category and retain up to 36% at 12 months vs 6.7% for pricey monthly plans. Trials of 17–32 days convert ~42.5% vs 25.5% for ≤4-day trials. Hard(er) paywalls convert ~5x better per install with identical 1-year retention.
5. **Retention is won in the first 14 days.** ✅/📊 55% of 3-day-trial cancellations happen on Day 0 (84% within 24h) — onboarding *is* the conversion funnel. Users completing <3 workouts in their first 14 days churn at 3–4x the rate. The #1 stated cancellation reason across fitness apps is loss of motivation (38%), not price. This is the argument for push notifications, streaks/weekly goals, and a weekly "coach report" — features you haven't shipped yet.

---

## 2. Competitor landscape & pricing matrix

⚠️ Prices are approximate (early-to-mid 2026, US App Store) and failed strict verification — verify before quoting.

### Nutrition / macro trackers

| App | Price (approx.) | Free tier | Standout features | Known weaknesses |
|---|---|---|---|---|
| **MacroFactor** | ~$11.99/mo, ~$71.99/yr (~$6/mo effective), 7-day trial | None (paid-only) | ✅ Adaptive TDEE (the only one); AI photo+text logging (Apr 2025, database-grounded); Apple Watch food logging (Sept 2025); barcode; 54 tracked nutrients; adherence-neutral design | 📊 No workout programming (users explicitly request it); food DB thinner than MFP for everyday items; subscription-only is the dominant negative review theme |
| **MyFitnessPal** | ~$19.99/mo, ~$79.99/yr | Yes, heavily nagged | Biggest food DB (~20M crowdsourced); Meal Scan; acquired Cal AI (Mar 2026) | ✅ Barcode scan paywalled since Oct 2022 — still driving 1-star reviews in 2026; 📊 ~20–27% of DB entries have >10% errors; "excessive" pricing perception; bot-only support complaints |
| **Cronometer** | Gold ~$8.99/mo, ~$49/yr | Yes, generous | ✅ Barcode free on all tiers; 82–84 micronutrients from verified DBs (USDA/NCCDB) | No AI photo logging; static calorie formula (no adaptive TDEE) |
| **Lose It!** | ~$39.99/yr | Yes | Snap It photo logging; cheapest annual | Weight-loss-only framing, shallow for lifters |

### Workout trackers

| App | Price (approx.) | Free tier | Standout features | Known weaknesses |
|---|---|---|---|---|
| **Hevy** | Pro ~$24–60/yr (sources conflict); 12M+ users | Very generous (unlimited workouts) | 📊 Best-in-class Apple Watch real-time sync (most-praised feature); social feed; 4.9★ | 📊 "A logger, not a programmer" — top user requests are auto progressive-overload programming and AI autoregulation; weak cardio/calorie handling |
| **Strong** | ~$4.99/mo, ~$59.99–99.99 lifetime | Limited (3 routines) | The Reddit classic; lifetime pricing option | No programming intelligence; no HRV/sleep/recovery integration; development pace criticized |
| **Boostcamp** | Plus ~$9.99/mo | Free coach programs | Free programs from Israetel/Nippard/Thrall; auto progressive overload from logged performance | Analytics behind paywall |
| **Fitbod** | ~$12.99–15.99/mo, ~$79.99–95.99/yr | Very limited | AI-generated workouts from per-muscle recovery + equipment | 📊 No mesocycle periodization; fights specific programs (5/3/1, PPL); users treat its AI as "sanity-check, not coach" |
| **Alpha Progression** | ~$10/mo, ~$64/yr | Trial-ish | Auto progression suggestions | Smaller ecosystem |
| **RP Hypertrophy** | ~$25–35/mo (!) | No | 45+ templates, deep periodization | 2.8★ Trustpilot; price resentment |
| **Caliber** | Free tier; $19/mo group; $200+/mo 1:1 | Yes | Human coaching hybrid | 📊 Doesn't do nutrition natively — integrates Cronometer (proof of the all-in-one gap) |

### The pricing white space

A serious lifter running the standard two-app stack pays roughly **$96–132+/yr** (e.g., Hevy Pro + MacroFactor). Nobody credible offers excellent-at-both for one subscription. **SoH at ~$59.99–79.99/yr with a 14–30 day trial undercuts the bundle while charging more than any single lifting tracker** — justified by the nutrition+AI side. (✅ Annual-anchored pricing is the verified category norm: yearly = ~67% of H&F subscriptions sold, and H&F is the *only* category where annual share is still growing, 51% → 61% of revenue 2023–2025.)

Also verified as a strategy input: ✅ AI-branded subscription apps monetize ~41% better per payer but churn ~30–36% faster — AI features sell the subscription, habit features keep it.

---

## 3. User complaint themes (what the market is telling you)

All 📊 directional (aggregated App Store reviews via JustUseApp, Trustpilot, Reddit syntheses):

**Nutrition apps**
- Paywalling formerly-free basics (MFP barcode) = years-long resentment engine. Don't ever move a shipped free feature behind the paywall.
- Database quality beats UI polish: users who *prefer* MacroFactor's UX still cite missing everyday foods as a switching barrier. Your USDA-grounded approach is a quality story; coverage of branded/restaurant items is the risk.
- Subscription-only with no free tier is MacroFactor's dominant negative theme (and its trial-end conversion is called "predatory" in reviews). SoH's freemium + AI-quota model sidesteps this — keep a genuinely useful free tier.
- MacroFactor's most-praised traits: adaptive TDEE and **adherence-neutral design** — no red numbers, no shaming when you go over. Users say it's why they keep logging. Cheap to copy, high emotional value.
- Tedious manual entry is still the #1 friction everywhere — this is your AI logging's reason to exist. Logging speed wins app choices.

**Workout apps**
- Logging speed is the dominant selection criterion — the praised bar is **2–3 taps per set**. Audit your live-session flow against this number.
- Top requested missing feature in Hevy: automatic progressive-overload programming / AI autoregulation (users name Juggernaut AI). You already have progressive-overload *hints* — extending them toward actual programming attacks the biggest gap in the most popular tracker.
- Data loss when switching devices + no export = recurring 1-star driver. CSV export is a cheap trust feature (also requested on Reddit alongside offline capability).
- Recovery integration (HRV/sleep) is absent in Strong, Hevy, Boostcamp, Jefit — an open differentiation lane.
- Serious lifters are skeptical of gamification-for-its-own-sake and social feeds (motivated by strength gains, not badges) — but time-boxed challenges work even without a social feed (MacroFactor's 100-day Transformation Challenge drew 20,000+ participants).

**The all-in-one skepticism (your core strategic problem)**
- Reddit consensus: apps that try to do workouts + nutrition "do both things poorly"; two-app stacks are the norm. MFP is what people use when they want both, and its workout side is weak.
- Implication: you must clear the "good enough to replace my dedicated app" bar on each half, and then win on what the stack can't do. Which leads to…

---

## 4. Differentiation strategy — 5 positioning angles

### Angle 1: "The integration IS the product" (primary recommendation)
Nobody — not MacroFactor (no workouts), not Hevy (no food), not Caliber (outsources nutrition) — can connect training and nutrition with real data. You can:
- **Adaptive expenditure that sees your training.** MacroFactor infers TDEE from intake + weight only. You additionally have logged sets/volume, GPS runs, and steps. Even if the core algorithm is the same regression, the *story* ("your targets know when you trained") is unique.
- **Training-day vs rest-day macros** driven automatically by your actual schedule — MacroFactor makes users configure this manually; you can flip it based on whether a session was logged.
- **Protein/calorie targets tied to training goal** (cut/maintain/gain) with the weight-trend chart, strength PRs, and macro adherence on one screen.
- **One weekly review across all of it** (see Angle 4).

Tagline direction: *"Your lifting app and your macro app finally talk to each other."* This reframes the all-in-one skepticism — you're not "two mediocre apps in one," you're the closed loop.

### Angle 2: One subscription replaces two
Price against the bundle, not against any single app: "Hevy Pro + MacroFactor costs $100+/yr. State of Health does both for $69.99." Underprice MacroFactor annual slightly; stay well above lifting-tracker-only prices.

### Angle 3: Fastest logging in the category (AI-first)
You already have text/voice/photo AI logging — that's ahead of Cronometer and level with MacroFactor/MFP. Extend the speed story everywhere: 2–3-tap set logging, barcode scan, watch quick-log, lock-screen widgets, Live Activity rest timer. Speed is the #1 stated selection criterion on both the lifting and nutrition sides. ✅ One caveat from verified research: portion/volume estimation from photos is genuinely unsolved industry-wide (20–50% portion-weight errors in 2026 benchmarks) — design photo logging around fast *confirmation/editing*, never around claimed accuracy. And adopt MacroFactor's verified quality bar: ground AI output in real database entries (map Gemini results onto USDA foods) rather than letting the LLM emit macros directly.

### Angle 4: The adherence-neutral weekly coach
✅ The #1 cancellation reason category-wide is loss of motivation (38%), and 📊 social-feature apps see 20–35% lower churn — but your audience dislikes performative social. The middle path: a **weekly AI coach report** ("Here's what happened this week: weight trend −0.4 lb, expenditure ~2,850, protein hit 5/7 days, squat e1RM up 2%; here's next week's targets") + adherence-neutral tone throughout + optional time-boxed challenges. This is a natural premium feature and a retention engine, and as a solo dev with an LLM pipeline already built, it's very reachable.

### Angle 5: Trust & data ownership
CSV export, device-to-device migration that never loses data, no ads, no selling data, no features clawed back from free. Individually small; together they're the anti-MFP identity, and they match what Reddit lifters say they evaluate apps on.

---

## 5. Ranked feature candidates

Effort scale (solo dev): **S** = days–1wk · **M** = 2–4 wks · **L** = 1–3 mo · **XL** = 3mo+

### Tier 1 — Ship next (high impact, closes table-stakes gaps or unlocks strategy)

| # | Feature | Effort | Rationale |
|---|---|---|---|
| 1 | **Adaptive TDEE / expenditure engine** ("Your Expenditure") + auto-adjusting macro targets with weekly check-ins | M–L | ✅ The verified rarest high-value feature in the market; you have all inputs already. Trend-weight smoothing (exponential moving average) + energy-balance regression over intake & weight change. Start simple, iterate like MacroFactor did (they're on V3). This is the anchor of Angle 1 and the strongest paywall feature. |
| 2 | **Barcode scanner** (free tier) | S–M | ✅ Verified wedge: MFP paywalls it, Cronometer wins goodwill giving it free, users still rage-review MFP over it in 2026. Expo camera + Open Food Facts / USDA UPC lookup. Also fixes your everyday-branded-foods coverage risk. |
| 3 | **Rest timer** (+ Live Activity / Dynamic Island) | S–M | Table stakes in every lifting app; you don't have one. You already have a LIVE_ACTIVITIES_PLAN.md — the rest timer is its best first use case. |
| 4 | **Push notifications + streak/habit layer** | M | ✅ <3 workouts in first 14 days → 3–4x churn; Day-0/1 decides trial conversion. Workout-day reminders, weigh-in nudges, weekly-goal progress ("2 of 4 workouts done"), trial-onboarding sequence. Requires expo-notifications + server scheduling you don't have yet — but it's the retention backbone. |
| 5 | **Reinstate paywall: annual-anchored, 14–30 day trial, onboarding revamp** | M | ✅ All four verified monetization findings point here: best-monetizing category, annual plans dominate & retain 5x better, long trials convert ~70% better, first session decides. Unshelve the `premium-paywall-shelved` branch; gate the adaptive engine, coach report, and unlimited AI behind it. |
| 6 | **Body measurements + progress photos** | S–M | On your own not-shipped list; standard in Hevy/Strong/MFP; pairs naturally with the weight-trend chart and makes "body" a real tab. Photos = private, on-device/your-backend only — trust story. |
| 7 | **iOS widgets** (macro rings, weekly workouts, streak) | S–M | Cheap daily-touchpoint surface; pairs with the habit layer; competitors ship them. |
| 8 | **Database-grounded AI logging upgrade** | M | ✅ MacroFactor's verified architecture: LLM decomposes the meal → maps to *real* USDA entries instead of emitting macros. Improves accuracy, auditability, and lets users edit ingredient-by-ingredient. You have the USDA pipeline already. |
| 9 | **CSV export (workouts + nutrition + weight)** | S | 📊 Recurring complaint/1-star driver elsewhere; near-zero effort; trust identity (Angle 5). |

### Tier 2 — The differentiation layer (next 3–6 months)

| # | Feature | Effort | Rationale |
|---|---|---|---|
| 10 | **Weekly AI coach report** (lift + eat + weight + runs synthesized; adherence-neutral tone) | M | Angle 4. Unique to an all-in-one; premium anchor; attacks the #1 churn cause (motivation). Reuses your existing LLM backend. |
| 11 | **Training-aware nutrition automation** (training/rest-day macros auto-detected; post-workout "log a meal?" nudge) | M | Angle 1 made concrete; MacroFactor users configure this by hand — yours just knows. |
| 12 | **Progressive overload → actual programming** (double-progression rules per exercise, suggested next-session weights/reps, plate calculator, warm-up sets, e1RM tracking, deload suggestion after stalls) | M–L | 📊 The top requested gap in Hevy reviews and the "loggers, not programmers" market critique. You already have hints + history; this upgrades them into a coach. |
| 13 | **Apple Watch app v1** (live set logging, rest timer on wrist, heart rate during sessions) | L | ✅ Verified competitor commitment (MacroFactor, MFP, Cronometer, Lose It!, Hevy, Strong all ship one); 📊 Hevy's most-praised stickiness feature. Big lift in RN-land (native watchOS/SwiftUI target) — schedule deliberately. v2: watch food quick-log (voice → AI). |
| 14 | **Micronutrient tracking** | M | USDA data already contains it; Cronometer proves demand (82–84 nutrients); MacroFactor tracks 54. Even "protein + fiber + sodium + key vitamins" beats your current macro-only view. |
| 15 | **HealthKit deepening: write workouts/weight, read sleep & HRV** | M | Write = shows up in Apple ecosystem (shareability, Rings credit). Sleep/HRV read feeds #16. Also on-ramp for Garmin/Whoop users via HealthKit without direct partnerships. |
| 16 | **Recovery-aware suggestions** ("HRV/sleep down → consider lighter session") | M (after 15) | 📊 Absent from Strong/Hevy/Boostcamp/Jefit per 2026 comparisons — open lane, and it's a data-integration feature, not a CV/ML moat feature. |
| 17 | **Time-boxed challenges** (e.g., "8-Week Consistency Challenge," no social feed required) | M | 📊 MacroFactor's 100-day challenge: 20k+ participants, no feed needed; sidesteps lifter gamification-skepticism. |
| 18 | **Hydration / caffeine / alcohol tracking** | S | Cheap parity items (MacroFactor tracks all three); rounds out "all-encompassing." |

### Tier 3 — Later / strategic bets

| # | Feature | Effort | Notes |
|---|---|---|---|
| 19 | Watch food logging + complications | M (after 13) | Match MacroFactor's Sept 2025 move. |
| 20 | Android + Health Connect | XL | Doubles market; RN gets you most of the way, but Health Connect + Play billing + testing is real. Sequence after iOS differentiation is proven. |
| 21 | Social layer (friends, shared workouts) | L | 📊 Social apps churn 20–35% less, but your audience is feed-skeptical — do it only after challenges validate demand. Hevy's moat is its 12M-user network; don't fight there early. |
| 22 | Program marketplace / famous-coach programs | L | Boostcamp's angle; content licensing hassle; park it. |
| 23 | Form check via camera (CV) | XL — **skip** | Big-team moat feature; accuracy expectations are brutal; liability. Verified research shows even food-photo portion estimation is unsolved — pose-based form critique is harder. |
| 24 | Fasting timers, supplements tracking, period tracking | S–M each | Parity checkboxes if/when users ask; MacroFactor ships fasting-day support and period tracking. |

---

## 6. Monetization & retention playbook (verified benchmarks)

All ✅ verified against RevenueCat State of Subscription Apps 2025/2026 and Adapty 2026 benchmarks (correlational platform data, not A/B evidence — treat as priors):

**Pricing structure**
- Anchor on **annual** (~67% of H&F subs sold are yearly; only category where annual share still grows). Offer monthly at a deliberately unattractive ratio (e.g., $9.99/mo vs $69.99/yr).
- Cheap annual retains ~36% at 12 months; expensive monthly retains ~6.7%. Don't be tempted by a high monthly price.
- Expect steep renewal decay as normal: ~59% at first renewal → ~28% by fifth cycle. 📊 Median fitness-app monthly churn is ~9.2%; top quartile ~2%.
- Caveat: 35% of annual-plan cancellations happen in month 1 — annual is not a lock; the product still has to deliver immediately.

**Trial & paywall**
- Use a **14–30 day trial** (17–32-day trials: 42.5% median trial→paid vs 25.5% for ≤4-day). Most of the market is moving the wrong way (toward ≤4 days) — exploit that.
- Hard(er) paywalls convert ~5x per install ($3.09 vs $0.38 D60 RPI) with identical 1-year retention. You don't need to gate everything — your planned freemium + AI-quota model is fine — but don't be shy about gating the *good* stuff (adaptive engine, coach report, unlimited AI, advanced analytics).
- **Day 0 decides**: 55% of 3-day-trial cancellations happen on Day 0, 84% within 24h. The first session must reach the "aha": import/log first workout, log first meal via AI, see the expenditure/weight-trend promise. Invest in onboarding like it's a feature.

**Retention levers ranked by evidence**
1. First-14-days habit formation (workout frequency is the strongest churn predictor) → notifications, streaks, weekly goal.
2. Watch + widgets + Live Activities (competitor-proven engagement surfaces; Hevy's stickiest feature).
3. Motivation maintenance (38% of cancellations) → weekly coach report, adherence-neutral tone, challenges.
4. Annual plan mix itself (structurally 5x better retention).
5. 📊 Social/community (−20–35% churn) — later, validate with challenges first.

**AI positioning note:** ✅ AI-branded apps earn ~41% more per payer but churn ~30–36% faster. Sell the subscription with AI (logging, coach report); *keep* it with habit infrastructure (streaks, watch, notifications, weekly review). Build both sides.

---

## 7. Suggested sequencing (opinionated)

**Phase 1 — "Close the gaps, light the funnel" (~6–8 wks):** Rest timer (+Live Activity) → barcode scanner → CSV export → push notifications + streaks → body measurements/photos → widgets.
*Everything here is S/M, kills known complaints, and builds the retention rails the paywall needs.*

**Phase 2 — "The moat" (~8–12 wks):** Adaptive TDEE engine + auto-adjusting targets → database-grounded AI logging → training-day macros → onboarding revamp → **relaunch paywall** (annual anchor, 14–30d trial) gating: adaptive engine, unlimited AI, coach report (teased), advanced analytics.
*Ship the paywall WITH the adaptive engine — that's the "worth paying for" moment.*

**Phase 3 — "The coach" (~10–14 wks):** Weekly AI coach report → progression/programming upgrade → micronutrients → HealthKit write + sleep/HRV read → recovery-aware suggestions → first challenge event.

**Phase 4 — "Expand" (quarter+):** Apple Watch app → hydration/caffeine → watch food logging → then decide Android vs social based on traction.

---

## 8. Open questions the research couldn't settle

1. Exact current competitor prices (all specific price claims failed verification — check App Store listings directly when setting yours).
2. Whether widgets/Live Activities/streaks measurably move retention (competitor commitment is proven for watch apps; the rest is inferred).
3. How accurate an adaptive-TDEE v1 must be before users trust it — MacroFactor's methodology is public in broad strokes (trend weight + intake regression) but their tuning isn't. Mitigation: show confidence ranges, be transparent about the math, iterate publicly like they do.
4. Whether the two-app crowd will actually switch (vs. adding SoH as a third app). The bundle-price + integration pitch is the bet; validate with a landing-page test or TestFlight cohort before Phase 2 is done.

## Sources (key)

- RevenueCat State of Subscription Apps 2025 & 2026 — revenuecat.com/state-of-subscription-apps
- RevenueCat 2026 benchmarks blog — revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026
- Adapty Health & Fitness subscription benchmarks 2026 — adapty.io/blog/health-fitness-app-subscription-benchmarks
- MacroFactor: AI food logging architecture — macrofactor.com/ai-food-logging; Annual Report 2025 — macrofactor.com/annual-report-2025; expenditure docs — help.macrofactorapp.com
- Frontiers in Nutrition (2025) scoping review of image-based dietary assessment — frontiersin.org/journals/nutrition/articles/10.3389/fnut.2025.1501946
- Aggregated user reviews: JustUseApp (MacroFactor, Hevy), Trustpilot (MyFitnessPal)
- Comparison/roundup articles (directional): nutrola.app, askvora.com, mesostrength.com, gymscore.ai, hootfitness.com, setgraph.app, garagegymreviews.com (Caliber review), retentioncheck.com
