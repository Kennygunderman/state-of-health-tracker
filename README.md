![State of Health_LOGO](https://github.com/Kennygunderman/state-of-health-tracker/assets/16354865/b6d58f3a-973d-44e0-8ccb-216e3d358eeb)


# State of Health Tracking App

Any fitness goal is closely tied to the food you consume, so why should you have separate apps for tracking your progress in the gym and in the kitchen? The State of Health Tracking app offers an all-encompassing solution for tracking your macros and workouts.

At State of Health, we strive to simplify fitness. Our app is devoid of unnecessary features and is exceptionally user-friendly. It includes progressive overload tracking to ensure you add more reps or weight with each workout. Moreover, our app is seamlessly integrated with the USDA food database, enabling you to easily search for nearly any food item containing a label within the United States.

Our tracking app is loaded with comprehensive graphs, and charts to make sure you are on track every day to hit your goals. Each day you log a workout or meal, a diary entry will automatically be created for you to keep track of your progress.

# Setup

This app assumes you are using Expo EAS and have a registered Apple Developer account.

### Firebase Setup
To setup use with firebase:
1. Create an iOS app in the Firebase console.
2. Generate GoogleService-Info.plist file from Firebase.
3. Generate an OAuth 2.0 Token and add to the GoogleServices-Info.plist file: https://developers.google.com/identity/protocols/oauth2#1.-obtain-oauth-2.0-credentials-from-the-dynamic_data.setvar.console_name-.
4. Add GoogleService-Info.plist to root dir of project.

### Env / API Keys
1. copy `.env.dist` and paste it as `.env`
2. Generate API Key for USDA API here: https://fdc.nal.usda.gov/api-key-signup.html or request key from project maintainer.
3. Update `USDA_FOOD_API_KEY=` in the .env file with your API Key.

### Running EAS builds
EAS builds will ignore files found in .gitignore. Because of this, you must remove `.GoogleService-Info.plist` from the .gitignore to upload a build with EAS. Failing to do so will result in a failed build.


### Dev Build
Run an iOS dev build on a simulator:
1. Make sure all node modules are installed `npm i`
2. Open a simulator from XCode.
3. Run `npm run ios`

Run an iOS dev build on a physical device:
1. Create a native build in EAS. Run `npm run build-ios-dev` to upload a dev build to EAS.
2. Run Expo `npm run start`

To debug crashlytics on a dev build, add a firebase.json file with the following to the root dir of the project:
```
{
  "react-native": {
    "crashlytics_debug_enabled": true,
    "crashlytics_disable_auto_disabler": true,
    "crashlytics_auto_collection_enabled": true,
    "crashlytics_is_error_generation_on_js_crash_enabled": true,
    "crashlytics_javascript_exception_handler_chaining_enabled": true
  }
}
```

### Prod Build
1. Make sure to increment `version` and `buildNumber` inside the app.json file.
2. Build a native iOS build with `npx expo run:ios`
3. Create an iOS Prod build via `eas build --platform ios`. Submit to appstore connect with: `eas submit -p ios`

# Screenshots
<img src="https://github.com/Kennygunderman/state-of-health-tracker/assets/16354865/f2161f8a-6dd3-4849-ae81-9ea96cc0d173" width="334" height="670" />
<img src="https://github.com/Kennygunderman/state-of-health-tracker/assets/16354865/29f0bbcf-7a20-425e-974e-dd7aed3ca68e" width="334" height="670" />
<img src="https://github.com/Kennygunderman/state-of-health-tracker/assets/16354865/332054b4-c71b-4e67-8ecc-f7720925154c" width="334" height="670" />
<img src="https://github.com/Kennygunderman/state-of-health-tracker/assets/16354865/84ec42d5-172a-40c6-99d9-aeb206aaf52a" width="334" height="670" />
<img src="https://github.com/Kennygunderman/state-of-health-tracker/assets/16354865/207fff9c-bb63-4b08-9a16-c6a1cdca1768" width="334" height="670" />
<img src="https://github.com/Kennygunderman/state-of-health-tracker/assets/16354865/b2e8c3bb-cbf7-45f4-afee-e4bf407366ae" width="334" height="670" />
