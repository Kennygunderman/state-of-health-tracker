# Meal planning — mobile engineering guide

The engineering entry point for the meal-planning feature in this repository: where each Figma
frame landed, how to run the feature locally, which conventions it broke and why, and — in the last
two sections — what this delivery could **not** verify.

This path is load-bearing. `mobile/README.md` links `docs/meal-planning.md`, so renaming or moving
this file breaks that link.

**What this guide does not own.** The API, its database, the food catalog, the recipe seeds and the
operator command order live in the sibling repository and are documented there. Section 11 links
those documents; nothing here restates them, so when the two disagree about the server, the backend
documents are right.

| Section                                                                                                 |                                                                         |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [1. Screen ↔ Figma map](#1-screen--figma-map)                                                          | Which frame is which screen, and what the frame numbering does not mean |
| [2. Where the code lives](#2-where-the-code-lives)                                                      | Directory map and the one new module convention                         |
| [3. Running it locally](#3-running-it-locally)                                                          | Command order, and the two switches that make the feature appear at all |
| [4. Environment and the API-origin guard](#4-environment-and-the-api-origin-guard)                      | Why a debug build refuses production, and how requests are held there   |
| [5. Typeface](#5-typeface-helvetica-neue-vs-the-platform-default)                                       | A recorded, reversible deviation from Figma                             |
| [6. Tokens and the style gate](#6-tokens-and-the-style-gate)                                            | New tokens, the literal scan, and three gaps left open                  |
| [7. Lint: the baseline gate](#7-lint-the-baseline-gate)                                                 | Two commands, and the exit code that is _not_ the gate                  |
| [8. `npm ci` and the peer-dependency workaround](#8-npm-ci-and-the-peer-dependency-workaround)          | Documented, deliberately not fixed                                      |
| [9. Why two files in `scripts/` are not TypeScript](#9-why-two-files-in-scripts-are-not-typescript)     | A convention break with a reason                                        |
| [10. Physical-device verification checklist — UNRUN](#10-physical-device-verification-checklist--unrun) | Reproduced in full, every item unchecked                                |
| [11. Cross-repository pointers and delivery shape](#11-cross-repository-pointers-and-delivery-shape)    | The two pull requests and their order                                   |

---

## 1. Screen ↔ Figma map

The visual source of truth is the Figma file **"Meal Plan Flow — State of Health"**, file key
`ZytSsn2tKVpMCSoibMJ274`: 31 screen states, all 393×852, each with an adjacent "— note" frame
carrying implementation guidance. Several of those notes are the only record of a behavioural
decision, so read the note beside a frame before changing the screen it describes.

Open any node by appending its id to the file URL, with every `:` replaced by `-`:

```text
https://www.figma.com/design/ZytSsn2tKVpMCSoibMJ274/Meal-Plan-Flow-%E2%80%94-State-of-Health?node-id=<id>
```

So node `46:9` is `?node-id=46-9`, node `34:301` is `?node-id=34-301`, node `38:504` is
`?node-id=38-504`.

**Everything drawn inside a frame is sample content** — the dates, meal names, calorie figures,
quantities and badges are illustrative, not fixtures and not defaults. Only frame 01's explicitly
labelled "Example week" card is static illustrative content in the app; every other value on every
other screen comes from the API. A frame showing a selected option is likewise not a preselected
answer: the wizard steps open with nothing chosen.

### The 14 flows and their 31 states

| Flow | Frame(s)                                                  | Node(s)                        | Implemented in                                                                                                          |
| ---- | --------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| F1   | 01 Introduction                                           | `46:9`                         | `src/screens/MealPlanIntro/`                                                                                            |
| F1   | 02 Your goal                                              | `46:136`                       | `src/screens/MealPlanGoal/`                                                                                             |
| F2   | 03 About you · 03b About you errors                       | `46:260` · `46:404`            | `src/screens/MealPlanAboutYou/` — both states, one screen                                                               |
| F3   | 04 Activity                                               | `47:9`                         | `src/screens/MealPlanActivity/`                                                                                         |
| F3   | 05 Diet and allergies                                     | `47:116`                       | `src/screens/MealPlanDiet/`                                                                                             |
| F4   | 06 Food preferences                                       | `47:238`                       | `src/screens/MealPlanFoodPreferences/`                                                                                  |
| F4   | 06b Food search                                           | `47:346`                       | `src/screens/MealPlanFoodSearch/`                                                                                       |
| F5   | 07 Meals and schedule                                     | `47:471`                       | `src/screens/MealPlanSchedule/`                                                                                         |
| F5   | 08 Cooking and budget                                     | `47:582`                       | `src/screens/MealPlanCookingBudget/`                                                                                    |
| F6   | 09 Targets and review                                     | `34:9`                         | `src/screens/MealPlanTargets/`                                                                                          |
| F6   | 09b Edit targets                                          | `34:185`                       | `src/screens/MealPlanEditTargets/`                                                                                      |
| F7   | 10 Generating · 10b Generation failed · 10c No match      | `34:301` · `34:364` · `34:436` | `src/screens/MealPlanGenerating/` — three states, one screen                                                            |
| F8   | 11c No plan · 11 Meal plan · 11b Meal plan logged         | `49:433` · `49:9` · `49:251`   | `src/screens/Macros/components/MealPlanTab/`                                                                            |
| F9   | 12 Recipe detail                                          | `49:532`                       | `src/screens/RecipeDetail/`                                                                                             |
| F10  | 13c Swap loading · 13 Swap meal                           | `36:291` · `36:9`              | `src/screens/SwapMeal/`                                                                                                 |
| F10  | 13b Swap preview                                          | `36:130`                       | `src/screens/SwapPreview/`                                                                                              |
| F11  | 13d Swap no results · 13e Swap failed                     | `36:372` · `36:459`            | `src/screens/SwapMeal/` — two further states of the same screen                                                         |
| F12  | 14 Grocery list · 14b Grocery checked · 14c Grocery empty | `37:9` · `37:165` · `37:348`   | `src/screens/GroceryList/`                                                                                              |
| F13  | 15 Log meal                                               | `38:9`                         | `src/screens/LogPlannedMeal/`                                                                                           |
| F13  | 15b Diary result                                          | `38:160`                       | the **existing** `src/screens/Macros/` Diary, with the new caption on `MealEntryRow` — not a new screen (note `38:351`) |
| F14  | 16 Plan settings · 16b Regenerate confirm                 | `38:359` · `38:504`            | `src/screens/PlanSettings/` — 16b is its private `PlanConfirmDialog`                                                    |

Thirty-one states across 21 rows and 20 destinations, because six screens render more than one
state: `SwapMeal` four (13c, 13, 13d, 13e), `MealPlanGenerating` three, `MealPlanTab` three,
`GroceryList` three, `MealPlanAboutYou` two, and `PlanSettings` two counting its dialog. The
twentieth destination is the shipped `Macros` Diary, which 15b is.

### The 18 routes, by the constant you navigate with

The table above answers "which folder"; this one answers "what do I pass to `navigate`". Every route
name is a member of the `as const` map in `src/constants/screens.ts` and is registered — in this
order — in `src/navigation/MacrosStack.tsx`, with its params typed in `src/navigation/types.ts`.
Always navigate with the constant, never the literal: the values carry spaces (`'Meal Plan Intro'`).

| `Screens.*` constant             | Route name                     | Screen                                  | Frame(s)        |
| -------------------------------- | ------------------------------ | --------------------------------------- | --------------- |
| `MEAL_PLAN_INTRO`                | `Meal Plan Intro`              | `src/screens/MealPlanIntro/`            | 01              |
| `MEAL_PLAN_GOAL`                 | `Meal Plan Goal`               | `src/screens/MealPlanGoal/`             | 02              |
| `MEAL_PLAN_ABOUT_YOU`            | `Meal Plan About You`          | `src/screens/MealPlanAboutYou/`         | 03, 03b         |
| `MEAL_PLAN_ACTIVITY`             | `Meal Plan Activity`           | `src/screens/MealPlanActivity/`         | 04              |
| `MEAL_PLAN_DIET`                 | `Meal Plan Diet`               | `src/screens/MealPlanDiet/`             | 05              |
| `MEAL_PLAN_FOOD_PREFERENCES`     | `Meal Plan Food Preferences`   | `src/screens/MealPlanFoodPreferences/`  | 06              |
| `MEAL_PLAN_FOOD_SEARCH`          | `Meal Plan Food Search`        | `src/screens/MealPlanFoodSearch/`       | 06b             |
| `MEAL_PLAN_SCHEDULE`             | `Meal Plan Schedule`           | `src/screens/MealPlanSchedule/`         | 07              |
| `MEAL_PLAN_COOKING_BUDGET`       | `Meal Plan Cooking Budget`     | `src/screens/MealPlanCookingBudget/`    | 08              |
| `MEAL_PLAN_TARGETS`              | `Meal Plan Targets`            | `src/screens/MealPlanTargets/`          | 09              |
| `MEAL_PLAN_EDIT_TARGETS`         | `Meal Plan Edit Targets`       | `src/screens/MealPlanEditTargets/`      | 09b             |
| `MEAL_PLAN_GENERATING`           | `Meal Plan Generating`         | `src/screens/MealPlanGenerating/`       | 10, 10b, 10c    |
| `RECIPE_DETAIL`                  | `Recipe Detail`                | `src/screens/RecipeDetail/`             | 12              |
| `SWAP_MEAL`                      | `Swap Meal`                    | `src/screens/SwapMeal/`                 | 13c, 13, 13d, 13e |
| `SWAP_PREVIEW`                   | `Swap Preview`                 | `src/screens/SwapPreview/`              | 13b             |
| `GROCERY_LIST`                   | `Grocery List`                 | `src/screens/GroceryList/`              | 14, 14b, 14c    |
| `LOG_PLANNED_MEAL`               | `Log Planned Meal`             | `src/screens/LogPlannedMeal/`           | 15              |
| `PLAN_SETTINGS`                  | `Plan Settings`                | `src/screens/PlanSettings/`             | 16, 16b         |

**Four of the 31 states have no route, and that is deliberate.** 11, 11b and 11c are the Meal Plan
segment of the existing `Screens.MACROS` route — `src/screens/Macros/components/MealPlanTab/` — and
15b is that same route's Diary segment. Reaching any of them means going to `Screens.MACROS` and
setting the segment (`useMealPlanStore.macrosSegment`), never pushing a route. Both existing
`Screens.MACROS_HISTORY` and the five bottom tabs stay exactly as they were; `src/navigation/HomeTabs.tsx`
hides the tab bar while one of the 18 routes above is focused and shows it everywhere else.

### What the frame numbering does not mean

The file numbers its frames in reading order, which reads like navigation in four places where it
is not:

- **10b and 10c are mutually exclusive outcomes of 10, not its successors.** 10b is a _confirmed_
  generation failure; 10c is "no compatible plan" — a different response, a different body, and an
  inverted footer. Neither follows the other.
- **13d and 13e are sibling outcomes and never sequential.** 13d follows 13c when the alternatives
  response comes back empty. 13e follows 13b's commit when the commit _confirms_ a failure. One
  cannot lead to the other.
- **14c is an alternate state of the grocery list, not 14b's successor.** It renders when there is
  no plan at all; a plan that exists but needs no ingredients has its own copy, distinct from 14c's.
- **15 → 15b passes through 11b.** "Add to diary" on 15 returns to the plan day — frame 11b, inside
  Macros, with the segmented control and the tab bar present. 15b is reached from 11b's "View diary"
  link or the logged card's "View in diary", never directly from 15.

### Two placements a frame cannot tell you

**Plan settings has no drawn entry point.** No frame draws one, and the plan header's only action is
the grocery cart (note `49:243`). The entry point is therefore inferred: `PlanSettingsRow`, the last
item below the meal cards on every plan day
(`src/screens/Macros/components/MealPlanTab/components/PlanSettingsRow/`). It is also where 13d's
"Edit preferences" goes.

**11, 11b and 11c are not routes.** They render inside the existing Macros screen, behind the
Diary / Meal Plan segmented control that `src/screens/Macros/index.tsx` owns, which is why the map
sends them to a `components/` folder rather than to `src/screens/`. The existing bottom navigation
is untouched; the remaining-calorie ring stays in the Diary and the Meal Plan body shows planned
totals without implying anything was eaten.

### The weigh-in prefill, and the unit it cannot know

Frame 03 shows the current-weight field already filled, under the caption
`MEAL_PLAN_WEIGHT_PREFILL_CAPTION` — "From your last weigh-in. Edit if it's changed." That prefill
is the one place in this feature where a stored number can be shown in the wrong unit, and the
reason is a **recorded limitation rather than a covered case**. Read this before changing
`resolveWeighInPrefill`.

**Why it cannot be made safe here.** `body_weight_entries` stores a bare number. There is no unit
column, `WeightUnit` (`'lbs' | 'kg' | 'st'`) is a display preference rather than a property of the
row, and this work adds neither — so the app can only interpret a stored weigh-in in the unit
selected **today**.

**What the screen therefore does** (`src/screens/MealPlanAboutYou/index.util.ts`,
`resolveWeighInPrefill`):

- offers the stored number **as-is**, never converted, with the lb/kg toggle set from the user's
  existing `weightUnit` preference;
- only when reading that number in the current unit lands inside the supported body-weight range —
  `MIN_BODY_WEIGHT_KG` 30 to `MAX_BODY_WEIGHT_KG` 300 in `src/utility/UnitConversionUtility.ts`,
  about 66 to 661 lb — and otherwise leaves the field empty with no caption;
- offers **nothing at all** when the stored preference is stone, because the Figma control offers
  lb and kg only; the toggle then defaults to kg;
- shows the caption whenever it does offer a value, so the number is presented as a suggestion
  about a past weigh-in rather than as an answer;
- requires the user to press Continue before anything is sent, and converts to kilograms only at
  that moment.

**The residual risk, which is not closed.** A number typed under an **earlier** unit — 182 entered
as pounds, the preference since switched to kilograms — passes the range check and is shown as
182 kg. The caption and the required explicit confirmation are the only safeguards. Nothing is
converted for the user, no weigh-in row is created, modified or rewritten, and no unit provenance
is added to the weight history. Closing it properly needs a unit recorded against each weigh-in,
which is out of scope here; the alternative — never prefilling, because legacy rows carry no unit —
contradicts the prefill the design and the brief both call for.

**Where the rule as implemented is pinned.**
`src/screens/MealPlanAboutYou/__tests__/index.util.test.ts` covers no weigh-in, the stone
suppression, and the range gate in both units;
`src/utility/__tests__/UnitConversionUtility.test.ts` covers the bounds and the conversions. Those
tests pin the guard around the risk, not the provenance the data does not carry. The API-side record
of the same limitation is
[`backend/docs/meal-planning/requirement-evidence-checklist.md`](../../backend/docs/meal-planning/requirement-evidence-checklist.md#what-is-unrun-or-unverified)
and its F2 row, which state the identical policy on purpose — the field is drawn here and the column
belongs there. The device step that exercises it is in [the onboarding checklist](#onboarding)
below.

### Copy that deliberately differs from the frames

Two strings in `src/constants/strings.ts` do not match what the file draws. Both are decisions, not
drift, so quote the constant rather than the frame when you write an assertion or a screenshot
caption.

- **`MEAL_ENTRY_FROM_MEAL_PLAN_LABEL = 'From meal plan'`** — the diary caption under a planned meal.
  Node `38:267` renders it with **no trailing period**, and so does the constant; the period that
  appears in prose about this label is sentence punctuation, not part of the string.
- **`MEAL_PLAN_ACTIVITY_INFO_BODY`** — the 04 info card. It **replaces** the copy drawn at node
  `47:95` ("Outside of workouts you log in the app.") with:

  ```text
  Include your usual training. Workouts and runs you log are tracked separately and never added to your targets.
  ```

  The activity factor multiplies BMR exactly once and already accounts for habitual training, which
  is what the option sub-copy anchors describe, so the original wording contradicted the calculation
  this screen feeds. Logged workouts and runs never change a target.

Everything else renders the frame's copy verbatim. The inferred states — the unconfirmed-outcome
banners, the feature-unavailable card, the empty-grocery-list copy and the plural forms of the
flagged-amount banner — have their own constants in the same file, grouped by screen.

### Provenance labels: the complete set, and the two things they say

Frame 12 draws no source label and 15b draws only `From meal plan`, but a user has to be able to tell
a source-backed number from an estimate wherever one appears, so the labels below are the delivered
set. Two independent facts are being reported and they must not be collapsed into one:

- **Origin** — where the entry came from. `From meal plan` is an origin label, and the only one:
  planned meals are built from source-backed ingredients by policy, so it needs no source qualifier.
- **Nutrition provenance** — what the numbers rest on. `source_backed` (a USDA or label record),
  `ingredient_derived` (computed from a composition whose quantities are assumed, so still an
  estimate), `ai_estimated`, `user_entered` (a client-supplied snapshot the server cannot verify) and
  `null` on rows written before the column existed.

| Surface                                                | Label                                                                                                                               | Constant                                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Catalog row in Add Food's Catalog section (`BadgePill` on `FoodListRow`) | `Source-backed` · `Estimated from ingredients` · `AI estimate`                                                     | `CATALOG_PROVENANCE_BADGE_LABELS` keyed by `source_backed` / `ingredient_derived` / `ai_estimated` |
| A food the user created                                | none — the absence _is_ the user-entered marker                                                                                     | —                                                                                   |
| Recipe detail (12), under the nutrition card           | `Calculated from source-backed ingredients`                                                                                         | `RECIPE_NUTRITION_METHOD_CAPTION`                                                   |
| Diary row caption (15b and every other diary surface)  | exactly one of `From meal plan` · `Source-backed` · `Estimated from ingredients` · `Estimated` · none                              | `MEAL_ENTRY_FROM_MEAL_PLAN_LABEL`, `MEAL_ENTRY_SOURCE_BACKED_LABEL`, `MEAL_ENTRY_INGREDIENT_DERIVED_LABEL`, `MEAL_ENTRY_ESTIMATED_LABEL` |

The diary caption is decided in one place, `entryProvenanceLabel` in `src/data/models/MealEntry.ts`,
and its precedence is load-bearing: origin first (`From meal plan` whenever the entry links a planned
meal), then the server's `nutritionProvenance`, then the existing `isEstimatedEntry` fallback that
gives AI-logged entries (`ai_text`, `ai_photo`) their `Estimated` caption — which is a visible change
to the shipped diary row and is intended. A user-entered or pre-column row resolves to `null` and
renders no caption: only the server writes a provenance value, so a client-supplied snapshot is never
presented as source-backed.

The diary captions and the catalog pills are **two separate mappings** — `entryProvenanceLabel` and
`CATALOG_PROVENANCE_BADGE_LABELS` (paired with a `neutral`/`warning` tone in
`src/screens/AddFood/index.util.ts`) — and they deliberately differ where it matters: the same
AI-estimated food reads `AI estimate` on a catalog row and `Estimated` in the diary. Do not route one
through the other.

**Two gaps, stated rather than implied.** The `Calculated from source-backed ingredients` caption
ships on recipe detail (12) only: swap preview (13b) renders the same nutrition card without it, and
`src/screens/SwapPreview/` is where it belongs. And the dislike search on 06b lists catalog foods
with no provenance pill — the pills ship on Add Food's Catalog rows, where a food is about to be
logged, and not on 06b, where one is only being excluded from planning.

---

## 2. Where the code lives

| Path                                                                                                                       | Holds                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens/MealPlan*/`, `RecipeDetail/`, `SwapMeal/`, `SwapPreview/`, `GroceryList/`, `LogPlannedMeal/`, `PlanSettings/` | The 18 routes, registered in `src/navigation/MacrosStack.tsx` with params typed in `src/navigation/types.ts` — route constant per screen in [§1's route table](#the-18-routes-by-the-constant-you-navigate-with)                    |
| `src/screens/Macros/components/MealPlanTab/`                                                                               | The Meal Plan segment: `DayStrip`, `EmptyPlanState` (11c), `LastDayCard`, `LoggedBadge`, `MealPlanCard`, `PlanHeader`, `PlanSettingsRow`, `PlannedTotalsCard`                                                                     |
| `src/components/`                                                                                                          | The components two or more screens share — `ContentColumn`, `WizardHeader`, `OptionCard`, `TextField`, `InfoBanner`, `EmptyState`, `MetricGrid4`, `RecipeHero`, `MealPlanSetupProvider` and the rest                              |
| `src/components/icons/`                                                                                                    | The 20 icon components transcribed from the Figma exports                                                                                                                                                                         |
| `src/queries/mealPlanning/`, `src/queries/catalog/`                                                                        | Query and mutation hooks; every key is registered in `src/queries/keys.ts`                                                                                                                                                        |
| `src/queries/api/mealPlanning/`, `src/queries/api/catalog/`                                                                | One request function per endpoint, with `decoder/` codecs and `converter/` mappers                                                                                                                                                |
| `src/store/mealPlan/useMealPlanStore.ts`                                                                                   | Client state only — segment, selected day, banner dismissal, and the persisted pending-intent slice                                                                                                                               |
| `src/hooks/mealPlanning/`                                                                                                  | `useMealPlanEntitlement` and `useHomeTabsNavigation`, each with a tested `.util.ts`                                                                                                                                               |
| `src/utility/`                                                                                                             | Helpers used across trees: `ServingsUtility`, `NutritionFormatUtility`, `UnitConversionUtility`, `MealPlanDateUtility`, `IdempotencyUtility`, `RevisionConflictUtility`, `MealPlanEntitlementUtility`, `MealPlanLifecycleUtility` |
| `src/data/models/`                                                                                                         | The domain types the converters produce                                                                                                                                                                                           |
| `src/testSupport/`                                                                                                         | Test infrastructure that Jest loads but must not collect as a suite: `dstTimeZoneEnvironment.ts`, the pinned-zone environment `jest.config.js` binds to `*.dst.test.ts` (see section 3)                                            |
| `src/styles/`                                                                                                              | Tokens — see section 6                                                                                                                                                                                                            |
| `src/constants/strings.ts`                                                                                                 | Every fixed string, imported as `@constants/strings`                                                                                                                                                                              |

Two things in here a reader cannot infer:

**Sequenced presses also live in `index.util.ts`.** Three screens — `MealPlanTargets`,
`LogPlannedMeal` and `SwapMeal` — have a press that makes more than one server write in order and
has to resume correctly after a failure (confirm targets, then save the start date, then generate,
for example), and each also decides what to do with a write's error. Those decisions are pure
functions over collaborators the component injects, so they sit in that screen's `index.util.ts`
beside its ordinary derivations and are pinned by `__tests__/index.util.test.ts` — which is how they
are held under test at all, since this project installs no renderer. A screen never gains a parallel
module for them: pure screen logic belongs to `index.util.ts`, and orchestration that genuinely needs
React state or effects belongs to a screen-local `hooks/use*.ts`.

**Promoted helpers.** `FoodDetail`'s servings stepper and fraction-chip logic now lives in
`src/utility/ServingsUtility.ts`, because `LogPlannedMeal` needs the same behaviour and a component
must never import another component's `index.util.ts`. The selected fraction chip on 15 is
deliberately identical to FoodDetail's existing convention — `greenTint` fill, `accentGreen` border
and label — per note `38:152`.

---

## 3. Running it locally

```bash
npm ci --legacy-peer-deps          # plain `npm ci` fails — see section 8
cp .env.dist .env                  # then point SOH_API_BASE_URL at your dev API
npx tsc --noEmit
npm run lint                       # read section 7 before judging its exit code
npm test -- --runInBand
npm run ios                        # == npx expo run:ios; needs macOS + Xcode
```

`npm start` (`npx expo start --dev-client`) is the Metro-only entry point for a development client
that is already installed. `npm run android` is `npx expo run:android`. There are no other scripts
for this feature; nothing was added to `package.json`.

**`npm test` runs two Jest projects, and the second one exists for one reason.** `jest.config.js`
declares `mobile` — every suite, in the runner's own zone, which is UTC on CI — and `mobile-dst`,
which runs `src/**/*.dst.test.ts` in `src/testSupport/dstTimeZoneEnvironment.ts`, an environment that
pins `TZ` to `America/New_York` before the sandbox is built and restores it on teardown. Today that
is `src/utility/__tests__/MealPlanDateUtility.dst.test.ts`: a zone west of UTC that observes daylight
saving is the only place where a day-key helper advancing by a fixed 24 hours, or reading
`yyyy-MM-dd` as a UTC instant, returns the wrong calendar day — in UTC every day is a uniform 24
hours and both bugs pass. The pairing is deliberately hard to remove quietly: `jest.config.js`
reaches the environment through `require.resolve`, so a deleted or renamed environment fails the
whole run instead of letting those files fall back to the runner's zone; the suite names the same
module in its own `@jest-environment` docblock; and `MealPlanDateUtility.test.ts` asserts that both
files and that binding are still present. If you are about to simplify this config, that is the
coverage you are deleting.

### Two switches decide whether the feature exists

Both default to off. A developer who misses either sees the app exactly as it was before this
feature and will reasonably conclude the work is broken, so check them first.

**1 — The API must be running with `MEAL_PLANNING_ENABLED=true`, after its catalog release and
recipe seeds are loaded.** While the flag is off, every `/meal-planning/*` route except
`/meal-planning/targets*` and every `/recipes/*` route answers `503 feature_disabled`, and the Meal
Plan segment renders the unavailable card. Enabling the flag before loading the catalog produces a
server that answers but cannot plan. The command order is owned by
[`backend/docs/meal-planning/README.md`](../../backend/docs/meal-planning/README.md) — follow it
there rather than reconstructing it here.

**2 — Firebase Remote Config `meal_planning_enabled` must have been fetched at least once.** The
packaged default in `src/service/remoteConfig/initRemoteConfig.ts` is `false`, so an install that
has never activated a console value hides the feature by design. The policy is stricter than a
boolean read and lives in one place, `src/utility/MealPlanEntitlementUtility.ts`: only a value the
SDK has _activated from the console_ (`valueSource === 'remote'`) can enable the feature. A failed
or throttled fetch deliberately changes nothing, because the SDK caches an activated value across
launches — so once `true` has been activated, it stays `true` offline.

The value reaches a device on its **next cold start**, not while the app is in the foreground:
`initRemoteConfig()` is called once from `MinimumVersionSheet`'s mount-only effect, and
`setConfigSettings` pins `minimumFetchIntervalMillis` to `900_000` (15 minutes). There is no
foreground refresh and none was added.

Worth knowing because it inverts the existing precedent: `log_with_ai_enabled` ships with a packaged
default of `true` and is a kill switch for a live feature, while `meal_planning_enabled` ships
`false` and is an enable switch for an unseeded one. They sit in the same `setDefaults` call.

---

## 4. Environment and the API-origin guard

A development or test run can no longer reach the production API by omission. Five changes
together — four that decide which origin a build may use, and one that holds every individual
request to it:

**`.env.dist` carries a localhost placeholder.** The tracked template previously held the
production API URL, so copying it produced a working `.env` pointed at production data. It now
reads `SOH_API_BASE_URL=http://localhost:3000`. `.env` itself stays git-ignored.

**`src/constants/endpoints.ts` throws at module load.** Under `__DEV__` and under Jest the module
runs `assertNonProductionApi()`, which rejects a missing origin, a malformed origin, and any origin
that is not recognisably non-production. A **release build keeps the previous fallback unchanged** —
the guard exists so that a debug build or a test run can never silently use it.

The predicate (`isNonProductionApiOrigin`) accepts:

- `localhost` or `127.0.0.1`,
- an RFC 1918 private IPv4 address — `10/8`, `172.16/12`, `192.168/16`,
- a host ending in one of the four ngrok suffixes, matched on a label boundary so a host that merely
  contains `ngrok` fails,
- a host listed in `SOH_DEV_API_HOSTS`.

Anything it cannot read as scheme + host + optional port is rejected as malformed rather than
normalised: a backslash, userinfo, a control character, surrounding whitespace or a non-ASCII label
separator each move the host the request stack actually resolves, so the guard only accepts hosts no
character can shift. Neither error message includes the rejected value — this throws at module load,
so the message reaches Jest, Metro and CI logs, and a misconfigured origin can itself carry a
credential.

**`assertNonProductionApi()` prints the accepted origin, and returns it.** It is exported from the
same module so a QA session can establish _which_ API the build under test talks to, rather than only
that the guard did not throw. On success it logs exactly one line and returns the same string:

```text
SOH API origin verified as non-production: http://localhost:3000
```

The exact invocation for section 10's precondition is a launch of the build under test — the guard
runs at module load, so the line appears in the packager console as the app starts:

```bash
npm start            # or: npm run ios — then read the line above in the Metro output
```

Two properties of that line matter. It is printed **only** for an origin the predicate accepted, so
it can never echo a rejected value (rejected origins reach the thrown message, which names none);
and it is **suppressed under Jest**, because the same call runs at the head of every suite that
imports `Endpoints` and one line per suite would bury the runner's output. A caller that needs the
value somewhere other than the console uses the returned string.

**`SOH_DEV_API_HOSTS` is an in-code constant, not an environment variable.** That is a constraint,
not a preference: a name is only reachable as `@env` if `babel.config.js`'s `react-native-dotenv`
allowlist exposes it _and_ `env.d.ts` declares it, and both files sit outside this feature's data
contract. The allowlist carries `SOH_API_BASE_URL` — the one name any file under `src/` imports
(`endpoints.ts` is the single importer) — so a fifth name could not be introduced here. Add a shared
development host by editing the array in `endpoints.ts`.

**`.env.test` is tracked on purpose.** `react-native-dotenv` layers `.env.<NODE_ENV>` over `.env`,
and Jest sets `NODE_ENV=test`, so this file supplies a non-production origin on a clean checkout
where no developer-local `.env` exists. Without it, every suite that transitively imports
`Endpoints` would fail the preflight at import time. The isolated missing-origin and
production-origin cases are covered in `src/__tests__/constants/endpoints.test.ts`, which drives the
exported predicate directly.

**Every request is held to the configured origin at runtime.** The preflight above settles which
origin a build may use; it says nothing about where an individual request ends up, and a redirect
moves exactly that. So `endpoints.ts` also exports `CONFIGURED_API_ORIGIN` and
`isConfiguredApiOriginUrl(url)` — a strict scheme + host + effective-port comparison against the
configured origin, never against the non-production allowlist, because a release build legitimately
runs on production — and `src/service/http/httpRequest.ts` applies it at three points:

- **Before a bearer token is attached.** The request interceptor refuses any URL outside the
  configured origin. This is the only check that runs before anything leaves the device, so a URL
  assembled from a hostile parameter never carries a credential.
- **`maxRedirects: 0` on the instance.** Under Node that would end the matter. Under React Native it
  is advisory: the XHR adapter delegates to the platform's networking stack, which follows redirects
  itself and does not consult the option.
- **On the way back, on both paths.** The fulfilled and the rejected handler each read the final URL
  the transport reports (`XMLHttpRequest.responseURL`) and refuse the response when it names a host
  outside the configured origin, recording the escape through `CrashUtility`. The rejected path
  earns its own guard: a foreign origin answering `401` would otherwise reach the token-refresh
  interceptor, which would mint a fresh token and replay the request — a second credential sent
  after the first. The guard runs ahead of that interceptor, so an escaped `401` neither refreshes
  nor replays.

**What this does not do is prevent the hop.** By the time `responseURL` names a foreign host, the
platform has already made the request there. Refusing the response, recording it and blocking the
replay contains the exposure to a single request and makes the escape visible; it does not unsend
the first credential. Closing that remaining gap needs a transport whose redirect callback the app
controls — native networking configuration or a config plugin, an `app.json` change and a device
build — and all three sit outside this feature's scope: no native code, `app.json` is
reference-only, and no framework or HTTP-adapter upgrade is permitted. It is recorded here as a
known residual, and the device step that would demonstrate the boundary is in section 10 marked
**unrun**: neither macOS/Xcode nor an Android SDK was available where this was written, so no build
could be pointed at a redirecting server.

---

## 5. Typeface: Helvetica Neue vs the platform default

Every text style in the Figma file names **Helvetica Neue**. No file under `src/` sets a
`fontFamily` — a repository-wide search returns zero matches — so the app renders **San Francisco on
iOS and Roboto on Android**, and the new screens do the same as every shipped one.

**Option A is the working decision of this delivery:** keep the platform default family and match
size, weight, line height and letter spacing exactly. The consequence is a glyph-shape difference
from the Figma frames that no token can remove, so **every screenshot comparison must note it**. It
is a deviation from the visual source of truth, recorded here so it can be reversed knowingly rather
than discovered later.

**Option B**, bundling a licensed Helvetica Neue, remains available and is smaller than it looks:
`expo-font` is already a dependency and already registered in `app.json`'s plugin list, so the
remaining work is the licensed `.otf` files under `assets/fonts/`, a `useFonts` load gate at app
start, a `FontFamily` token in `src/styles/fontSize.ts`, `fontFamily` in every new `index.styled.ts`,
and a licence review. No `FontFamily` token exists today, precisely because option A is in force —
adding one is the first step of option B, not a tidy-up.

---

## 6. Tokens and the style gate

The styling rule requires every colour, spacing value, radius, size and font metric in a stylesheet
to resolve to a named token, and it sanctions adding a named token when the palette is missing one.
That allowance is what the additions below rest on.

### Added value tokens

| Token                       | Value                  | File                         |
| --------------------------- | ---------------------- | ---------------------------- |
| `Theme.colors.heroScrim`    | `rgba(8,13,10,0.6)`    | `src/styles/theme.ts`        |
| `Theme.colors.dangerBorder` | `rgba(226,104,94,0.4)` | `src/styles/theme.ts`        |
| `Spacing.TIGHT`             | `6`                    | `src/styles/spacing.ts`      |
| `BorderRadius.EMPTY_TILE`   | `26`                   | `src/styles/borderRadius.ts` |
| `BorderRadius.CHECKBOX`     | `6`                    | `src/styles/borderRadius.ts` |
| `BorderRadius.BAR`          | `3`                    | `src/styles/borderRadius.ts` |
| `BorderRadius.SEGMENT`      | `2`                    | `src/styles/borderRadius.ts` |

Every other Figma colour, spacing value and radius already mapped 1:1 to an existing token, and
`src/styles/shadow.ts` was not touched: `Shadow.CTA_GLOW` already is the design's single effect.

**Seven, and no eighth.** There is deliberately no generic 2px `Spacing` entry. Every 2px value in the
design is a distinct purpose rather than a shared spacing step, so each one lives in `Sizes` under its
own name: the control inset inside a segmented track is `Sizes.SEGMENT_TRACK_INSET`, the gap between a
stacked label and its value is `Sizes.ROW_VALUE_INSET_T`, an option card's label-to-subcopy gap is
`Sizes.OPTION_SUBCOPY_GAP`, a banner's title-to-body gap is `Sizes.BANNER_BODY_INSET_T`, and a day
chip's weekday-to-number gap is `Sizes.DAY_CHIP_NUMBER_INSET_T`. Adding one `Spacing` step for all of
them would collapse five purposes onto one token, which is exactly what the naming principle below
forbids.

### `src/styles/sizes.ts` — new file

The repository had no tokens for control geometry, stroke width or opacity; new stylesheets need all
three, so this file adds them as `Sizes`, `Stroke` and `Opacity`.

Its naming principle matters more than its contents: **each entry is named for its purpose, never
for its value, so equal numbers used for different things never share a token.** `Sizes` holds 62
entries over 38 distinct numbers — `Sizes.RING` and `Sizes.EMPTY_TILE` are both `104`, and four
separate entries are `2` because a banner's body inset, an option card's sub-copy gap, a day chip's
number inset and the segmented control's track inset are four unrelated surfaces — and
`Opacity` holds 12 over 7, with `PRESSED` and `LOGGED_TILE` both `0.6` and `PRESSED_SUBTLE` and
`PRESSED_SEGMENT` both `0.7`. `Stroke`'s 17 entries happen to be 17 distinct Figma-confirmed widths,
from `THIN: 1` to `SPINNER_TRACK: 5.3`, several of them
per-glyph (`WARNING_TRIANGLE: 1.53`, `CART_HEADER: 1.275`). Collapsing a duplicated pair would
couple two unrelated surfaces to one number, and the next design change would move both. Do not
deduplicate them.

### Three maps appended to `src/styles/fontSize.ts`

```text
LineHeight    SCREEN_TITLE 34.5 · STAT_LG 32.2 · GREETING 25.3 · BODY 21.75 · STEP_BODY 21
              ROW_VALUE 19.5 · META 18.85 · OPTION_SUBCOPY 17.55 · LABEL 16 · OVERLINE 13.31
LetterSpacing TITLE -0.4 · HERO -1.0 · OVERLINE 0.6 · EYEBROW 1 · NONE 0
FontWeight    EXTRA_LIGHT '200' · REGULAR '400' · SEMIBOLD '600' · BOLD '700'
```

Two facts a reader would otherwise get wrong:

- **Letter spacing is in pixels here, not em.** Figma expresses it as a fraction of the font size;
  React Native measures it in pixels. Each value was converted once, at the size it belongs to
  (`-0.0133em` on a 30px title becomes `-0.4`), so do not convert again at the call site.
- **A style Figma leaves at "auto" sets no `lineHeight` at all.** The maps carry the line heights
  Figma pins, plus one deliberate addition: `LineHeight.LABEL` (16) is the height Figma _resolves_
  for the single-line 13px style, named because `META`'s 18.85 would stretch a fixed-height row.

`FontWeight` exists so weights stop being bare string literals; the scan below treats a quoted
numeric weight as a hit.

### The literal scan

```bash
node scripts/token-literal-scan.mjs $(git diff --name-only --diff-filter=ACMR master \
  -- 'src/**/*.styled.*' 'src/**/*.tsx' ':(exclude)src/**/__tests__/**')
```

`master` is the base your branch forked from — substitute another if yours did not.

The scan is the enforceable form of the styling rule's no-magic-numbers and no-hardcoded-hex
clauses. It exits `1` on the **first** hit, printing `file:line:column`, the literal and a reason,
and `2` on a file it cannot read; with no arguments it says so and exits `0`.

It runs two scans, chosen per file by name: a style-object scan that classifies the value of a
`property:` (every non-`.tsx` file and every `*.styled.*` module), and a JSX-attribute scan for
`.tsx` files that classifies attribute values — `activeOpacity={0.5}`, `strokeWidth={1.6}`,
`color="#16BC85"` — from an allowlist of design-carrying props. Behaviour props (`numberOfLines`,
`delayPressIn`, `maxLength`) and SVG path geometry inside a `viewBox` are deliberately unlisted:
transcribed artwork is not a token. Colour literals are flagged in both scans — `#hex` and
`rgb(`/`rgba(`/`hsl(`/`hsla(` — because the rule forbids hardcoded hex.

**The pathspec has to select both file classes, or one of the two scans never runs.** That is why it
reads `'src/**/*.styled.*'` and `'src/**/*.tsx'` rather than `'src/**/index.styled.ts'`:

- `*.styled.*` and not `index.styled.ts`, because a styled module may be `.tsx` when it holds JSX —
  `src/components/MinimumVersionSheet/index.styled.tsx` is the one that does, and a pathspec fixed on
  `.ts` silently skips it.
- `*.tsx` at all, because the attribute scan only ever sees a file the pathspec selects. Restricted
  to styled modules, the gate could not see an `activeOpacity={0.7}` or a `color="#16BC85"` written
  straight onto a component, which is exactly where the literals this widening surfaced lived — every
  one on a shipped line of a screen this feature touched, so the migrate-on-touch clause below covers
  them.
- `:(exclude)src/**/__tests__/**`, because a stylesheet test's numbers are the expectation it pins,
  not design values a token could replace — and replacing them with the very tokens under test would
  make the assertion compare the source with itself. Three exist today: `BadgePill`'s WCAG AA
  minimum `4.5`, `MetricGrid4`'s `393` reference device width, and the `* 2` factor in `InfoBanner`'s
  derived height. Without the exclusion all three fail the gate while nothing is wrong.

**A hit is fixed by adding a named token and referencing it — never by widening the exemption list,
and never by an ignore comment, which the scanner does not honour.** The exemptions are keywords and
structural factors only: `0`, `'auto'`, `undefined`, `'transparent'`, `'currentColor'`, the layout
and text keywords, and `flex`/`flexGrow`/`flexShrink`.

### Migrate on touch

The styling rule asks you to migrate a file's literals when you touch it, so shipped literals in
untouched files were left alone while these were migrated to tokens: `Macros/index.styled.ts`,
`FoodDetail/index.styled.ts`, and the stylesheets of `PrimaryButton`, `SecondaryButton`,
`SegmentedControl` and `FoodListRow`. If you touch another shipped stylesheet, do the same there —
that is also why the scan is fed a diff rather than a fixed file list.

The clause covers a design value written onto a component's props just as it covers one written in a
stylesheet, so the `activeOpacity` literals on the shipped lines of the seven touched components were
migrated with them: `Account`, `FoodListRow`, `FoodDetail` (stepper and fraction chips), `Macros`,
`Macros/components/DailySummaryCard`, `Macros/components/MealEntryRow` and
`Progress/components/ActivityTab` now press through `Opacity.PRESSED` (`0.6`), the added
`Opacity.PRESSED_SUBTLE` (`0.7`) and `Opacity.PRESSED_TARGET_ROW` (`0.5`). **No rendered value
changed** — each site kept the number it shipped; only the literal became a named entry.

### Three gaps left open

These are recorded, not closed. Do not read them as resolved.

1. **No layout primitive.** The repository has no `Stack`/`Row`/`Flex` component; layout is written
   as `flexDirection`/`gap` per stylesheet, and this feature followed that convention.
   `ContentColumn` is the only layout component it adds. Introducing a general primitive would mean
   touching every shipped screen to stay consistent, which is outside this scope.
2. **The typeface** — section 5.
3. **Colour contrast.** `src/styles/theme.ts` carries an accessible-colour register marked
   `STATUS: OPEN, BLOCKED ON A DESIGN DECISION`: eight colour pairs ship below their WCAG 2.1
   thresholds, from `white` on `green` at 2.45:1 to `inputBorder` on `inset` at 1.12:1. Each entry
   names the Figma nodes that draw it, the measured ratio, the threshold and a pre-computed remedy
   using existing palette tokens. They were not changed unilaterally because Figma draws them
   exactly as the app renders them and the constants are read across the app, well beyond this
   feature. This is accepted, tracked accessibility debt awaiting a design ruling — the register
   records the decision, it does not make the palette compliant.

---

## 7. Lint: the baseline gate

`npm run lint` is `npx eslint .`, and this repository had pre-existing findings before the feature
started. The gate therefore measures _new_ findings against a captured baseline rather than
demanding a clean run.

### The artefacts

- `docs/lint-baseline.json` — the pre-feature ESLint report, captured on the pristine base commit
  `603718ee` **before the first feature edit**, at byte-for-byte the scope `npm run lint` uses:

  ```bash
  npx eslint --no-fix -f json . -o docs/lint-baseline.json
  ```

  (`-o` writes the file even though ESLint exits `1` on the findings it found.) Recounted from the
  committed artefact: **487 files linted, 49 findings in 31 files — 34 errors and 15 warnings**, of
  which **9 findings in 6 files sit outside `src/`** (`.eslintrc.js`, `App.tsx`, `babel.config.js`,
  `jest.config.js`, `metro.config.js`, `scripts/transform-imports.js`). These are the planning
  figures and they match the artefact exactly.

  The tracked report is a projection: ESLint's raw output embeds each linted file's own text in
  `source`/`output` and in a message's `fix`/`suggestions`, so those fields are elided before the
  artefact is committed. Five fields survive untouched — `filePath`, `ruleId`, `message`, `line`,
  `column` — of which the first three are the occurrence key and the last two are display metadata
  (see the comparator paragraph below).

- `docs/lint-baseline.provenance.json` — the record that proves the baseline is the reviewed one:
  source commit, capture command, capture scope, totals, per-rule composition and a SHA-256 digest
  of the projected results. **The comparator refuses to run against a baseline this record does not
  describe**, so a regenerated or hand-edited artefact cannot pass unnoticed.

### The gate, in two steps

```bash
# 1 — the files this change touched must be clean
npx eslint --no-fix $(git diff --name-only --diff-filter=ACMR master -- '*.ts' '*.tsx' '*.js' '*.mjs')

# 2 — the full run must introduce nothing
npx eslint --no-fix -f json . -o /tmp/lint-after.json || true
node scripts/lint-baseline-compare.mjs docs/lint-baseline.json /tmp/lint-after.json
```

Step 1 exits `0` over the 441 changed source files, with `master` resolving to the feature's
reference commit `788a36f` (`origin/master` in a fresh clone) — touched files are clean, per the
styling rule's migrate-on-touch clause. It also exits `0` against the branch's own base `603718ee`
(443 files), which is the base that pulls the root JavaScript configs into the list; see the next
paragraph for why that no longer matters. Step 2 exits `0`: `0 new findings`, and all 487 baseline
paths still on disk are covered by the after report's 863 results.

Count the list with everything committed. `git diff` against a commit never lists an untracked file,
so running step 1 over a change that has added files but not staged them silently lints fewer paths
than it reports — the same failure mode the comparator's coverage check exists to catch in step 2.

**Why the root JavaScript configs would otherwise fail step 1, and the one override that fixes it.**
Expo's own `node_modules/expo/tsconfig.base.json` excludes `babel.config.js`, `metro.config.js` and
`jest.config.js` from the TypeScript program, and its wildcard never matches a dotfile such as
`.eslintrc.js`. `.eslintrc.js` sets `parserOptions.project`, so project-aware parsing cannot resolve
any of those four: ESLint reports each whole file as a fatal parse error at `0:0` instead of linting
it, and a changed-file run that includes one of them can never exit `0`. The baseline records all
four findings as pre-existing configuration noise.

`.eslintrc.js` therefore carries a scoped override — `parserOptions: {project: null}` for
`.eslintrc.js`, `babel.config.js` and `jest.config.js` — which drops the program for exactly those
three so ESLint lints them normally. No rule configured in this repository is type-aware, so nothing
is lost by it. The three now report **no findings at all**, which is why the after-run count below is
three lower than the baseline's on that account. `metro.config.js` is deliberately left out: this
feature does not touch it, and linting it would replace its recorded parse error with a
`@typescript-eslint/no-var-requires` finding — a different finding, which the baseline gate would
correctly read as new. If you add a fourth root config to that list, lint it first and check the
comparator, in that order.

Two files in this set are changed by this feature and both are clean under the override:
`jest.config.js` (the two Jest projects, section 3) and `.eslintrc.js` (this override, plus three
arrays reformatted to satisfy `prettier/prettier`, which the parse error had been masking).
`babel.config.js`, `metro.config.js` and `App.tsx` are byte-identical to the reference commit.

> **The full `eslint .` run's own non-zero exit is expected and is not the gate.** ESLint exits `1`
> while any pre-existing finding remains in an untouched file, which is why step 2 pipes it through
> `|| true` and judges the comparator's exit code instead. The comparator prints this note on every
> pass; read it before filing a failing lint run as a regression.

The comparator's exit codes are `0` pass, `1` a new finding or a lost file, `2` unusable input.
It normalises every `filePath` to a repo-relative POSIX path, so the baseline stays valid from any
checkout root. **A finding's identity is the three-field tuple `(file, rule id, message)`** — and the
rule id of a fatal parsing error, which ESLint reports as `null`, becomes the sentinel `(fatal)` so
those findings key like any other. `line` and `column` are display metadata only: they order the
report and appear in its output, and a message that carries neither (a fatal parse error is reported
at no position) normalises to `0`. Occurrences are then compared by **count** per key, so a second
copy of an existing finding also fails, while the same finding moving down a file does not.

It fails closed on coverage too: every baseline file still on disk must appear in the after report,
and it derives the changed-file list itself from the working tree against the baseline's commit
(`603718ee`, recorded in the provenance record) — a report that lints fewer files holds fewer
findings and would otherwise pass. `--require` overrides that derivation for a caller that already
has the list; `--project` writes the elided projection described above. Its own behaviour is covered
by `scripts/__tests__/lint-baseline-compare.test.ts`.

### State after this feature

The measured after-run: **863 files linted, 41 findings in 23 files — 28 errors and 13 warnings**,
and the comparator reports **0 new findings**. The count fell from 49 by eight. Five baseline
findings sat in files this feature touched and were fixed there: `src/constants/endpoints.ts`,
`src/constants/strings.ts`, `src/navigation/HomeTabs.tsx`,
`src/screens/Macros/components/DailySummaryCard/index.tsx` and
`src/screens/FoodDetail/index.util.ts`. The other three are the parse errors of `.eslintrc.js`,
`babel.config.js` and `jest.config.js`, which the scoped override above replaced with a normal lint
of those files — and they report nothing.

Two findings the baseline records are deliberately still here. `App.tsx`'s `{flex: 1}` inline style
and `metro.config.js`'s project-aware parse error are the baseline's, in files this feature does not
touch, left where they are rather than fixed by editing them: `metro.config.js` in particular is
outside the parser override for the reason given above. The comparator is unmoved — a baseline
finding is not a new one — which is why the count is read beside this note and not on its own.

The 41 that remain, in full, so a later run can be compared file by file rather than by total:

| File                                                              | Findings | Rule(s)                                                                         |
| ----------------------------------------------------------------- | -------: | ------------------------------------------------------------------------------- |
| `src/components/Picker/index.tsx`                                 | 6        | `@typescript-eslint/no-explicit-any` ×4, `@typescript-eslint/ban-ts-comment` ×2 |
| `scripts/transform-imports.js`                                    | 4        | `@typescript-eslint/no-var-requires` ×4                                         |
| `src/screens/debug/DebugScreen.tsx`                               | 3        | `react-native/no-inline-styles` ×3                                              |
| `src/service/runs/__tests__/syncOfflineRuns.test.ts`              | 3        | `@typescript-eslint/no-var-requires` ×2, `prettier/prettier`                    |
| `src/service/workouts/__tests__/syncOfflineWorkouts.test.ts`      | 3        | `@typescript-eslint/no-var-requires` ×2, `prettier/prettier`                    |
| `src/components/icons/StepsIcon.tsx`                              | 2        | `prettier/prettier` ×2                                                          |
| `src/components/Skeleton/index.tsx`                               | 2        | `@typescript-eslint/no-explicit-any`, `react-hooks/exhaustive-deps`             |
| `src/service/http/httpUtil.ts`                                    | 2        | `@typescript-eslint/no-explicit-any` ×2                                         |
| `src/utility/ListSwipeItemManager.ts`                             | 2        | `@typescript-eslint/no-explicit-any` ×2                                         |
| `App.tsx`                                                         | 1        | `react-native/no-inline-styles`                                                 |
| `metro.config.js`                                                 | 1        | fatal parsing error                                                             |
| `src/components/GlobalBottomSheet/index.tsx`                      | 1        | `@typescript-eslint/no-shadow`                                                  |
| `src/components/MinimumVersionSheet/__tests__/index.util.test.ts` | 1        | `jest/no-identical-title`                                                       |
| `src/components/SearchBar/index.tsx`                              | 1        | `react-hooks/exhaustive-deps`                                                   |
| `src/data/models/Exercise.ts`                                     | 1        | `@typescript-eslint/no-explicit-any`                                            |
| `src/data/models/ExerciseTemplate.ts`                             | 1        | `@typescript-eslint/no-explicit-any`                                            |
| `src/navigation/AuthStack.tsx`                                    | 1        | `react/no-unstable-nested-components`                                           |
| `src/screens/Auth/index.tsx`                                      | 1        | `react-hooks/exhaustive-deps`                                                   |
| `src/screens/PreviousWorkoutEntries/index.tsx`                    | 1        | `react/no-unstable-nested-components`                                           |
| `src/screens/Workouts/index.tsx`                                  | 1        | `react-hooks/exhaustive-deps`                                                   |
| `src/service/http/httpRequest.ts`                                 | 1        | `@typescript-eslint/no-explicit-any`                                            |
| `src/service/workouts/__tests__/syncWorkoutDay.test.ts`           | 1        | `jest/no-identical-title`                                                       |
| `src/utility/CrashUtility.ts`                                     | 1        | `@typescript-eslint/no-explicit-any`                                            |

By rule: `@typescript-eslint/no-explicit-any` 13, `@typescript-eslint/no-var-requires` 8,
`react-native/no-inline-styles` 4, `react-hooks/exhaustive-deps` 4, `prettier/prettier` 4,
`jest/no-identical-title` 2, `@typescript-eslint/ban-ts-comment` 2,
`react/no-unstable-nested-components` 2, fatal parsing error 1, `@typescript-eslint/no-shadow` 1.

Every one of those 23 files is byte-identical to the reference commit `788a36f`, so no finding here
belongs to anything this feature wrote. One file needs a word of explanation even though it now
carries no finding: `babel.config.js` matches the reference commit but differs from the branch's own
base `603718ee`, which predates the commit that trimmed the `react-native-dotenv` allowlist — so it
does appear in the changed-lintable set the comparator derives against `603718ee`, and it is in the
parser override for exactly that reason: a changed file has to be lintable. `metro.config.js`'s
remaining finding is the configuration-level parse error described under the gate above.

**Fixing findings in files this feature does not touch is out of scope.** The baseline is not
regenerated to make a change pass; a new finding is fixed in the file that introduced it. A genuine
recapture — the lint scope or the ESLint configuration changing on purpose — means re-running the
capture command against the new base, projecting it, and updating the provenance record in the same
reviewed commit.

---

## 8. `npm ci` and the peer-dependency workaround

`npm ci` fails on a clean checkout with a pre-existing `ERESOLVE`: `jest-expo@57.0.0` declares a
peer of `@react-native/jest-preset ^0.85.0`, while the root pins `^0.86.0` to match
`react-native@0.86.0`. `npm ci --legacy-peer-deps` installs successfully and still runs the
`patch-package` postinstall step.

This is documented, not fixed. Resolving it would mean moving `jest-expo`, the jest preset or React
Native itself, and a framework upgrade is out of scope for this feature. **An `.npmrc` carrying
`legacy-peer-deps` is deliberately not committed** — a repository-wide flag would silence future
peer conflicts that deserve a look, so the flag is passed per command instead. **No dependency
version changed here:** `package.json` gains nothing from this feature.

---

## 9. Why two files in `scripts/` are not TypeScript

The file-conventions rule says the application source is TypeScript, and it stays that way: the only
non-TypeScript file under `src/` is the legacy data module `src/assets/exercises.js`, which the rule
already names as the exception. Nothing below licenses another one.

The two repository gates in `scripts/` are a different case. `scripts/lint-baseline-compare.mjs` and
`scripts/token-literal-scan.mjs` run under **bare `node`** — outside Babel, Metro and the TypeScript
program, and with no dependency on `node_modules` — because a gate that needs the app's build
pipeline in order to run cannot police the app's build pipeline. They are dependency-free ESM for
that reason, and `scripts/transform-imports.js` is the existing precedent for plain JavaScript in
this folder.

The gates' own suite is **`scripts/__tests__/lint-baseline-compare.test.ts`** — TypeScript, like every
other test in the repository, because nothing about a bare-node gate forces its test into JavaScript.
The suite never imports either script: it spawns them with `spawnSync(process.execPath, …)` and
asserts the exit code and the output, which is what a CI step observes, and a child process is
indifferent to the language the test was written in. Only the extension of the **collected test file**
has to satisfy Jest: `jest-expo`'s preset sets no `testMatch`, so Jest's defaults apply
(`**/__tests__/**/*.[jt]s?(x)` and `**/?(*.)+(spec|test).[tj]s?(x)`), which resolve `.js`, `.jsx`,
`.ts` and `.tsx` and **not** `.mjs` — so a suite written as `.test.mjs` would silently never run,
while `.test.ts` is collected and type-checked.

Be accurate about the coverage here: **one suite covers both gates.** The comparator's behaviour is
pinned in full — roots, occurrence counts, fatal messages, unusable input, the tracked artefact — and
`token-literal-scan.mjs` is covered for its classification rules and its argument contract in the same
file, because its own specification gives it no suite of its own.

---

## 10. Physical-device verification checklist — UNRUN

> **UNRUN.** Not one item below was executed. This section is a checklist to run, not a record of
> results. No passing TypeScript, lint or Jest run in this repository is evidence that the native
> app behaves as described.

Why it could not be run:

- **Native iOS build, simulator and visual comparison were unavailable** in the Linux environment
  this work was produced in — no macOS, no Xcode, no iOS toolchain. `npm run ios` cannot execute
  there, and Metro starting does not validate a native build.
- **The Firebase build files were not provided.** iOS needs `GoogleService-Info.plist` (delivered on
  EAS through `GOOGLE_SERVICES_INFO_PLIST_FILE`, which `app.config.js` reads) and Android needs
  `google-services.json`; `app.json` references both. They are build prerequisites to be injected as
  **untracked** files and **never committed**. `.gitignore` already ignores the plist; it does
  **not** ignore `google-services.json`, so check `git status` after adding that one.
- **Android is unverified beyond `npx tsc --noEmit`** — no Android SDK and no Firebase file in this
  environment. That line is **unrun** as well.

Native configuration flows through `app.json` and Expo config plugins; the generated `ios/` and
`android/` projects are git-ignored and are not present in the repository. Do not edit a generated
native project — change the config and regenerate.

### Making the failure states reachable

The failure frames need a server that fails on demand. The API exposes
`MEAL_PLANNING_FAULT=off | generation | swap | log`, read once at startup, default `off`, **forced to
`off` whenever `NODE_ENV` is `production`**. **Never set it in production.**

| Value        | Effect                                                                                                                                                                                                             | Reaches                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `generation` | `POST /plans` and `/regenerate` throw **before** their transaction, so nothing is written and the same idempotency key retried without the fault succeeds                                                          | 10b                                      |
| `swap`       | The swap commit throws before its transaction, with the same property                                                                                                                                              | 13e                                      |
| `log`        | The `/log` transaction **commits**, then the handler drops the response socket instead of writing a body — a network error over a durable write, which a retry must resolve by replay rather than by writing again | the commit-then-response-loss path on 15 |

13d needs no fault: choose a slot whose only eligible recipe is the one already planned. Full
details are in [`backend/docs/meal-planning/README.md`](../../backend/docs/meal-planning/README.md).

**Every fault scenario below is therefore a three-step move, because the value is read once at
import and never re-read.** Changing the environment under a running API changes nothing; the retry
would meet the same forced failure for as long as the process lives.

1. **Arm it** — stop the dev API you are pointed at, start it again with the fault set
   (`MEAL_PLANNING_FAULT=generation npm run dev`, and likewise `swap` / `log`), and drive the app to
   the failure state.
2. **Disarm it** — stop that API and start it again with `MEAL_PLANNING_FAULT=off` (or the variable
   removed). Restart **only** the API: leave the app on the failure screen and do not reload the
   client, because the pending intent it holds — the idempotency key minted when you first pressed —
   is what the retry has to reuse. It survives a backgrounded app and a cold start, but the point of
   the step is to prove the retry, not the replay-on-launch path.
3. **Retry** — press the failure screen's own action ("Try again", or "Use this meal" from a
   re-opened preview). The same key goes back to a now-healthy server, and the outcome is what the
   step asserts: for `generation` and `swap`, nothing was written, so the retry commits once; for
   `log`, the first attempt already committed, so the retry must return that same entry rather than
   write a second one.

### Preconditions

- [ ] Dev API running with `MEAL_PLANNING_ENABLED=true` and `MEAL_PLANNING_FAULT` unset or `off`,
      after `catalog:load` and `recipes:seed`
- [ ] The packager console shows `SOH API origin verified as non-production: <your dev origin>` as
      the build under test launches — the guard's own line, and the recorded evidence that this
      device is not pointed at production (section 4)
- [ ] Development Firebase project's Remote Config `meal_planning_enabled` set to `true` **and
      fetched once** — cold-start the app after flipping it
- [ ] Development client built and launched against the dev API (`npm run ios`), signed in with the
      development test account

### Onboarding

- [ ] Macros → Meal Plan segment shows 11c
- [ ] "Create my plan" opens 01
- [ ] Complete 02–08 and confirm **nothing is preselected on first entry** at any step
- [ ] Continue with empty required fields on 03 shows the inline errors of 03b, keeping entered
      values
- [ ] On 03, read the prefilled weight against the account's **own last weigh-in** and confirm the
      caption is present — then switch the lb/kg toggle and confirm the number is **not** converted
      for you, and that a value outside 30–300 kg (about 66–661 lb) when read in the selected unit
      leaves the field empty with no caption. With the account's weight unit set to stone, confirm
      there is no prefill and no caption and that the toggle defaults to kg. The risk this step
      exercises, and why it cannot be closed here, is
      [The weigh-in prefill, and the unit it cannot know](#the-weigh-in-prefill-and-the-unit-it-cannot-know)
- [ ] The Skip path shows 09b blank, skips Activity, and the step counter reads "n of 6"

### Targets

- [ ] 09 shows the calculated estimate
- [ ] "Edit" opens 09b; saving returns to 09 with the saved values
- [ ] The Diary ring, Account's Target Calories row and Progress → Activity all show that same value
- [ ] Account's Target Calories row opens the full-screen editor, not the legacy modal

### Generation

- [ ] "Generate my weekly plan" shows 10 — an indeterminate spinner with no percentage — then 11
      with seven day chips covering the saved week
- [ ] With `MEAL_PLANNING_FAULT=generation` armed (step 1 above): 10b appears and the saved answers
      are intact
- [ ] Then disarm it — restart the API with `MEAL_PLANNING_FAULT=off`, leaving the app on 10b — and
      "Try again" reuses the same idempotency key and lands on 11 with one plan, not two
- [ ] A deliberately over-constrained profile (vegan + 15 min + many dislikes) shows 10c, which
      names the limiting constraints and inverts the footer
- [ ] "Edit preferences" on 10b and on 10c both return to Review

### Recipe and swap

- [ ] A meal card opens 12
- [ ] The "Your portion / Full recipe" toggle changes displayed quantities only — not the plan, not
      the grocery list
- [ ] "Swap" shows 13c's skeleton, then 13
- [ ] An alternative opens 13b with its delta pill and calorie bar; "Use this meal" returns to the
      day with the swap toast and updated totals
- [ ] With `MEAL_PLANNING_FAULT=swap` armed: 13e appears and the original meal _and_ grocery list are
      unchanged
- [ ] Then disarm it — restart the API with `MEAL_PLANNING_FAULT=off`, leaving the app on 13e — and
      13e's "Try again" commits the swap once, with the grocery list following it
- [ ] A slot with no alternatives shows 13d
- [ ] Airplane mode during the commit shows the neutral unconfirmed-outcome variant — no "unchanged"
      assurance — and its "Try again" replays the same key

### Grocery list

- [ ] The header cart opens 14
- [ ] Items check and stay checked across a reopen
- [ ] A swap that increases an already-checked ingredient shows 14b: the item stays checked and is
      flagged in the Checked section with its old amount, new amount and delta
- [ ] "Uncheck all" appears only while something is checked, and clears checks and flags
- [ ] With no plan, 14c appears

### Logging

- [ ] "Log meal" opens 15
- [ ] The stepper and fraction chips behave exactly like FoodDetail's, including the selected-chip
      styling
- [ ] The Snack slot appears only when the plan includes one
- [ ] "Add to diary" tapped twice quickly produces **one** diary entry
- [ ] With `MEAL_PLANNING_FAULT=log` armed: the first tap shows the unconfirmed-outcome state (the
      write already committed; only the response was dropped)
- [ ] Then disarm it — restart the API with `MEAL_PLANNING_FAULT=off`, leaving the app on that state
      — and "Try again" resolves to the single committed entry, not a second one. Confirm the count
      in the Diary, not only on the plan card
- [ ] After logging, the plan day returns as 11b **with the segmented control and the tab bar
      present**, showing the success banner and the LOGGED card
- [ ] **Log a meal on today's plan day**, then check both post-log links — the banner's "View diary"
      and the logged card's "View in diary": each switches the Macros segmented control to Diary,
      where the entry sits in its meal card (15b)
- [ ] **Log a meal on a plan day that is not today** (any other day in the strip), then check the
      same two links: each opens Macros History instead, where that date appears as a day card. The
      banner reads "Added to {weekday}'s {slot}" rather than "Added to {slot}"
- [ ] Neither branch scrolls to or highlights the row — no such behaviour was built, and the diary
      body was deliberately not modified to add it. Identify the row by its `From meal plan` caption
- [ ] The diary row's caption reads `From meal plan`
- [ ] Editing the entry's servings keeps LOGGED; editing its name detaches it (caption and link
      gone); deleting it clears LOGGED
- [ ] Swapping a slot that was already logged shows the logged-then-swapped card treatment, naming
      the recipe that was eaten

### Plan settings

- [ ] `PlanSettingsRow` below the meal cards opens 16
- [ ] Changing diet to vegan produces the affected-meals banner and flagged meal cards
- [ ] "Review affected meals" lands on the earliest flagged day
- [ ] "Use for next plan" leaves the current plan intact
- [ ] "Regenerate this week" opens 16b with counts bound to the real plan; "Replace plan" runs 10
      and lands on 11
- [ ] "Plan another week" on the last day opens Review with next week's start date

### Both kill switches

- [ ] Remote Config `meal_planning_enabled=false`, then cold-start: the Diary / Meal Plan segmented
      control is **not rendered** at all and Add Food hides its Catalog section
- [ ] Restore `true`, cold-start, then set `MEAL_PLANNING_ENABLED=false` on the API: the segment
      stays, the Meal Plan body shows the unavailable card, Add Food **keeps** its Catalog section
      (`/catalog/*` is ungated), and targets on Account, Diary and Progress keep working — no crash
- [ ] Restore `MEAL_PLANNING_ENABLED=true` before continuing

### API origin containment

This is the one check that needs a second server, and the residual in section 4 is what it measures.
Point a redirecting HTTP server at your dev origin's port — one that answers any `/api/*` request
with a `302` to a host you control and can watch — and relaunch the app against it.

- [ ] A request that the redirecting server bounces to the foreign host is **refused by the app**:
      no decoded response reaches the screen, the failure is recorded, and a `401` from the foreign
      host produces neither a token refresh nor a replay (watch the foreign host's log: it must see
      at most the one redirected request, never a second carrying a fresh token)
- [ ] **Known residual, expected to fail as written:** the foreign host receives that one request.
      React Native's transport follows the redirect before any JavaScript runs, so this step records
      the boundary rather than asserting zero requests. Preventing the hop needs the native
      transport work section 4 scopes and excludes
- [ ] Restore `SOH_API_BASE_URL` to your real dev origin and confirm the packager line from section 4
      before continuing

### Layout and accessibility

- [ ] iPhone SE (375×667): every screen scrolls clear of its pinned footer
- [ ] iPhone 15 Pro Max (430×932): no stretched or clipped content
- [ ] iPad: content column capped at 600 px and centred
- [ ] VoiceOver reaches and labels every control on 11, 13b, 14 and 15
- [ ] Dynamic type at 100 %, 135 % and 200 %: CTAs stay visible and dense rows grow rather than clip

### Screenshots

- [ ] Capture a matched screenshot for each of the 31 frames at 393×852, and note the section 5 font
      delta on every one

---

## 11. Cross-repository pointers and delivery shape

The API side of this feature is documented in the sibling repository. These links resolve in a
checkout that holds both repositories side by side, as this workspace does; from a standalone clone
of the mobile repository, read them in `state-of-health-be` at the same paths under
`docs/meal-planning/`.

| Document                                                                                                                             | Owns                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`backend/docs/meal-planning/README.md`](../../backend/docs/meal-planning/README.md)                                                 | Operator commands in execution order, the local databases, the switch-on order, the CLI entry points, environment variables and `MEAL_PLANNING_FAULT` |
| [`backend/docs/meal-planning/api.md`](../../backend/docs/meal-planning/api.md)                                                       | Every endpoint, request and response shape, and error code the hooks in `src/queries/mealPlanning/` consume                                           |
| [`backend/docs/meal-planning/catalog-policy.md`](../../backend/docs/meal-planning/catalog-policy.md)                                 | The food catalog: coverage plan, validation checks, provenance classes and the search benchmark                                                       |
| [`backend/docs/meal-planning/planning-policy.md`](../../backend/docs/meal-planning/planning-policy.md)                               | Target calculation, plan generation, swap selection, grocery aggregation and the bounds each applies                                                  |
| [`backend/docs/meal-planning/release-and-recovery.md`](../../backend/docs/meal-planning/release-and-recovery.md)                     | Release order, both kill switches and the rollback path                                                                                               |
| [`backend/docs/meal-planning/requirement-evidence-checklist.md`](../../backend/docs/meal-planning/requirement-evidence-checklist.md) | Requirement → implementation → test mapping, including what is marked ready for human review                                                          |

Read `api.md` before changing a decoder or a converter: the io-ts codecs in
`src/queries/api/mealPlanning/decoder/` and `src/queries/api/catalog/decoder/` are the client half
of the contract it describes, and the two must agree field for field.

### Delivery shape

This work is delivered as **two unmerged pull requests, one per repository, cross-linked in their
descriptions** — the API changes in `state-of-health-be` and the client changes here.

**The backend ships first.** Its contract changes are additive: `MealEntryResponse` gains fields,
`inputMethod` gains a value, and the entry-logging endpoint accepts a second body shape. An older
client decodes those responses unchanged, so the server can lead safely — while a client that leads
would call routes that do not exist yet.

Not part of this work, and deliberately absent from both pull requests: merging them, deploying to
any environment, an App Store submission, and the `app.json` `version`/`buildNumber` bump a store
release needs. `app.json` still reads version 2.0.1, build 30.
