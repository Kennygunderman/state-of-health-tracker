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
| [2. Where the code lives](#2-where-the-code-lives)                                                      | Directory map, the one new module convention, and the delivered file scope |
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

Three strings in `src/constants/strings.ts` do not match what the file draws. All three are
decisions, not drift, so quote the constant rather than the frame when you write an assertion or a
screenshot caption.

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
- **`MEAL_PLAN_ACTIVITY_SUBTITLE = 'Your usual activity, including how often you train.'`** — screen
  04's sub-copy, node `47:44`. The frame states the "don't include the workouts you log"
  instruction **twice**, once here and once in the info card, so replacing only the card left the
  screen telling the user to exclude and to include the same training at once. AAP 0.1.4 replaces
  that instruction, not one of its two placements, so this sentence states the same model the info
  card states. `src/__tests__/constants/strings.test.ts` pins both strings and fails if either one
  reacquires an exclusion phrase.

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

### Files this feature changes beyond the plan's list

The plan this feature implements enumerates the existing files it expected to modify, and separately
marks a set of paths as read-only reference. The delivered change modifies **70** existing files:
**52** are on that list, **18** are not, and three of those 18 are on the read-only one. Nothing was
reverted to close the gap, because each of the 18 is required either by another clause of the same
plan or by this repository's own styling and helper rules, and every one is additive and
default-preserving. The difference is declared here so that a reviewer comparing the plan against
`git diff` finds it accounted for rather than unexplained.

Both halves of the census are reproducible against the feature's reference commit — `788a36f`, which
is also this branch's merge base (see [section 7](#the-gate-in-two-steps)):

```bash
git diff --name-status 788a36f -- .        # 70 `M` rows, beside the files this feature adds
git diff --numstat 788a36f -- src/components/dialog/ConfirmModal/index.tsx \
  src/components/SearchBar/index.tsx src/styles/shadow.ts
```

**Three of the 18 were marked reference or untouched, and each is forced by a different clause of the
same plan.** They come first because they are the ones a reviewer is most likely to challenge.

| Path                                             | Measured  | What changed                                                                                                                                                                                                                                                                | What requires it                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/dialog/ConfirmModal/index.tsx`   | `+20 / −3` | `confirmationBody` widened to optional and rendered only when given; new optional `cancelButtonText` (default `CANCEL_BUTTON_TEXT`, the literal it replaced), `isConfirmPending` (`false`) and `avoidKeyboard` (`false`); a backdrop press is ignored while a confirm is pending | The stale-revision prompt is specified as **this** dialog carrying "Your preferences changed on another device" with **Use theirs** / **Keep mine** — a dismiss label that is not "Cancel", and no body copy. Neither is expressible without these props. The plan's other instruction about this component is honoured: frame 16b is **not** routed through it but has its own `src/screens/PlanSettings/components/PlanConfirmDialog/` |
| `src/components/SearchBar/index.tsx`             | `+7 / −2`  | One new optional `maxLength`, defaulting to `DEFAULT_SEARCH_MAX_LENGTH = 100` — the hardcoded `100` it replaced                                                                                                                                                              | The catalog search endpoint bounds its query at 60 characters (`CATALOG_SEARCH_MAX_QUERY_LENGTH`). A fixed 100 let a user type up to 40 characters more than the endpoint accepts, which it answers with `400 invalid_request`                                                                                                                                                          |
| `src/styles/shadow.ts`                           | `+12 / −0` | One appended entry, `SHEET`; `MODAL`, `CARD`, `CTA_GLOW` and `ICON_GLOW` are byte-identical                                                                                                                                                                                  | The styling rule's migrate-on-touch clause, applied to `src/components/MinimumVersionSheet/index.styled.tsx` — [section 6](#added-value-tokens) carries the value and the reasoning                                                                                                                                                                                                    |

**No existing caller's behaviour changes, and that is measured rather than argued.** `ConfirmModal`
had **nine** caller files before this feature — ten usages, since `RunFlow` renders it twice; the
plan's "five existing callers" undercounts them. All nine still pass `confirmationBody` and **zero**
of the new props, so every one takes the default path, and each default is the value the component
previously hardcoded (`avoidKeyboard: false` is also `react-native-modal`'s own default). The nine
meal-planning screens are the only callers that pass them. `SearchBar` had **four** caller files; the
three this feature does not touch — `AddExercise`, `CreateTemplate`, `SelectExercise` — pass no
`maxLength` and keep the 100 they had, and the fourth, `AddFood`, is on the plan's own modification
list and passes the shorter catalog bound. `Shadow.SHEET` is not a new design value either: it names
the shadow that `src/components/GlobalBottomSheet/index.styled.tsx` still writes as a literal, and
that file is untouched because the plan protects it — only the copy inside the touched file became a
token.

**The other fifteen**, in thirteen rows, because two rows pair a helper with its test. Four of them
carry their full explanation in another section and are cross-linked rather than restated.

| Path                                                                               | Why it changed                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.eslintrc.js`                                                                     | The scoped `parserOptions: {project: null}` override for the three root JavaScript configs this feature maintains — [section 7](#the-gate-in-two-steps) explains why a changed-file lint run cannot otherwise exit `0`, and why `metro.config.js` is deliberately left out |
| `jest.config.js`                                                                   | The second Jest project, `mobile-dst` — [section 3](#3-running-it-locally)                                                                                                                                                                                                 |
| `App.tsx`                                                                          | The per-account query-cache lifecycle (legacy-blob purge, foreign-partition sweep, session binding) and the `style={{flex: 1}}` the migrate-on-touch clause moved into the new `App.styled.ts`                                                                              |
| `src/components/MinimumVersionSheet/index.tsx`                                     | A `.catch(CrashUtility.recordError)` on the app's single Remote Config fetch, whose rejection was previously unhandled, and the sheet background moved out of a JSX style object                                                                                            |
| `src/components/MinimumVersionSheet/index.styled.tsx`                              | The migrate-on-touch token pass on that same component: `Theme.colors.sheetScrim`, `Shadow.SHEET`, `Spacing.GUTTER`/`LARGE`/`XX_LARGE`, `FontWeight.BOLD`/`EXTRA_LIGHT`. Every resolved value is the one that shipped                                                       |
| `src/data/models/PersonalRecord.ts`                                                | Gains the `SessionSummary` interface — an addition only                                                                                                                                                                                                                    |
| `src/screens/Progress/index.util.ts`                                               | The same interface moved out of here into the model and is re-exported as a type, so the declaration is byte-identical and every existing importer still resolves                                                                                                           |
| `src/screens/Progress/components/ExercisesTab/index.util.ts` and `src/screens/Progress/components/ExercisesTab/__tests__/index.util.test.ts` | Import path only: they read `SessionSummary` from `@data/models/PersonalRecord` instead of reaching into the parent screen's `index.util.ts`, which the helper-scope rule forbids crossing                                                                                  |
| `src/queries/api/macros/converter/convertFood.ts`                                  | `FoodSourceEnum.CATALOG` is filtered out of `KNOWN_SOURCES`, so `/api/foods` — the personal-food endpoint, which never returns it — keeps exactly the source set it had before the enum grew                                                                                |
| `src/queries/macros/useDailyMacrosQuery.ts`                                         | An optional `enabled`, defaulting to `true`, so `Macros` can stop the diary query refetching while the Meal Plan segment is showing. A caller that passes nothing behaves as before                                                                                        |
| `src/service/http/httpRequest.ts`                                                  | The API-origin containment on the legacy transport — [section 4](#4-environment-and-the-api-origin-guard)                                                                                                                                                                  |
| `src/utility/CrashUtility.ts`                                                      | The redacting decode-failure describer the new codecs report through — [section 4](#4-environment-and-the-api-origin-guard)                                                                                                                                                |
| `src/utility/TextUtility.ts` and `src/utility/__tests__/TextUtility.test.ts`       | Purely additive `lookupLabel` / `lookupMember` — the own-property guards every copy table is read through, so a code that arrives from the server can never resolve to an inherited `Object.prototype` member                                                               |

**Three token entries the plan's token list does not name** — `Theme.colors.sheetScrim`,
`Spacing.XX_LARGE` and `Shadow.SHEET` — exist for the same migrate-on-touch reason and are listed
with their values in [section 6](#added-value-tokens). The `LineHeight`, `LetterSpacing` and
`FontWeight` entries beyond the ones the plan enumerates (`LABEL`, `OPTION_SUBCOPY`, `ROW_VALUE`,
`STEP_BODY`, `EYEBROW`, `EXTRA_LIGHT`) are the same kind of addition and are listed there too. None
of them changes a rendered value.

**Keeping this list true.** If you modify another file the plan does not list, add it here with its
one-line reason in the same commit — this table and `git diff --name-status 788a36f` are meant to
agree, and a census that has drifted is worse than none. Every one of the 18 paths appears above
verbatim, including the two test files, so the agreement is checkable by matching path strings
against that diff rather than by reading prose. A reader who needs the authoritative
in-scope declaration for the API side will find the equivalent record in
[`backend/docs/meal-planning/requirement-evidence-checklist.md`](../../backend/docs/meal-planning/requirement-evidence-checklist.md).

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

Every other Figma colour, spacing value and radius already mapped 1:1 to an existing token.

**Seven, and no eighth.** There is deliberately no generic 2px `Spacing` entry. Every 2px value in the
design is a distinct purpose rather than a shared spacing step, so each one lives in `Sizes` under its
own name: the control inset inside a segmented track is `Sizes.SEGMENT_TRACK_INSET`, the gap between a
stacked label and its value is `Sizes.ROW_VALUE_INSET_T`, an option card's label-to-subcopy gap is
`Sizes.OPTION_SUBCOPY_GAP`, a banner's title-to-body gap is `Sizes.BANNER_BODY_INSET_T`, and a day
chip's weekday-to-number gap is `Sizes.DAY_CHIP_NUMBER_INSET_T`. Adding one `Spacing` step for all of
them would collapse five purposes onto one token, which is exactly what the naming principle below
forbids.

**Three more entries exist for a different reason, and one of them contradicts what the plan expected
of this folder.** They carry no new Figma value: each names a literal that already shipped, in a file
this feature touched, which is what the migrate-on-touch clause below requires. All three come from
one component, `src/components/MinimumVersionSheet/`.

| Token                    | Value                                                          | File                    | The literal it names                                    |
| ------------------------ | -------------------------------------------------------------- | ----------------------- | ------------------------------------------------------- |
| `Theme.colors.sheetScrim` | `rgba(0,0,0,0.7)`                                              | `src/styles/theme.ts`   | the forced-update sheet's blocking backdrop             |
| `Spacing.XX_LARGE`       | `48`                                                           | `src/styles/spacing.ts` | that sheet's button margin                              |
| `Shadow.SHEET`           | `#000`, offset `0 / −2`, opacity `0.25`, radius `8`, elevation `10` | `src/styles/shadow.ts`  | that sheet's `sheetShadow`, previously an inline object |

So `src/styles/shadow.ts` **does** change, where the plan records that it needs none — the design
adds no effect beyond `Shadow.CTA_GLOW`, and that part holds. What the plan did not anticipate is a
shipped component with a literal shadow being touched at all. `MODAL`, `CARD`, `CTA_GLOW` and
`ICON_GLOW` are byte-identical, `Shadow.SHEET` has exactly one consumer
(`MinimumVersionSheet/index.styled.tsx`), and `src/components/GlobalBottomSheet/index.styled.tsx`
still writes the identical literal because the plan protects that component and this feature does not
touch it. The same scope note applies to the two `fontSize.ts` maps below, whose `LABEL`,
`OPTION_SUBCOPY`, `ROW_VALUE`, `STEP_BODY`, `EYEBROW` and `EXTRA_LIGHT` entries the plan's token list
does not enumerate. All of it is declared, with the rest of the delivered file scope, in
[section 2](#files-this-feature-changes-beyond-the-plans-list).

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
`FoodDetail/index.styled.ts`, the stylesheets of `PrimaryButton`, `SecondaryButton`,
`SegmentedControl` and `FoodListRow`, and — the one outside this feature's own surface —
`MinimumVersionSheet/index.styled.tsx`, which is where the three entries above came from and the
reason `src/styles/shadow.ts` is in the changeset at all. `App.tsx`'s `style={{flex: 1}}` moved into
a new `App.styled.ts` under the same clause. If you touch another shipped stylesheet, do the same
there — that is also why the scan is fed a diff rather than a fixed file list, and why the census in
[section 2](#files-this-feature-changes-beyond-the-plans-list) lists the shipped files this clause
pulled in.

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
3. **Colour contrast.** `src/styles/theme.ts` carries an accessible-colour register whose status it
   records in two parts, because they have different owners: **engineering, complete** — every pair
   implements the value Figma draws, and the accessibility work that needs no ruling (roles, labels,
   44px targets) is applied — and **design, open**. Eight colour pairs ship below their WCAG 2.1
   thresholds, from `white` on `green` at 2.45:1 to `inputBorder` on `inset` at 1.12:1. Each entry
   names the Figma nodes that draw it, the measured ratio, the threshold and a pre-computed remedy
   using existing palette tokens. They were not changed unilaterally because Figma draws them
   exactly as the app renders them and the constants are read across the app, well beyond this
   feature. This is accepted, tracked accessibility debt awaiting a design ruling — the register
   records the decision, it does not make the palette compliant. The same disposition is stated for
   a reviewer in the API repository's acceptance document, under "Dispositions awaiting a human
   ruling".

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

Step 1 exits `0` over the 469 changed source files, with `master` resolving to the feature's
reference commit `788a36f` (`origin/master` in a fresh clone) — touched files are clean, per the
styling rule's migrate-on-touch clause. That reference commit is also the branch's own merge base:
AAP §0.1.4 requires the feature branch to sit on it, and it was brought into this branch's history
by merge rather than rebase so that the commit shas the acceptance documentation provenances its
measurements to stay valid — `git merge-base HEAD master` answers `788a36f`, and the reconciliation
of the one template file both sides rewrote is in that merge's own message. Running step 1 against
`603718ee`, the reference's parent, widens the list to 471 by adding `babel.config.js` and
`env.d.ts` — the two files the reference itself changed and this branch matches byte for byte — and
that run exits `0` as well. Step 2 exits `0`: `0 new findings`, and all 487 baseline paths still on
disk are covered by the after report's 886 results.

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
`babel.config.js` and `metro.config.js` are byte-identical to the reference commit. `App.tsx` is
not in that set and is **not** byte-identical — this feature changes it (`+44 / −14`), and it lints
clean; what changed is in the
[section 2 census](#files-this-feature-changes-beyond-the-plans-list).

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

The measured after-run: **886 files linted, 38 findings in 20 files — 26 errors and 12 warnings**,
and the comparator reports **0 new findings**. The count fell from 49 by eleven, and each of the
eleven is accounted for rather than left to the total. Eight sat in files this feature touched and
were fixed there: `src/constants/endpoints.ts`, `src/constants/strings.ts`,
`src/navigation/HomeTabs.tsx`, `src/screens/Macros/components/DailySummaryCard/index.tsx`,
`src/screens/FoodDetail/index.util.ts`, `App.tsx` (its `<GestureHandlerRootView style={{flex: 1}}>`,
now `styles.gestureRoot` from the `App.styled` module the migrate-on-touch clause required),
`src/service/http/httpRequest.ts` and
`src/utility/CrashUtility.ts` (a `no-explicit-any` each, gone with the types those files now
declare). The other three are the parse errors of `.eslintrc.js`, `babel.config.js` and
`jest.config.js`, which the scoped override above replaced with a normal lint of those files — and
they report nothing.

One finding the baseline records is deliberately still here: `metro.config.js`'s project-aware parse
error, in a file this feature does not touch, left where it is rather than fixed by editing it —
`metro.config.js` is outside the parser override for the reason given above. The comparator is
unmoved — a baseline finding is not a new one — which is why the count is read beside this note and
not on its own.

The 38 that remain, in full, so a later run can be compared file by file rather than by total:

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
| `src/service/workouts/__tests__/syncWorkoutDay.test.ts`           | 1        | `jest/no-identical-title`                                                       |

By rule: `@typescript-eslint/no-explicit-any` 11, `@typescript-eslint/no-var-requires` 8,
`react-hooks/exhaustive-deps` 4, `prettier/prettier` 4, `react-native/no-inline-styles` 3,
`jest/no-identical-title` 2, `@typescript-eslint/ban-ts-comment` 2,
`react/no-unstable-nested-components` 2, fatal parsing error 1, `@typescript-eslint/no-shadow` 1.

Nineteen of those 20 files are byte-identical to the reference commit `788a36f`, so no finding in
them belongs to anything this feature wrote. The twentieth is named rather than folded into that
claim: `src/components/SearchBar/index.tsx` **was** touched — it gained the optional `maxLength`
prop the catalogue search passes — and it still carries the baseline's
`react-hooks/exhaustive-deps` warning at line 32. That warning is the baseline's own and not
something the touch introduced: the comparator keys a finding by file, rule and message and reports
zero new ones, and the `useEffect` it names is outside every line the diff changes. It survives
because it is a warning, so the changed-file step lints the file and still exits `0`; fixing it
would mean changing that effect's dependency array, which is a behavioural edit to a shipped shared
component and no finding asks for it. One further file needs a word of explanation even though it now
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
  environment. That line is **unrun** as well. `adb`, `emulator`, `sdkmanager` and `avdmanager` are
  absent, `ANDROID_HOME` is unset and `/dev/kvm` does not exist, so neither a device build nor an
  emulator is reachable. The executable form of that line is in
  [Shipped surfaces, beside the pre-feature build](#shipped-surfaces-beside-the-pre-feature-build).
- **No renderer of any kind exists here — not even a browser one.** `react-native-web` and
  `react-dom` are both absent from `node_modules`, and `npx expo export --platform web` exits 1
  demanding `react-dom@19.2.3` and `react-native-web@^0.21.2`. Installing them would be a new mobile
  dependency, which AAP §0.4.2 excludes, so the browser route to a rendered tree is closed as firmly
  as the native one.
- **`react-test-renderer` is present but runs no layout.** Version 19.2.3 resolves through
  `jest-expo` and was leaned on heavily: it mounts the real components against real API payloads and
  yields their style and prop trees, which is how the "what this screen would show" statements
  behind this delivery were established. It does not run Yoga and does not apply native font
  scaling, so it produces **no computed boxes**. Overflow, clipping, overlap, ellipsis points,
  off-screen controls and scroll reachability are unobservable by any means available here, and
  nothing in this delivery presents them as observed.
- **No screen reader is reachable by any path.** `orca`, `accerciser` and `espeak-ng` are not
  installed; `xcrun`, `simctl`, `xcodebuild` and `instruments` are absent, so there is no iOS
  simulator; the Android tooling above is absent, so there is no emulator; and with no web renderer
  there is no browser accessibility tree to read either. `@testing-library/react-native` is also
  absent, so even the render-level accessibility assertions a test could make do not exist.
- **This delivery therefore contains no screenshot at all.** `blitzy/screenshots` and
  `blitzy/screen_recordings` hold zero files, and will stay empty until someone runs this section on
  hardware. Every statement this delivery makes about how the feature looks rests on a style or
  derivation harness, never on a pixel.

Native configuration flows through `app.json` and Expo config plugins; the generated `ios/` and
`android/` projects are git-ignored and are not present in the repository. Do not edit a generated
native project — change the config and regenerate.

**Six measurement passes are UNRUN in the strong sense** — not skipped, not inferred, and not
covered in passing by the automated suites. Each is recorded below with what was run instead, the
steps that close it, and the combinations still to be checked. Only the first blocks.

| Pass                                                                | Recorded under                                 | Blocking |
| ------------------------------------------------------------------- | ---------------------------------------------- | -------- |
| Measured geometry per device class                                  | Layout and accessibility → Responsive geometry | **yes**  |
| Dynamic type at the six scale × width combinations                  | Layout and accessibility → Dynamic type        | no       |
| VoiceOver and TalkBack passes                                       | Layout and accessibility → Screen readers      | no       |
| Native confirmation of the recipe and swap states                   | Recipe and swap                                | no       |
| Pixel comparison, interactive states, gestures, console cleanliness | Screenshots                                    | no       |
| Regression over the shipped surfaces this feature touched           | Shipped surfaces, beside the pre-feature build | no       |

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

**Every swap-flow observation behind this delivery is harness-derived, and that matters here more
than elsewhere.** Frames 12, 13, 13c, 13b, 13d and 13e were exercised by driving the shipped screen
components under `react-test-renderer` with the `jest-expo` preset against a real backend, through
the app's own `httpRequest.ts`, its io-ts codecs and its interceptors: real data and real code, and
not one rendered pixel. Values, state selection and copy are therefore established from the shipped
code. Timing and appearance are not, and the four items below are the ones only a device can settle.
They stay **UNRUN**.

- [ ] **The decisive one.** After a **successful** "Use this meal", keep watching the screen for
      about a second. Record whether the error toast "That meal no longer fits your plan." becomes
      visible after the success toast "Meal swapped. Grocery list updated.", and whether any
      unexpected back navigation is visible. Off-device the three post-commit requests settle in
      roughly 200 ms while a native pop transition takes roughly 300–350 ms, so which of the two
      finishes first decides whether that contradictory toast is invisible plumbing or something a
      user reads. Treat it as a user-visible defect if it is seen
- [ ] Record the rendered ingredient-quantity strings on 12 **and** on 13b verbatim, at both
      "Your portion" and "Full recipe", and compare them against the display convention the backend
      already applies — a raw decimal where a fraction is drawn, or a unit word that should not be
      there, is the divergence to look for. Both frames render through the same client helper, so one
      device pass covers both
- [ ] Force-quit the app mid-commit, relaunch, and confirm **exactly one** swap resulted
- [ ] Judge the 13b → plan-day pop for native transition smoothness and for how long the toast
      dwells — that dwell time is the timing the first item turns on

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

Three measurement passes live here, and all three are UNRUN for the reasons at the top of this
section rather than merely unchecked. Each has its own record below: what was run instead, so the
reader knows what is already covered; the steps that close it; and the combinations still to be
checked. AAP §0.7.4 is the requirement all three answer to — screenshots at 100 %, 135 % and 200 %
dynamic type on 375 px and 393 px, and a VoiceOver pass over 11, 13b, 14 and 15.

#### Responsive geometry — UNRUN/BLOCKED, and the one gap here that blocks

The responsive requirement asks for four things per screen per device class: **horizontal overflow,
clipped text, overlapping elements, and a footer covering content**. All four are measurements, and
none of them was taken at any device class — there is no renderer, and `react-test-renderer` returns
no computed box. Nothing downstream re-tests this, which is why it is called out as blocking: it is
closed by the steps below and by nothing else.

**What is already covered, so the run below is confirmation rather than discovery.** Every one of
the 18 routed screens resolves one byte-identical `ContentColumn` style at every width —
`{flex: 1, width: '100%', alignSelf: 'center', maxWidth: Sizes.CONTENT_MAX_WIDTH}` over
`Spacing.X_SMALL` top and `Spacing.GUTTER` horizontal padding — and no style anywhere carries a
device width or a column width as a literal; every numeric `width` is an icon or control token. The
flex-derived geometry matches its own unit tests at every width (content column 335 at 375 px, 353 at
393 px, 560 inside the 600 px cap; day chip 42.71 at 375 px, 45.29 at 393 px; metric-grid cell 71.25
at 393 px). Footers pad by `max(inset, Sizes.FOOTER_MIN_BOTTOM)` and sit as siblings of the
scroller's parent rather than over it, so they occupy their own column space; RecipeDetail's action
bar, the one surface genuinely pinned over content, reserves `ACTION_BAR_RESERVE` inset-awarely. The
six surfaces whose Figma frames clip all place their last row inside a scroller with no clipping
ancestor. That is style-tree and derivation evidence throughout. None of it is a measured box.

**What is genuinely unmeasured**, and is therefore what a device pass is for: computed box geometry;
horizontal overflow; text clipping; element overlap; whether `KeyboardAwareScrollView` actually
scrolls the focused field above the keyboard; mid-token line breaking of an unbroken 60-character
string; and every screenshot.

| Device class                     | Style tree and derivations | Measured pixels, overflow, clipping, screenshots |
| -------------------------------- | -------------------------- | ------------------------------------------------ |
| 375×667 iPhone SE                | covered                    | **UNRUN/BLOCKED**                                |
| 393×852 reference                | covered                    | **UNRUN/BLOCKED**                                |
| 430×932 iPhone Pro Max           | covered                    | **UNRUN/BLOCKED**                                |
| 834×1194 iPad                    | covered                    | **UNRUN/BLOCKED**                                |
| 320×568 legacy (extra)           | covered                    | **UNRUN/BLOCKED**                                |
| 320×1180 iPad Split View (extra) | covered                    | **UNRUN/BLOCKED**                                |
| 1024×1366 iPad Pro (extra)       | covered                    | **UNRUN/BLOCKED**                                |
| 393×600 short (extra)            | covered                    | **UNRUN/BLOCKED**                                |

The first four classes are what the requirement names; the last four are the widths
`ios.supportsTablet: true` without `requireFullScreen` can hand the app through Split View despite
the portrait lock, and they are listed because the four named classes do not describe them.

The steps, in order. The first five restate [Preconditions](#preconditions) with what a multi-device
pass adds; from the sixth on, this is work no other part of this section describes.

- [ ] macOS with Xcode, and — if the Android half is also wanted, which AAP §0.8.2 places out of
      scope — an Android SDK and JDK
- [ ] `mobile/GoogleService-Info.plist` (or `GOOGLE_SERVICES_INFO_PLIST_FILE`) and
      `mobile/google-services.json` supplied as **untracked** files, never committed
- [ ] `mobile/.env` carrying `SOH_API_BASE_URL=http://<dev-host>:<port>` — never a production origin
      — confirmed by `assertNonProductionApi()` printing that origin
- [ ] Development Firebase Remote Config `meal_planning_enabled=true`, fetched once, then a **cold
      start** — the app fetches only at launch and throttles to 15 minutes, so flipping it under a
      running app changes nothing
- [ ] The dev API running with `MEAL_PLANNING_ENABLED=true` after `catalog:load --release v1` and
      `recipes:seed`
- [ ] `npm run ios` on iPhone SE (375×667), iPhone 14/15 (393×852), iPhone 15 Pro Max (430×932) and
      an iPad **both full-screen and in Split View at 320, 507 and 694 pt**
- [ ] At each class, walk the 33 screens and states — 01, 02, 03, 03b, 04, 05, 06, 06b idle and
      results, 07 in both 3-meal and 3-meals-plus-snack shapes, 08, 09, 09b, 10, 10b, 10c, 11, 11b,
      11c, 12, 13, 13b, 13d, 14, 14b, 14c, the empty-list variant of 14, 15, 15b, the unavailable
      card and the inline error card — capturing one screenshot each and recording the four
      measurements for each: horizontal overflow, clipped text, overlapping elements, and a footer
      covering content. That is 8 classes × 4 measurements × 33 surfaces, and every cell is
      currently unrecorded
- [ ] Additionally capture the five input screens with the number pad open — 02 Goal, 03 About you,
      08 Cooking and budget, 09b Edit targets, 15 Log planned meal — and confirm the focused field is
      scrolled above the keyboard, not merely still mounted. Note while doing it that
      `enableOnAndroid` is set on `LogPlannedMeal` alone, so the other four need the Android check
      explicitly
- [ ] Additionally scroll each of the six clipped surfaces to its **last** row: the seventh
      Plan-settings row on 16, the last row of 14b's Checked card, Review rows 3–6 on 09, the 03b
      form under the pinned footer, 13b's ingredient rows, and the last diary meal card above the tab
      bar
- [ ] Render a grocery row and an ingredient row whose quantity string is long beside a long name,
      and an unbroken 60-character token in a body-text block, and record whether the quantity
      truncates itself or collapses the name column, and where the token breaks

#### Dynamic type — UNRUN/BLOCKED at 0 of 6 required combinations

AAP §0.7.4 requires six combinations. **None of them rendered**, so every statement about how this
feature behaves at an enlarged text size is a statement about declared styles, not about a scaled
layout. `PixelRatio.getFontScale()` is 1 in every run this environment permits.

| Combination    | Rendered          |
| -------------- | ----------------- |
| 100 % × 375 px | **UNRUN/BLOCKED** |
| 100 % × 393 px | **UNRUN/BLOCKED** |
| 135 % × 375 px | **UNRUN/BLOCKED** |
| 135 % × 393 px | **UNRUN/BLOCKED** |
| 200 % × 375 px | **UNRUN/BLOCKED** |
| 200 % × 393 px | **UNRUN/BLOCKED** |

**What is already covered, so the residual risk is narrow.** `allowFontScaling` and
`maxFontSizeMultiplier` have zero occurrences in `src`, so nothing opts out of scaling or caps it,
and an explicit `lineHeight` does scale with the user's text size on both platforms — this was read
out of the framework sources rather than remembered. Line caps are rare and each is deliberate: the
three controls that must stay on one line — `SegmentedControl`'s labels, `DeltaPill` and
`InstructionStep`'s step number — pair `numberOfLines={1}` with `adjustsFontSizeToFit`, so the label
shrinks rather than truncates, while `IngredientRow`'s quantity and `FoodListRow`'s name line and
subtitle cap at one line without shrinking. Body copy is uncapped throughout. The day strip's chips
are `flex: 1` over a `minHeight`, the badge row wraps with every pill free to shrink, and
`SummaryRows` declares no height at all, so all three grow with the text; the wizard progress bar is
the one deliberately fixed height in the feature and it holds no text. CTA labels are uncapped and
the buttons use `minHeight` with padding, every one of the 18 routed screens puts its body in a
scrollable sibling of its footer, and
`PlanConfirmDialog` scrolls its badge, title, body and summary inside a window-derived `maxHeight`
with the notice and both actions pinned outside that scroll region. What none of that can show is a
scaled layout: the truncation, clipping, overlap and off-screen outcomes below are the point of the
run.

- [ ] macOS with Xcode and CocoaPods
- [ ] The development `GoogleService-Info.plist` at `mobile/` (or `GOOGLE_SERVICES_INFO_PLIST_FILE`),
      and `google-services.json` for the Android pass — never committed
- [ ] A development Firebase test account for the `state-of-health-ea1ef` project
- [ ] `npm ci --legacy-peer-deps`, `SOH_API_BASE_URL` pointed at the dev backend and confirmed
      non-production through `assertNonProductionApi()`, then `npm run ios`
- [ ] iOS **Settings → Accessibility → Display & Text Size → Larger Text**: capture at 100 %, at the
      135 %-equivalent notch, and at 200 % — the top notch needs *Larger Accessibility Sizes* enabled
- [ ] Repeat the whole walk at 375 px (iPhone SE) and at 393 px (iPhone 15/16), giving the six
      combinations above
- [ ] At **each** of the six combinations, walk all 18 routed screens plus the Meal Plan tab
      (11/11b/11c) plus the five shipped screens this feature touched — Diary, Add Food with the
      Catalog section visible, Food Detail, Account and Progress — screenshotting each and recording:
      truncated body text; clipped dense rows, specifically the seven 63-tall Plan-settings rows on
      16, the 46-tall grocery rows on 14/14b and the meal-card meta line on 11; overlapping elements;
      a CTA pushed off-screen; and whether everything clipped is still reachable by scrolling
- [ ] With the keyboard open on 02 Goal, 03 About you, 08 Cooking and budget, 09b Edit targets and
      15 Log planned meal, confirm the value, the unit suffix and any inline validation message stay
      visible at 200 %
- [ ] Open the 16b regenerate dialog at 200 % and confirm the title, the body, **all three** summary
      rows and **both** actions remain visible and reachable
- [ ] Re-check the cap-and-shrink risks the static pass could only argue: the one-line rows above,
      and the shipped `SegmentedControl` labels at the three legacy call sites, which now shrink
      where they used to wrap

#### Screen readers — UNRUN/BLOCKED on both platforms

AAP §0.7.4 asks for a VoiceOver pass over **11, 13b, 14 and 15**. No VoiceOver or TalkBack pass was
performed, and none is performable here. Both platforms matter and neither is optional: two of the
reported defects are platform-split, where `accessibilityLiveRegion` is honoured by TalkBack and
silent under VoiceOver, so a single-platform pass would record the opposite result on each.

**What is already covered.** The accessibility tree each platform reader consumes was enumerated for
30 screen states against real API payloads — effective role, computed accessible name,
`accessibilityState`, `accessibilityValue`, hint, live region, modal flag, hidden-from-assistive-tech
flags, declared geometry and `hitSlop`, in reading order — with every `announceForAccessibility` call
recorded at the moment it fired, press drivers re-reading the tree after each state change, and a
static inventory cross-checking 201 interactive elements across 60 files. Roles, labels, checked and
selected states and the 44 px (`Sizes.TOUCH_TARGET`) hit areas are therefore established from
executed code. What a tree cannot show is **what is spoken, when, and where focus goes** — which is
the whole of the list below.

Prerequisites, on top of [Preconditions](#preconditions):

- [ ] iOS: `npm run ios` on macOS with Xcode, on a physical iPhone, **Settings → Accessibility →
      VoiceOver ON**, and the Screen Curtain enabled (triple-tap with three fingers) so the pass is
      genuinely non-visual
- [ ] Android: `npm run android` on a physical device, **Settings → Accessibility → TalkBack ON**
- [ ] A real plan generated through the app, so every screen carries real content

The nine observations only a reader can settle:

- [ ] **D1 — focus after a body-replacing state change.** No programmatic focus management exists
      anywhere in the app, so each of these depends on a platform default that was never observed:
      drive 10 → 10b (`MEAL_PLANNING_FAULT=generation`), 13c → 13d (a slot with no alternatives),
      14 → 14c, and a day change on the 11 day strip. After each, swipe right once and record where
      focus lands. Focus landing on the screen root, or on a node that no longer exists, is a defect
- [ ] **D2 — whether the 16b dialog announces itself.** `accessibilityViewIsModal` is set on the
      card and opening it fires only haptics. On 16 press "Regenerate this week" and record whether
      the title and body are spoken unprompted; then swipe right repeatedly and confirm focus never
      escapes the card to the settings rows behind the scrim
- [ ] **D3 — validation silence on 02 and 07.** Both carry error text with no live region, no
      alert or status role and no announcement. With nothing selected, double-tap "Continue" and
      record what is spoken. Nothing at all is the defect. Repeat both screens under TalkBack
- [ ] **D4 — the iOS/Android split.** 08, 06 and 03's sex group wrap their message in
      `accessibilityLiveRegion="polite"`; 03 and 09b additionally fold the message into the field's
      name. Press Continue with a missing answer on 08, 06 and 03, and press "Save targets" with
      Carbs = 0 on 09b. TalkBack is expected to speak the message and VoiceOver to stay silent —
      record **both** platforms for each of the four
- [ ] **D5 — toasts.** Neither the project's toast module nor the vendored toast library carries any
      accessibility property. Commit a swap on 13b with "Use this meal" and record whether "Meal
      swapped. Grocery list updated." is spoken; then arm `MEAL_PLANNING_FAULT=swap` and record
      whether the error toast is spoken. A failure that is never announced is the defect
- [ ] **D6 — the LOGGED badge.** The card's own label overrides its children, and the meta template
      carries no "logged" word. Log a meal, navigate to that card and record the announcement. It
      being indistinguishable from an unlogged card's is the defect
- [ ] **D7 — RecipeDetail's instruction steps.** They sat outside the test renderer's virtualised
      window, so only their construction is verified. Open 12, swipe right through the entire
      screen, and confirm every numbered step is reached and read as one stop
- [ ] **D8 — the heading rotor.** Only three `header` roles exist across the whole new surface. On
      13b (44 stops) and on 14b (50 stops), set the VoiceOver rotor to Headings and record what it
      finds. Finding nothing on 13b is the defect
- [ ] **D9 — focus on open and restoration on return.** Navigate 11 → 12 → back, 11 → 15 → back,
      and 16 → 16b → dismiss, recording where focus lands on open and whether it returns to the
      control that opened the screen

The full pass, one line per surface. For each, swipe right through the entire reading order and
record every element reached, the order, the exact announced text, and anything unreachable or
announced meaninglessly:

- [ ] **11 / 11b / 11c Meal Plan tab** — the day strip, the three action pills per meal, the totals
      card, "Open plan settings", and on 11b the LOGGED card and the success banner. Covers D1, D6
- [ ] **13b SwapPreview** — the delta pill, the calorie progress bar's name, and the macro grid's
      stops. Covers D5, D8
- [ ] **14 / 14b / 14c GroceryList** — every checkbox name carries its quantity, section headers act
      as headings, "Uncheck all" is absent with nothing checked, and the flagged row reads in full
      including its old amount, new amount and delta. Record whether the 14b banner is heard as one
      message or as fragments
- [ ] **15 LogPlannedMeal** — the "This adds" live region re-announces on **every** servings change
      on both platforms, and the date steppers announce which direction they move
- [ ] **Wizard 02–08** — all seven steps: nothing is preselected on first entry, every control is
      reachable by name, and D3/D4's validation behaviour holds
- [ ] **09 Review / 09b Edit targets** — the grouped targets card reads as one utterance, and 09b's
      error behaviour matches D4
- [ ] **10 / 10b / 10c Generating** — the pending header, the outcome announcements, and the
      constraint rows on 10c including an empty allergen value
- [ ] **13c / 13 / 13d / 13e Swap flow** — "Alternatives, 2 found" on 13 and 13d's empty state are
      heard on both platforms
- [ ] **16 PlanSettings + 16b dialog** — the seven value-first rows and the flagged-meal banner,
      which needs a plan with incompatibilities: change the diet to vegan first. Covers D2
- [ ] **Non-visual completion** — with the Screen Curtain on, complete each of: finish setup,
      generate a plan, swap a meal, check groceries, log a meal. Record every dead end. The tree says
      all five are completable; the swap's only success feedback is the toast in D5
- [ ] **Sample data** — confirm no control announces a mock date, name or calorie figure. Frame 01's
      example week announces the word "Sample" itself, which is correct
- [ ] **Shipped screens with the reader on** — Diary (can Breakfast's add row be told from Dinner's
      when the four are icon-only?), Add Food's Catalog rows and provenance badges, Food Detail's
      glyph-only stepper and fraction chips, Account, Progress, and the tab bar: confirm "Macros,
      tab, 1 of 5" and that the bar is genuinely absent from the reader on the 18 routed screens,
      which could only be established here from the `display: 'none'` mechanism

### Screenshots

- [ ] Capture a matched screenshot for each of the 31 frames at 393×852, and note the section 5 font
      delta on every one

Capturing them is only the first half. **Five dimensions of the journey through this feature were
never exercised**, because each needs a renderer, and every screen observation behind this delivery
came instead from executing the shipped presentation layer — the `index.util.ts` derivations, the
io-ts decoders, the converters and the mutation option factories — in-process against real HTTP
payloads. That establishes values, state selection and copy. It establishes nothing about pixels,
and the derived geometry it did confirm numerically is narrow: the day chip at 42.71 px on 375 px and
45.29 px on 393 px, the metric-grid cell at 71.25 px on 393 px, and the content column at 335 px,
353 px and 560 px for 375 px, 393 px and 1024 px. The five dimensions below are **UNRUN**.

- [ ] Compare each captured screenshot pixel-for-pixel against its Figma node — at minimum frames
      12, 13, 13b, 13c, 13d, 13e, 14, 14b, 14c and 16, which the journey passes through — and record
      every difference that is not the section 5 typeface deviation
- [ ] Exercise the interactive states no static pass can reach: press and hold each CTA, each day
      chip and each pill and confirm it dims to 0.6 while held; confirm a disabled CTA dims to 0.5
      and ignores the press in each of its three real cases — a swap commit in flight, a grocery
      toggle in flight, and a read-only saved plan; and drive the gestures, meaning the grocery
      `FlatList` scroll, the recipe `SectionList` scroll and the back swipe out of each pushed screen
- [ ] Repeat the journey at each breakpoint on real hardware — 375×667, 393×852, 430×932 and an iPad
      — confirming the content column caps at 600 px and stays centred and that every screen remains
      scroll-reachable above its pinned footer
- [ ] At **each** of those breakpoints confirm the JavaScript console is clean: no red box, no
      warning and no error, recorded per breakpoint rather than once
- [ ] Complete the accessibility half of the same walk — the Screen readers and Dynamic type records
      above own it; this line exists so a screenshot pass is not mistaken for coverage of it
- [ ] The continuity check needs a real relaunch: swap a meal, check four grocery items across
      different sections, **force-quit** the app and launch it again. Confirm the Meal Plan tab shows
      the swapped recipe, all four checks are still set and no flag was lost. Server-side durability
      across an API restart is already proven; what is unproven is the client after a process death
- [ ] Then relaunch with the device offline and confirm the saved-plan copy renders read-only under
      its "Showing your last saved plan" banner, with no plan action offered

### Shipped surfaces, beside the pre-feature build

This feature reached into screens that already shipped — it extended `PrimaryButton`,
`SecondaryButton` and `SegmentedControl`, changed how targets are read on Account, Diary and
Progress, and added a Catalog section to Add Food. **Nothing native was run over any of them.**

What stands in for it is a comparison rather than a recollection, and the same discipline applies to
the device pass: both trees were rendered side by side — the pre-feature commit `788a36f` and this
one — and their rendered trees and computed styles diffed screen by screen, over all 23 shipped
screens and the touched components, with the feature on, off, and never fetched. That is how the
deltas below are known to be the only ones. It is also why the human run must have **a build of
`788a36f` on the bench next to the current one**: a one-pixel difference is only visible against the
thing it differs from, and every step below is a two-build comparison.

- [ ] Open a `ConfirmModal` — Account → "Log Out" is the real caller — and measure **both** button
      heights against the pre-feature build. `PrimaryButton`'s inner box gained
      `minHeight: ctaMinHeight(Sizes.CTA, Sizes.TOUCH_TARGET)` = 52, and `ConfirmModal` shrinks its
      buttons with `padding: Spacing.X_SMALL` (8), which does not reset a `minHeight`. Because
      `paddingVertical: Spacing.MEDIUM` (16) is present on both trees and wins by edge precedence,
      the expected difference is about 1 px and none at all while loading. Record the measurement
      either way — the point is to close it, not to assume it
- [ ] Tap **4 px above and below** each `SegmentedControl` at its three shipped call sites — Progress,
      Log with AI and Log Weight — and confirm no neighbouring control's tap is stolen. The option's
      press box is raised to `Sizes.TOUCH_TARGET` and pulled back by a negative `marginVertical` of
      the same inset, so the envelope bleeds 4 px past the drawn track in each direction while
      occupying no layout space at all — which is exactly why a static read cannot settle it
- [ ] At **200 %** text on the same three call sites, confirm the segment labels **shrink rather than
      wrap** — they carry `numberOfLines={1}` with `adjustsFontSizeToFit`, which is a change from the
      pre-feature build, and Log with AI's long meal names are where it shows
- [ ] Put the device in **airplane mode** and confirm Account's "Daily calories" row still shows its
      number while **losing its edit chevron**. This is a steady state, not a first-paint flicker:
      the targets query is not persisted and spends its single retry, so it stays failed for the
      session. Confirm the same on the Diary ring and on Progress → Activity, and record whether
      each editor is reachable at all
- [ ] Capture all 23 shipped screens beside the pre-feature build and diff the pairs — Diary, Add
      Food with and without its Catalog section, Food Detail, Account, Progress and the rest —
      recording every visible difference, including the tab bar on the 18 routed screens
- [ ] **Android, explicitly UNRUN.** Inject `google-services.json` as an untracked file, then
      `npx expo prebuild --platform android` followed by `./gradlew assembleDebug` in a configured
      Android SDK environment. Nothing here covers Android beyond `npx tsc --noEmit`, and a
      successful compile is the floor, not the pass: repeat the four steps above on the device with
      TalkBack for the reader items

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

The checklist is also where the API's own unrun records live, and two of them bear on what section 10
above can be compared against. Its
[read figures measured elsewhere](../../backend/docs/meal-planning/requirement-evidence-checklist.md#read-figures-measured-elsewhere-and-what-they-exclude)
publishes the plan-facing read latencies a device pass will feel, states that every one of them
excludes Firebase token verification, and bounds that exclusion by measurement; its
[what is unrun or unverified](../../backend/docs/meal-planning/requirement-evidence-checklist.md#what-is-unrun-or-unverified)
records that no authenticated call was ever made against a running server and why, which is the same
missing development test account that section 10's Preconditions ask for. A device run that cannot
get that account is blocked on the API side too, and both documents say so.

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
