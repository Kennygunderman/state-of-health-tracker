<div align="center">

![State of Health_LOGO](https://github.com/Kennygunderman/state-of-health-tracker/assets/16354865/b6d58f3a-973d-44e0-8ccb-216e3d358eeb)

# State of Health

**Lift. Eat. Run. One app keeps score.**

[**Download on the App Store**](https://apps.apple.com/us/app/state-of-health/id6470658244?platform=iphone) · [**thestateofhealth.com**](https://thestateofhealth.com/)

![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=white&labelColor=20232a)
![Expo](https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)
![TanStack Query](https://img.shields.io/badge/TanStack%20Query-v5-FF4154?logo=reactquery&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-v5-443E38)

</div>

---

Your training and your diet are the same goal, so why are they in separate apps? State of Health puts your workouts, macros, and runs in one place, with none of the bloat that makes most fitness apps a chore to open.

<div align="center">
<table>
  <tr>
    <td><img src="docs/screenshots/01-log-with-ai.png" width="270" alt="AI food logging" /></td>
    <td><img src="docs/screenshots/03-workouts.png" width="270" alt="Workout templates" /></td>
    <td><img src="docs/screenshots/04-runs.png" width="270" alt="GPS run tracking" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/02-macros.png" width="270" alt="Macro tracking" /></td>
    <td><img src="docs/screenshots/05-progress.png" width="270" alt="Weight progress" /></td>
    <td><img src="docs/screenshots/06-weekly-goal.png" width="270" alt="Weekly training goals" /></td>
  </tr>
</table>
</div>

## What it does

**Workouts.** Build templates, start a session, and log sets as you lift. Progressive overload tracking watches every exercise and tells you when it's time to add weight or reps. Set a weekly target and watch the week fill up.

**Macros.** Type "3 eggs, toast with jelly, hash browns" and the AI breaks it into foods with calories and macros you can tweak. Prefer doing it by hand? Search the USDA database, which covers nearly every labeled food in the US, or build your own custom foods.

**Meal plan.** Answer a few questions about your goals and the foods you'd rather skip, check the calorie and macro targets that come out of them, and the app builds you a week of meals plus the grocery list to shop it. Open a recipe for its ingredients and instructions, or swap a meal you don't want and the list follows. Eaten one? Log the portion you actually had into the same diary as everything else, labeled "From meal plan" so you can tell later where it came from. Planned recipes come from a vetted catalog and their nutrition is calculated from the ingredient records behind them; where a food's numbers are an estimate, the app says so. It sits beside the diary in Macros, under a Diary / Meal Plan toggle.

**Runs.** GPS tracking with your route on the map, pace, speed, and calorie burn. Runs feed into the same daily activity picture as your lifts and steps.

**Progress.** Body weight trends against your goal, strength charts for every exercise, and a full history of everything you've logged. Every day you train or eat, the app keeps the diary for you.

## Under the hood

- React Native 0.86 on the New Architecture, Expo SDK 57
- TypeScript end to end
- TanStack Query for server state, Zustand for client state
- Node + Postgres backend with Prisma
- Firebase for auth (email, Google Sign-In) and Remote Config

## Development

```bash
npm install
npx expo run:ios
```

Copy `.env` from `.env.dist` and point `SOH_API_BASE_URL` at your own API — it holds a localhost placeholder, and debug builds and test runs refuse a production origin outright, so a copied template can't quietly read live data.

## Meal planning

The Meal Plan side of the Macros tab has its own engineering guide: [`docs/meal-planning.md`](docs/meal-planning.md). It maps every Figma frame to the screen that implements it, walks through running the feature locally, and records the decisions you'd otherwise have to reverse-engineer — the typeface that departs from the design, the `npm ci --legacy-peer-deps` workaround, the lint findings left standing, and a physical-iPhone verification checklist that is **unrun**, because no iOS build, simulator or device was available where this was written.

Two switches decide whether the feature is visible at all, and both are off by default:

- **The API must be running with `MEAL_PLANNING_ENABLED=true`**, after its catalog release and recipe seeds are loaded. Until then the Meal Plan segment shows an unavailable card. The server-side command order belongs to `backend/docs/meal-planning/README.md` in the sibling `state-of-health-be` repository — follow it there.
- **Firebase Remote Config `meal_planning_enabled` must have been fetched at least once.** The packaged default is `false`, so an install that has never picked up a console value hides the feature by design, and a console change reaches a device on its next cold start rather than mid-session.

Miss either one and the app looks exactly as it did before this feature — gated off, not broken. A device build additionally needs the Firebase files `app.json` points at: `GoogleService-Info.plist` for iOS (passed through `GOOGLE_SERVICES_INFO_PLIST_FILE`) and `google-services.json` for Android. Both are untracked build prerequisites — add them to your own checkout, and keep them out of commits.

## Shipping a release

1. Bump `version` and `buildNumber` in `app.json`
2. Build and submit:

```bash
eas build --platform ios --profile production --auto-submit
```

Or build and submit separately with `eas build --platform ios --profile production` and `eas submit -p ios --latest`.

---

<div align="center">

Built by <a href="https://github.com/Kennygunderman">Kenny Gunderman</a>

</div>
