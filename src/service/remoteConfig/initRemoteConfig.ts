import remoteConfig from '@react-native-firebase/remote-config'
import {
  MealPlanningFlagInputs,
  PACKAGED_MEAL_PLANNING_ENABLED,
  resolveMealPlanningFlagEnabled
} from '@utility/MealPlanEntitlementUtility'

remoteConfig().setDefaults({
  minimum_app_version: '1.4.3',
  // Kill switch for all AI logging (estimate + label scan). Flip to false in
  // the Firebase console to hide the feature; the backend AI_FEATURES_ENABLED
  // env var is the authoritative server-side switch.
  log_with_ai_enabled: true,
  // Defaults to false, unlike the flag above: a never-fetched or offline
  // install must hide meal planning rather than show it unseeded. The backend
  // MEAL_PLANNING_ENABLED env var is the second gate. The value is imported
  // rather than written here because the entitlement resolver reads the same
  // packaged default for every non-remote source, and two literals could
  // silently diverge.
  meal_planning_enabled: PACKAGED_MEAL_PLANNING_ENABLED
})

remoteConfig().setConfigSettings({
  minimumFetchIntervalMillis: 900_000 // 15 min
})

/** The epoch before any launch fetch has settled, which is also what a never-initialized process reports. */
const UNSETTLED_ACTIVATION_EPOCH = 0

/**
 * The state of the single launch-time fetch, published so React consumers that sample an activated value during
 * render learn when that value may have changed.
 */
export interface RemoteConfigActivation {
  /** Incremented once per settled `initRemoteConfig()` call, so a consumer can act once per activation. */
  epoch: number
  /** True once a launch fetch has settled, whether it activated a console value or failed. */
  isSettled: boolean
}

let activation: RemoteConfigActivation = {epoch: UNSETTLED_ACTIVATION_EPOCH, isSettled: false}

const activationListeners = new Set<() => void>()

/**
 * Publishes the settled launch fetch to every subscriber. The snapshot object is replaced only here, where its
 * value really changes, so a `useSyncExternalStore` consumer reading `getRemoteConfigActivation()` gets a stable
 * reference between activations instead of re-rendering forever on a fresh identity.
 */
const publishActivation = (): void => {
  activation = {epoch: activation.epoch + 1, isSettled: true}

  activationListeners.forEach(listener => listener())
}

/**
 * Subscribes to the settled launch activation. Returns the unsubscribe function `useSyncExternalStore` expects.
 *
 * This is deliberately NOT a foreground refresh and must not be completed into one: the app performs exactly one
 * Remote Config fetch per launch, throttled to the 15-minute minimum interval above, so a console change reaches
 * a device on its next cold start (AAP 0.7.5) and the server switch is what stops a device kept in the
 * foreground. No `AppState` listener, focus effect, interval, second fetch or SDK `onConfigUpdated`
 * subscription belongs here. The only thing published is the news that the one launch activation has settled —
 * without it, a first activation from the packaged `false` to a console `true` reaches an already-mounted
 * consumer only through an unrelated rerender.
 */
export const subscribeToRemoteConfigActivation = (listener: () => void): (() => void) => {
  activationListeners.add(listener)

  return () => {
    activationListeners.delete(listener)
  }
}

export const getRemoteConfigActivation = (): RemoteConfigActivation => activation

/**
 * The one launch fetch, called once at mount by `MinimumVersionSheet`. Resolves to the SDK's own
 * `fetchAndActivate` verdict (true when a newly fetched config was activated) and rejects as the SDK does, so
 * the caller keeps deciding what a failure means.
 *
 * The activation is published in `finally` because both outcomes settle the launch state a consumer is waiting
 * on: a failed fetch leaves the last activated value (or the packaged default) in force, which is just as much
 * the answer as a successful one.
 */
export const initRemoteConfig = async (): Promise<boolean> => {
  try {
    return await remoteConfig().fetchAndActivate()
  } finally {
    publishActivation()
  }
}

export const getMinimumAppVersion = () => {
  return remoteConfig().getValue('minimum_app_version').asString()
}

export const isLogWithAiEnabled = () => {
  return remoteConfig().getValue('log_with_ai_enabled').asBoolean()
}

// The source and fetch status are read alongside the value because asBoolean() alone cannot separate a
// never-activated packaged default from an activated console value, which is what the fail-closed policy in
// resolveMealPlanningFlagEnabled turns on. That policy lives in one place only; this reads its inputs.
const readMealPlanningFlag = (): MealPlanningFlagInputs => {
  const value = remoteConfig().getValue('meal_planning_enabled')

  return {lastFetchStatus: remoteConfig().lastFetchStatus, valueSource: value.getSource(), value: value.asBoolean()}
}

// Kept synchronous and exported for non-React callers. React consumers pair it with
// subscribeToRemoteConfigActivation so a render that samples it is re-run when the launch activation settles.
export const isMealPlanningEnabled = (): boolean => resolveMealPlanningFlagEnabled(readMealPlanningFlag())
