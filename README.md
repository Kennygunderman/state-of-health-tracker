![State of Health_LOGO](https://github.com/Kennygunderman/state-of-health-tracker/assets/16354865/b6d58f3a-973d-44e0-8ccb-216e3d358eeb)


# State of Health Tracking App

Any fitness goal is closely tied to the food you consume, so why should you have separate apps for tracking your progress in the gym and in the kitchen? The State of Health Tracking app offers an all-encompassing solution for tracking macros and workouts.

At State of Health, we strive to simplify fitness. Our app is devoid of unnecessary features and exceptionally user-friendly. It includes progressive overload tracking to ensure you add more reps or weight with each workout. Moreover, our app is seamlessly integrated with the USDA food database, enabling you to easily search for nearly any food item with a label available within the United States.

Our tracking app is loaded with comprehensive graphs, and charts to make sure you are on track every day to hit your goals. Each day you log a workout or meal, a diary entry will automatically be created for you to keep track of your progress.

# Screenshots
<img src="https://github.com/Kennygunderman/state-of-health-tracker/assets/16354865/f2161f8a-6dd3-4849-ae81-9ea96cc0d173" width="334" height="670" />
<img src="https://github.com/Kennygunderman/state-of-health-tracker/assets/16354865/29f0bbcf-7a20-425e-974e-dd7aed3ca68e" width="334" height="670" />
<img src="https://github.com/Kennygunderman/state-of-health-tracker/assets/16354865/332054b4-c71b-4e67-8ecc-f7720925154c" width="334" height="670" />
<img src="https://github.com/Kennygunderman/state-of-health-tracker/assets/16354865/84ec42d5-172a-40c6-99d9-aeb206aaf52a" width="334" height="670" />
<img src="https://github.com/Kennygunderman/state-of-health-tracker/assets/16354865/207fff9c-bb63-4b08-9a16-c6a1cdca1768" width="334" height="670" />
<img src="https://github.com/Kennygunderman/state-of-health-tracker/assets/16354865/b2e8c3bb-cbf7-45f4-afee-e4bf407366ae" width="334" height="670" />


# Setup

### Firebase
Info-plist
generate oauth token and add to plist

### Config
rename config.ts.dist -> config.ts

Generate API Key for USDA API here: https://fdc.nal.usda.gov/api-key-signup.html
Update 

`export const USDA_FOOD_API_KEY = 'USDA_API_KEY';`


### Dev Builds

Requires EAS - run script in package.json
