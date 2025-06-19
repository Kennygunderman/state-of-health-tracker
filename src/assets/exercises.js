// I should turn this into a proper assest .json file, but too lazy right now
const exercises = [
    {
        name: 'Hip Abduction Machine',
        type: 'Machine',
        muscleGroup: 'Legs'
    },
    {
        name: 'Cable Hip Abduction',
        type: 'Cable',
        muscleGroup: 'Legs'
    },
    {
        name: 'Lying Floor Leg Raise',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Cable Crunch',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Weighted Crunch',
        type: 'Weighted',
        muscleGroup: 'Core'
    },
    {
        name: 'Hanging Leg Raise',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Plank',
        type: 'Bodyweight',
        muscleGroup: 'Core'
    },
    {
        name: 'Side Plank',
        type: 'Bodyweight',
        muscleGroup: 'Core'
    },
    {
        name: 'Ab Crunch',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Dumbbell Side Bends',
        type: 'Dumbbell',
        muscleGroup: 'Core'
    },
    {
        name: 'Sit Up',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Abdominal Barbell Rollouts',
        type: 'Barbell',
        muscleGroup: 'Core'
    },
    {
        name: 'Decline Sit Up',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Abdominal Air Bike (AKA Bicycle)',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Exercise Ball Crunch',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Twisting Hanging Knee Raise',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Rotating Mountain Climber',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Floor Crunch (legs on bench)',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Seated Barbell Twist',
        type: 'Barbell',
        muscleGroup: 'Core'
    },
    {
        name: 'Hanging Knee Raise',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Standing Stomach Vacuum',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Russian Twist',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Lying Floor Knee Tuck',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Alternate Straight Leg Lower',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Plank to Hip Raise',
        type: 'Bodyweight',
        muscleGroup: 'Core'
    },
    {
        name: 'Pallof Press',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Dead Bug',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Chair Leg Raise',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Abominal Hip Thrust',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Straight Leg Toe Touch (Floor Toe Reach)',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Kettlebell Dead Bug',
        type: 'Kettlebell',
        muscleGroup: 'Core'
    },
    {
        name: 'Seated Leg Tucks',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Twisting Bench Crunch',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Turkish Get Up',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Lying Leg Raise With Hip Thrust',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Decline Weighted Twist',
        type: 'Weighted',
        muscleGroup: 'Core'
    },
    {
        name: 'Hollow Body Hold',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Lying Bench Leg Raise',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Medicine Ball Dead Bug',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Decline Abdominal Reach',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Twisting Floor Crunch',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Plank With Feet On Bench',
        type: 'Bodyweight',
        muscleGroup: 'Core'
    },
    {
        name: 'Decline Bench Leg Raise',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Twisting Decline Dumbbell Situps',
        type: 'Dumbbell',
        muscleGroup: 'Core'
    },
    {
        name: 'Dragon Flag',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Bench Jack Knife',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Frog Sit Up',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Standing Oblique Cable Crunch',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Half Kneeling Pallof Press',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Lying Alternate Floor Leg Raise',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Shoulder Taps',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Kneeling Dumbbell Hold to Stand',
        type: 'Dumbbell',
        muscleGroup: 'Core'
    },
    {
        name: '3 Month Position Kettlebell Pullover',
        type: 'Kettlebell',
        muscleGroup: 'Core'
    },
    {
        name: 'Pallof Press with Rotation',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Standing Barbell Twist',
        type: 'Barbell',
        muscleGroup: 'Core'
    },
    {
        name: 'Reverse Crunch to Dead Bug',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Weighted Chair Knee Raise',
        type: 'Weighted',
        muscleGroup: 'Core'
    },
    {
        name: 'Stir the Pot on Exercise Ball',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Turkish Get Up to Knee',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Abdominal Pendulum',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Banded Alphabet',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Standing Push-Pull',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Half Kneeling Push-Pull',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Reach And Catch',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Lying Cable Knee Raise',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Kettlebell Windmill',
        type: 'Kettlebell',
        muscleGroup: 'Core'
    },
    {
        name: 'Twisting Cable Crunch',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Upper Body Band Resistance Dead Bug',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Roman Chair Twisting Knee Raise',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Glute Bridge Pallof Press',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Seated Cable Crunch',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Standing Cable Crunch',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Roman Chair Knee Raise',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Decline Leg Raise With Hip Thrust',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Barbell Side Bends',
        type: 'Barbell',
        muscleGroup: 'Core'
    },
    {
        name: 'Lying Alternate Knee Raise',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Side Crunch With Leg Lift',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Wall Press Straight Leg Extension',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Decline Bench Cable Crunch',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Dead Bug with Plates',
        type: 'Weighted',
        muscleGroup: 'Core'
    },
    {
        name: 'Exercise Ball Hip Roll',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Medicine Ball Rollouts',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Bottoms Up Kettlebell Turkish Get Up',
        type: 'Kettlebell',
        muscleGroup: 'Core'
    },
    {
        name: 'Contralateral Bird Dog',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Decline Bench Alternate Leg Raise',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Bottoms Up Kettlebell Turkish Get Up to Hand',
        type: 'Kettlebell',
        muscleGroup: 'Core'
    },
    {
        name: 'Ipsilateral Bird Dog',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Straight Leg Dead Bug',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Weighted Exercise Ball Sit Up',
        type: 'Weighted',
        muscleGroup: 'Core'
    },
    {
        name: 'Weighted Hanging Knee Raise',
        type: 'Weighted',
        muscleGroup: 'Core'
    },
    {
        name: 'Half Kneeling Adductor Pallof Press',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Bottoms Up Kettlebell Turkish Get Up to Knee',
        type: 'Kettlebell',
        muscleGroup: 'Core'
    },
    {
        name: 'Bird Dog with Band RNT',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Turkish Get Up to Hand',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Lower Abdominal Hip Roll',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Twisting Lying Cable Crunch',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Barbell Climbs',
        type: 'Barbell',
        muscleGroup: 'Core'
    },
    {
        name: 'Lying Alternate Heel Touches',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Split Stance Pallof Press',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Valslide Body Saw',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Wall Press 90/90 Extension',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Weighted Side Touches',
        type: 'Weighted',
        muscleGroup: 'Core'
    },
    {
        name: 'Lying Pallof Press',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Alternate Reach And Catch',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Wall Press Heel Tap',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Lying Knee Tuck to Heel Raise',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Lying Cable Crunch',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Floor Barbell Twist',
        type: 'Barbell',
        muscleGroup: 'Core'
    },
    {
        name: 'Wall Press Straight Leg Extension',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Decline Bench Cable Crunch',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Dead Bug with Plates',
        type: 'Weighted',
        muscleGroup: 'Core'
    },
    {
        name: 'Medicine Ball Rollouts',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Exercise Ball Hip Roll',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Twisting Decline Sit Up',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Seated Dumbbell Side Bends',
        type: 'Dumbbell',
        muscleGroup: 'Core'
    },
    {
        name: 'Decline Cable Knee Raise',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Exercise Ball Dead Bug',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Decline Bench Alternate Knee Raise',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Exercise Ball Leg Tuck',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Hands Overhead Ab Crunch',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Tall Kneeling Push-Pull',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Lower Body Band Resistance Dead Bug',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Hip Adduction Machine',
        type: 'Machine',
        muscleGroup: 'Legs'
    },
    {
        name: 'Rocking Frog Stretch',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Adductor Foam Rolling',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Deep Squat Prying',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Cable Hip Adduction',
        type: 'Cable',
        muscleGroup: 'Legs'
    },
    {
        name: 'Alternating Lateral Lunge with Overhead Reach',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Lateral Kneeling Adductor Mobilization',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Standing Dumbbell Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Incline Dumbbell Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Standing Hammer Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Standing Barbell Curl',
        type: 'Barbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Concentration Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Cable Curl',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'EZ Bar Preacher Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Zottman Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Alternating Seated Dumbbell Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Barbell Preacher Curl',
        type: 'Barbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Cross Body Hammer Curl (Pinwheel Curls)',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Alternating Standing Dumbbell Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'EZ Bar Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Cable Curl (Rope Extension)',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Machine Bicep Curl',
        type: 'Machine',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Spider Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Standing Dumbbell Reverse Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Seated Dumbbell Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Standing High Pulley Cable Curl',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'One-Arm Seated Dumbbell Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Dumbbell Hammer Preacher Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Alternating Standing Hammer Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Cable Preacher Curl',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'One-Arm Cable Curl',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Seated Hammer Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Dumbbell Preacher Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'One-Arm Standing Hammer Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'One-Arm Dumbbell Preacher Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Barbell Drag Curl',
        type: 'Barbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Seated Zottman Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Smith Machine Bicep Curl',
        type: 'Barbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Seated Barbell Curl',
        type: 'Barbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Wide Grip Standing Barbell Curl',
        type: 'Barbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Lateral Pulldown Bicep Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Standing Dumbbell Drag Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Alternating Incline Dumbbell Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Lying Cable Curl (On Floor)',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Cable Drag Curl',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Wide Grip Cable Curl',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Close Grip Cable Curl',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Close Grip Cable Curl',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Squatting Cable Curl',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Prone Incline Dumbbell Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Barbell hammer Curl',
        type: 'Barbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Incline Bench Dumbbell Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Wide Grip EZ Bar Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Incline Bench Hammer Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Cable Preacher Curl (Rope Extension)',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'One-Arm Standing Dumbbell Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Incline Hammer Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Lying High Pulley Cable Curl',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Seated Dumbbell Reverse Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Barbell Concentration Curl',
        type: 'Barbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Seated Cable Curl',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Cable Concentration Curl',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Close Grip EZ Bar Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'One-Arm Seated Hammer Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'One-Arm Dumbbell Hammer Preacher Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Close Grip Standing Barbell Curl',
        type: 'Barbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Prone Incline Hammer Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'One-Arm Prone Hammer Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Incline Cable Bicep Curl',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Alternating Standing Dumbbell Twisting Curls',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Lying Incline Bench Barbell Curl',
        type: 'Barbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Exercise Ball Preacher Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Alternating Seated Hammer Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Lying High Pulley Close Grip Cable Curl',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Hammer Bar Preacher Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Zottman Preacher Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Alternating Incline Hammer Curl',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Exercise Ball Dumbbell Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Bicep Curl Sled Drag',
        type: 'Other',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Alternating Dumbbell Preacher Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'One-Arm Prone Incline Dumbbell Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Alternating Dumbbell Hammer Preacher Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Two-Arm Low Pulley Cable Curl',
        type: 'Cable',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Lying Wide Dumbbell Curl',
        type: 'Dumbbell',
        muscleGroup: 'Biceps'
    },
    {
        name: 'Seated Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Seated Dumbbell Calf Raise',
        type: 'Dumbbell',
        muscleGroup: 'Calves'
    },
    {
        name: '45 Degree Leg Press Calf Raise',
        type: 'Machine',
        muscleGroup: 'Calves'
    },
    {
        name: 'Bodyweight Standing Calf Raise',
        type: 'Bodyweight',
        muscleGroup: 'Calves'
    },
    {
        name: 'Standing Machine Calf Raise',
        type: 'Machine',
        muscleGroup: 'Calves'
    },
    {
        name: 'Standing One-Leg Calf Raise With Dumbbell',
        type: 'Dumbbell',
        muscleGroup: 'Calves'
    },
    {
        name: 'Standing Barbell Calf Raise',
        type: 'Barbell',
        muscleGroup: 'Calves'
    },
    {
        name: 'One-Leg Seated Dumbbell Calf Raise',
        type: 'Dumbbell',
        muscleGroup: 'Calves'
    },
    {
        name: 'Donkey Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Smith Machine Calf Raise',
        type: 'Barbell',
        muscleGroup: 'Calves'
    },
    {
        name: 'One-Leg Standing Bodyweight Calf Raise',
        type: 'Bodyweight',
        muscleGroup: 'Calves'
    },
    {
        name: 'Banded Tibialis Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Smith Machine Seated Calf Raise',
        type: 'Barbell',
        muscleGroup: 'Calves'
    },
    {
        name: 'Standing Barbell Calf Raise (On Floor)',
        type: 'Barbell',
        muscleGroup: 'Calves'
    },
    {
        name: 'Hack Squat Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Jump Rope',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Side to Side Jump Rope',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'One-Leg Hack Squat Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Toes In Seated Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: '45 Degree Calf Raise (Toes In)',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'One-Leg Floor Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Toes In Standing Machine Calf Raise',
        type: 'Machine',
        muscleGroup: 'Calves'
    },
    {
        name: 'Bodyweight Floor Calf Raise',
        type: 'Bodyweight',
        muscleGroup: 'Calves'
    },
    {
        name: 'Toes Out Standing Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Seated Barbell Calf Raise',
        type: 'Barbell',
        muscleGroup: 'Calves'
    },
    {
        name: 'Cable Calf Raise',
        type: 'Cable',
        muscleGroup: 'Calves'
    },
    {
        name: 'Anterior Calf Tiger Tail',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Front to Back Jump Rope',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Rocking Gastrocnemius Emphasis Ankle Mobilization',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: '45 Degree Calf Raise (Toes Out)',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'One-Leg Donkey Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Reverse Jump Rope',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Rocking Soleus Emphasis Ankle Mobilization',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Toes Out Seated Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Exercise Ball On-The-Wall Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Toes Out Smith Machine Calf Raise',
        type: 'Barbell',
        muscleGroup: 'Calves'
    },
    {
        name: 'Anterior Calf Lacrosse Ball',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'One-Leg Seated Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Skipping Jump Rope',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Posterior Calf Lacrosse Ball',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Smith Machine Toe Raise',
        type: 'Barbell',
        muscleGroup: 'Calves'
    },
    {
        name: 'Single Leg Side to Side Jump Rope',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Alternating Single Leg Jump Rope',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Smith Machine Seated Toe Raise',
        type: 'Barbell',
        muscleGroup: 'Calves'
    },
    {
        name: '(Posterior) Calves Tiger Tail',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'One-Leg 45 Degree Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'One-Leg Smith Machine Seated Calf Raise',
        type: 'Barbell',
        muscleGroup: 'Calves'
    },
    {
        name: 'Peroneal Tiger Tail',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: '45 Degree Toe Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Double Jump Jump Rope',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Rocking Standing Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Anterior Calf Tiger Tail',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Front to Back Jump Rope',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: '45 Degree Calf Raise (Toes Out)',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Rocking Gastrocnemius Emphasis Ankle Mobilization',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'One-Leg Donkey Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Reverse Jump Rope',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Rocking Soleus Emphasis Ankle Mobilization',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Exercise Ball On-The-Wall Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Toes Out Seated Calf Raise',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Toes Out Smith Machine Calf Raise',
        type: 'Barbell',
        muscleGroup: 'Calves'
    },
    {
        name: 'Anterior Calf Lacrosse Ball',
        type: 'Other',
        muscleGroup: 'Calves'
    },
    {
        name: 'Dumbbell Bench Press',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Dumbbell Pullover',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Incline Dumbbell Bench Press',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Dumbbell Flys',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Incline Bench Press',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Barbell Bench Press',
        type: 'Barbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Pec Dec',
        type: 'Machine',
        muscleGroup: 'Chest'
    },
    {
        name: 'Standing Cable Fly',
        type: 'Cable',
        muscleGroup: 'Chest'
    },
    {
        name: 'Hammer Strength Bench Press',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Chest Dip',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Incline Dumbbell Flys',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Cable Iron Cross',
        type: 'Cable',
        muscleGroup: 'Chest'
    },
    {
        name: 'Close Grip Dumbbell Press (AKA Crush Press)',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Cable Crossovers (Upper Chest)',
        type: 'Cable',
        muscleGroup: 'Chest'
    },
    {
        name: 'Decline Bench Press',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Hammer Strength Machine Incline Bench Press',
        type: 'Machine',
        muscleGroup: 'Chest'
    },
    {
        name: 'Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Reverse Grip Dumbbell Bench Press',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Standing Low to High Cable Fly',
        type: 'Cable',
        muscleGroup: 'Chest'
    },
    {
        name: 'Decline Dumbbell Bench Press',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Smith Machine Incline Bench Press',
        type: 'Barbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Weighted Chest Dip',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Standing High to Low Cable Fly',
        type: 'Cable',
        muscleGroup: 'Chest'
    },
    {
        name: 'Decline Push Up (Feet on Bench)',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Cable Chest Press',
        type: 'Cable',
        muscleGroup: 'Chest'
    },
    {
        name: 'Plyometric Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Decline Dumbbell Flys',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Smith Machine Bench Press',
        type: 'Barbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Barbell Pullover',
        type: 'Barbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'One Arm Kettlebell Bench Press',
        type: 'Kettlebell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Neutral Grip Dumbbell Bench Press',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'One Arm Dumbbell Fly',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Stretch Push Up (On Risers)',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Dumbbell Twist Press',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Flat Bench Cable Flys',
        type: 'Cable',
        muscleGroup: 'Chest'
    },
    {
        name: 'Reverse Grip Dumbbell Squeeze Press',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Wide Grip Incline Bench Press',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Decline Smith Machine Bench Press',
        type: 'Barbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Neutral Grip Incline Dumbbell Bench Press',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Fingertip Push Ups',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Push Up with Mountain Climber',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Incline Cable Flys',
        type: 'Cable',
        muscleGroup: 'Chest'
    },
    {
        name: 'Incline Cable Chest Press',
        type: 'Cable',
        muscleGroup: 'Chest'
    },
    {
        name: 'Dumbbell Twist Fly',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Eccentric Only Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Lying Cable Pullover',
        type: 'Cable',
        muscleGroup: 'Chest'
    },
    {
        name: 'Straight Bar Dip',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'One-Arm Dumbbell Bench Press',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Incline Push Ups',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Wide Grip Push Ups',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Incline Dumbbell Twist Fly',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Push-Up (On Bench)',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: '1 Leg Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Kettlebell Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Feet on Wall Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Wide Grip Barbell Bench Press',
        type: 'Barbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Cross Body Arm Swings',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Paused Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Reverse Grip Bench Press',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Self-Assisted Straight Bar Dip',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Band Suspended Kettlebell Bench Press',
        type: 'Kettlebell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Alternate Dumbbell Bench Press (high start)',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Wide Grip Decline Bench Press',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Decline Cable Flys',
        type: 'Cable',
        muscleGroup: 'Chest'
    },
    {
        name: '2 Board Bench Press',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Yoga Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Resistance Banded Dumbbell Bench Press',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Exercise Ball Dumbbell Bench Press',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Bosu Ball Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Floor Press',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Lying Cable Pullover (Rope Extension)',
        type: 'Cable',
        muscleGroup: 'Chest'
    },
    {
        name: 'Wall Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Tall Kneeling Medicine Ball Chest Pass',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Neutral Grip Decline Dumbbell Bench Press',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'T-Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Push Up Jacks',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Muscle Up',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Push Up to Side Plank',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Alternating Dumbbell Bench Press (Low Start)',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Spiderman Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Bosu Ball Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Knuckle Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Rack Pec Stretch',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Shoulder Tap Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Push Up with Knee Drive',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Bench Press Against Chains',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Paused Barbell Bench Press',
        type: 'Barbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'One Arm Bottoms Up Kettlebell Bench Press',
        type: 'Kettlebell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Cable Inner Chest Press',
        type: 'Cable',
        muscleGroup: 'Chest'
    },
    {
        name: 'Wide Reverse Grip Bench Press',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Standing PVC Pec Mobilization',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Chain Fly',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Bird Dog Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Lying Medicine Ball Power Drop',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Push Up Plus',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Plyometric Clapping Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: '1 Board Bench Press',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Dumbbell Bench Press Rotational Grip',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Barbell Pullover And Press',
        type: 'Barbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Decline Dumbbell Twist Fly',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'T-Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Decline Cable Chest Press',
        type: 'Cable',
        muscleGroup: 'Chest'
    },
    {
        name: 'Alternating Dumbbell Fly',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: '3 Board Bench Press',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Exercise Ball Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Half Kneeling Medicine Ball Chest Pass',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Push Up (Feet on Swiss Ball)',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Pec Lacrosse Ball',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Ring Fly',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Half Kneeling PVC Pec Mobilization',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Lateral Hand Walk Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Alternating Dumbbell Bench Press on Exercise Ball',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Ring Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Guillotine Press',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Exercise Ball Dumbbell Fly',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Alternating Incline Dumbbell Fly',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Eccentric Only Incline Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Single Leg Medicine Ball Chest Pass Wall Tap',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Valslide Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Alternating Decline Dumbbell Fly',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Exercise Ball Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Alternating Dumbbell Fly',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: '3 Board Bench Press',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Push Up (Feet on Swiss Ball)',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Half Kneeling Medicine Ball Chest Pass',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Pec Lacrosse Ball',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Ring Fly',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Lateral Hand Walk Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Half Kneeling PVC Pec Mobilization',
        type: 'Other',
        muscleGroup: 'Chest'
    },
    {
        name: 'Alternating Dumbbell Bench Press on Exercise Ball',
        type: 'Dumbbell',
        muscleGroup: 'Chest'
    },
    {
        name: 'Ring Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Chest'
    },
    {
        name: 'Seated Barbell Wrist Curl',
        type: 'Barbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Reverse Grip Barbell Curl',
        type: 'Barbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Behind-The-Back Barbell Wrist Curl',
        type: 'Barbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Reverse Grip Cable Curl',
        type: 'Cable',
        muscleGroup: 'Arms'
    },
    {
        name: 'Dumbbell Farmers Carry',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'One-Arm Seated Dumbbell Wrist Curl',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Reverse Grip Barbell Curl (EZ Bar)',
        type: 'Barbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Reverse Dumbbell Wrist Curl Over Bench',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Reverse Grip Barbell Wrist Curl (Over Bench)',
        type: 'Barbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Weight Plate Pinches',
        type: 'Weighted',
        muscleGroup: 'Arms'
    },
    {
        name: 'Plate Pinch Carry',
        type: 'Weighted',
        muscleGroup: 'Arms'
    },
    {
        name: 'Wrist Rollers',
        type: 'Other',
        muscleGroup: 'Arms'
    },
    {
        name: 'Dumbbell Wrist Curl (Over Bench)',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Barbell Wrist Curl (Over Bench)',
        type: 'Barbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Seated Reverse Dumbbell Wrist Curl',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Alternating Dumbbell Reverse Grip Curl',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Reverse Grip Concentration Curl',
        type: 'Other',
        muscleGroup: 'Arms'
    },
    {
        name: 'Neutral Grip Dumbbell Wrist Curl (Over Bench)',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Dumbbell Overhead Carry',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Kettlebell Goblet Carry',
        type: 'Kettlebell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Kettlebell Single Arm Bottoms Up Carry',
        type: 'Kettlebell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Seated Reverse Barbell Wrist Curl',
        type: 'Barbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Seated Neutral Grip Dumbbell Wrist Curl',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Standing Reverse Grip Cable Curl',
        type: 'Cable',
        muscleGroup: 'Arms'
    },
    {
        name: 'Forearm Tiger Tail',
        type: 'Other',
        muscleGroup: 'Arms'
    },
    {
        name: 'Forearm Extensors Lacrosse Ball',
        type: 'Other',
        muscleGroup: 'Arms'
    },
    {
        name: 'One-Arm Dumbbell Wrist Curl (Over Bench)',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Smith Machine Seated Wrist Curl',
        type: 'Barbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Standing Smith Machine Wrist Curl (behind back)',
        type: 'Barbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'One-Arm Dumbbell Reverse Grip Curl',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Overhead Barbell Carry',
        type: 'Barbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Seated Reverse Grip Cable Wrist Curl',
        type: 'Cable',
        muscleGroup: 'Arms'
    },
    {
        name: 'Seated Dumbbell Wrist Curl',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Trap Bar Farmers Carry',
        type: 'Barbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Reverse Grip Preacher Curl (EZ Bar)',
        type: 'Other',
        muscleGroup: 'Arms'
    },
    {
        name: 'Barbell Suitcase Carry',
        type: 'Barbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'One-Arm Seated Reverse Grip Dumbbell Wrist Curl',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Trap Bar Overhead Carry',
        type: 'Barbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Fat Gripz Dumbbell Farmers Carry',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'One-Arm Seated Neutral Grip Dumbbell Wrist Curl',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Forearm Flexors Lacrosse Ball',
        type: 'Other',
        muscleGroup: 'Arms'
    },
    {
        name: 'One-Arm Neutral Grip Dumbbell Wrist Curl (Over Bench)',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'One Arm Reverse Dumbbell Wrist Curl Over Bench',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Reverse Grip Dumbbell Preacher Curl',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Kettlebell Racked Crossover Walk',
        type: 'Kettlebell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Reverse One Arm Cable Curl',
        type: 'Cable',
        muscleGroup: 'Arms'
    },
    {
        name: 'One-Arm Reverse Grip Dumbbell Preacher Curl',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Behind-The-Back Cable Wrist Curl',
        type: 'Cable',
        muscleGroup: 'Arms'
    },
    {
        name: 'Reverse Grip Cable Preacher Curl',
        type: 'Cable',
        muscleGroup: 'Arms'
    },
    {
        name: 'Kettlebell Single Arm Racked Carry',
        type: 'Kettlebell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Seated Cable Wrist Curl',
        type: 'Cable',
        muscleGroup: 'Arms'
    },
    {
        name: 'Overhead Barbell Carry',
        type: 'Barbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Seated Reverse Grip Cable Wrist Curl',
        type: 'Cable',
        muscleGroup: 'Arms'
    },
    {
        name: 'Seated Dumbbell Wrist Curl',
        type: 'Dumbbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Trap Bar Farmers Carry',
        type: 'Barbell',
        muscleGroup: 'Arms'
    },
    {
        name: 'Hyperextension',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Barbell Hip Thrust',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Good Mornings',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Standing Glute Kickback',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Glute Kick Back',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Bodyweight Glute Bridge',
        type: 'Bodyweight',
        muscleGroup: 'Legs'
    },
    {
        name: 'Reverse Hyperextension',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Wide Smith Machine Squat',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Single Leg Glute Bridge',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Side Lying Clam',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Hip Thruster with Mini Band',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Weighted Hyperextension',
        type: 'Weighted',
        muscleGroup: 'Legs'
    },
    {
        name: 'Barbell Glute Bridge',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Banded Good Morning',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Bodyweight Hip Thrust',
        type: 'Bodyweight',
        muscleGroup: 'Legs'
    },
    {
        name: 'Good Mornings Off Pins',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Curtsy Lunge (AKA Drop Lunge)',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Lateral Band Walk',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Banded Glute Bridge',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'X-Band Walk',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Single Leg Hip Thrust with Dumbbell',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Diagonal Band Walk',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Single Leg Good Morning',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Side Lying Clam with Band',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Glute Lacrosse Ball',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Hip Extensions',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: '90/90 Piriformis Stretch',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Glute Foam Rolling',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Figure 4 Glute Stretch',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'GHD Back Extension Iso Hold',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Supine Hip Internal Rotation',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Seated Good Mornings',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Marching Glute Bridge',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dynamic Pigeon',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'GHD Back Extension',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Single Leg Hip Thrust',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Seated External Rotation',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Sled Pull Through',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Knee to Chest Single Leg Glute Bridge',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Banded Multi Directional Toe Touch',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Sled Pull Through',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Knee to Chest Single Leg Glute Bridge',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Banded Multi Directional Toe Touch',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Stiff Leg Deadlift',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Conventional Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Stiff Leg Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Leg Curl',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Romanian Deadlift (AKA RDL)',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Hamstring Curl',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Trap Bar Rack Pull',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Trap Bar Deadlift',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Seated Leg Curl',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Bodyweight Single Leg Deadlift',
        type: 'Bodyweight',
        muscleGroup: 'Legs'
    },
    {
        name: 'Landmine RDL',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Standing Cable Hamstring Curl',
        type: 'Cable',
        muscleGroup: 'Legs'
    },
    {
        name: 'Kettlebell Swing',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Sumo Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Reverse Hack Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Band Assisted Nordic Hamstring Curl',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Exercise Ball Leg Curl (SHELC)',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Single Leg One Dumbbell Deadlift',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: '1 Kettlebell Single Leg Deadlift',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Glute Ham Raise (GHR)',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Kettlebell Romanian Deadlift',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Partner Assisted Nordic Hamstring Curls',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'One Arm Kettlebell Swing',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Nordic Hamstring Curl (Bodyweight)',
        type: 'Bodyweight',
        muscleGroup: 'Legs'
    },
    {
        name: 'Double Kettlebell Suitcase Deadlift',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Single Leg Curl',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Kettlebell Sumo Deadlift (1 KB)',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Plate Resisted Glute Ham Raise',
        type: 'Weighted',
        muscleGroup: 'Legs'
    },
    {
        name: 'Razor Curl',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Valslide Leg Curl',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Straight Leg Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Inchworm',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'One-Leg Lying Cable Hamstring Curl',
        type: 'Cable',
        muscleGroup: 'Legs'
    },
    {
        name: 'Smith Machine Stiff Leg Deadlift',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Trap Bar Deficit Deadlift',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Deficit Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Banded Glute Ham Raise',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Trap Bar Romanian Deadlift',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Double Kettlebell Swing',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Barbell Sumo Romanian Deadlift',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Double Kettlebell Single Leg Deadlift',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Deficit Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Single Leg Exercise Ball Leg Curl',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Kickstand Kettle Bell 1 Leg Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Reverse Band Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Banded Trap Bar Deadlift',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Sumo Deficit Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Lying Cable Hamstring Curl',
        type: 'Cable',
        muscleGroup: 'Legs'
    },
    {
        name: 'Single Leg Barbell Romanian Deadlift',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Hamstring Foam Rolling',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: '2 to 1 Exercise Ball Hamstring Curl (SHELC)',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Hamstring Tiger Tail',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Conventional Deadlift Against Chains',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Paused Trap Bar Deadlift',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Barbell Split Jump',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Paused Sumo Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Snatch Grip Romanian Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Jefferson Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Single Leg Snatch Grip Romanian Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Reverse Band Sumo Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Stiff Leg Deadlift (On Bench)',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Single Leg Landmine Romanian Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Single Leg Valslide Leg Curl',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Snatch Grip Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Banded Conventional Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Snatch Grip Block Pull Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Trap Bar Deadlift Against Chains',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Snatch Grip Deficit Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Banded Sumo Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Sumo Block Pull Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: '1 Kettlebell Suitcase Deadlift',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'American Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Conventional Block Pull Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Reeves Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Fat Bar Deadlift',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Cradle Walk to Forward Lunge',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Cradle Walk',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Kneeling Posterior Hip Capsule Mobilization',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Fire Hydrant Circles',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Standing Hip Flexion w/ Bands',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Hip Flexor Foam Rolling',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Lying Psoas March',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Hip Flexor Lacrosse Ball',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'IT Band Foam Rolling',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Lat Pull Down',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Close Grip Lat Pull Down',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Straight Arm Lat Pull Down',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Wide Grip Pull Up',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Chin Up',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Reverse Grip Lat Pull Down (Underhand)',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Pull Up',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Wide Grip Lat Pull Down',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Shotgun Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'V-Bar Pull Down',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Weighted Pull Up',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'V-Bar Pull Up',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Eccentric Only Pull Up',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Rope Straight Arm Pull Down',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Resistance Band Assisted Pull Up (From Foot)',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Band Assisted Chin Up (From Foot)',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Weighted Chin Up',
        type: 'Weighted',
        muscleGroup: 'Back'
    },
    {
        name: 'Rack Lat Stretch',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Close Grip Pull Up',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Behind Neck Lat Pull Down',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Underhand Close Grip Lateral Pulldown',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Resistance Band Assisted Pull Up (From Knee)',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Lateral Pulldown (Rope Extension)',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Chin Up With Leg Raise',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Gironda Sternum Chin Up',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Lat Foam Rolling',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Standing Overhead Medicine Ball Slam',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Close Grip Chin Up',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Pull Up with Leg Raise',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Arms Only Rope Climb',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Mixed Grip Chin Up',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Standing Overhead Medicine Ball Throw',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Wide Grip Chin Up',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Grip Ball Pull Ups',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Band Assisted Chin Up (From Knee)',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'L-Sit Pull Up',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Single Leg Overhead Medicine Ball Tap',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Archer Pull Up',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Thibaudeau Kayak Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Overhand Close Grip Lateral Pulldown',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Weighted Chin Up Hang',
        type: 'Weighted',
        muscleGroup: 'Back'
    },
    {
        name: 'Skin the Cat',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Rope Pull Up',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Double Pause Chin Up',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Eccentric Only Chin Up',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Band Resisted Chin Up',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Double Pause Pull Up',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'One Arm Chin Up',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Single Pause Pull Up',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Overhead Medicine Ball Figure 8 Slam',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Around the Bar Chin Ups',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Rope Climb',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'L-Sit Chin Up',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Overhand Close Grip Lateral Pulldown',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Single Pause Chin Up',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Triple Pause Chin Up',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Dumbbell Deadlift',
        type: 'Dumbbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Superman',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Smith Machine Deadlift',
        type: 'Barbell',
        muscleGroup: 'Back'
    },
    {
        name: '90/90 Hip Crossover',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Rollover Into V-Sits',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'One Arm Dumbbell Row',
        type: 'Dumbbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Bent Over Dumbbell Row',
        type: 'Dumbbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Bent Over Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Seated Cable Row',
        type: 'Cable',
        muscleGroup: 'Back'
    },
    {
        name: 'Machine Row',
        type: 'Machine',
        muscleGroup: 'Back'
    },
    {
        name: 'T-Bar Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Neutral Grip Chest Supported Dumbbell Row',
        type: 'Dumbbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Incline Bench Two Arm Dumbbell Row',
        type: 'Dumbbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Tripod Dumbbell Row',
        type: 'Dumbbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Feet Elevated Inverted Row',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Reverse Grip Bent-Over Dumbbell Row',
        type: 'Dumbbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Machine T-Bar Row',
        type: 'Machine',
        muscleGroup: 'Back'
    },
    {
        name: 'Smith Machine Bent-Over Row',
        type: 'Barbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Reverse Grip Bent Over Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Inverted Row',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Bent Over Kettlebell Row',
        type: 'Kettlebell',
        muscleGroup: 'Back'
    },
    {
        name: 'Seated Row (Rope Extension)',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Pendlay Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Chest Supported Dumbbell Row with Isohold',
        type: 'Dumbbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Meadows Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'One-Arm Seated Cable Row',
        type: 'Cable',
        muscleGroup: 'Back'
    },
    {
        name: 'Renegade Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'One Arm Machine Row',
        type: 'Machine',
        muscleGroup: 'Back'
    },
    {
        name: 'Trap Bar Row',
        type: 'Barbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Thoracic Extension on Foam Roller',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Reverse Grip Bent-Over Row (EZ Bar)',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Concept 2 Rowing Machine',
        type: 'Machine',
        muscleGroup: 'Back'
    },
    {
        name: 'Incline Bench Cable Row (Rope Extension)',
        type: 'Cable',
        muscleGroup: 'Back'
    },
    {
        name: "World's Greatest Stretch",
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Quadruped Extension Rotation',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Reverse Grip Incline Bench Two-Arm Dumbbell Row',
        type: 'Dumbbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Cable Palm Rotational Row',
        type: 'Cable',
        muscleGroup: 'Back'
    },
    {
        name: 'Reverse Grip Incline Bench Barbell Row',
        type: 'Barbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Palms In Bent-Over Dumbbell Row',
        type: 'Dumbbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Seated High Cable Row',
        type: 'Cable',
        muscleGroup: 'Back'
    },
    {
        name: 'Reverse Grip Smith Machine Bent-Over Row',
        type: 'Barbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Smith Machine One-Arm Row',
        type: 'Barbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Batwing Reverse Sled Drag',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'One-Arm Bent-Over Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Deadstop Rack Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Palm Rotational Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Dante Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Ring Inverted Row with Chains',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Rock Back Extension Rotation',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Incline Bench Barbell Row',
        type: 'Barbell',
        muscleGroup: 'Back'
    },
    {
        name: 'Double Arm Sled Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Yoga Plex',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'One-Arm Bent-Over Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Inverted Rope Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Incline Bench Cable Row',
        type: 'Cable',
        muscleGroup: 'Back'
    },
    {
        name: 'Reverse Lunge Sled Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Rope Crossover Seated Row',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Weighted Inverted Row',
        type: 'Bodyweight',
        muscleGroup: 'Back'
    },
    {
        name: 'Field Goal Angel Foam Rolling',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Bench T-Spine Mobilization',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Reverse Grip Machine T-Bar Row',
        type: 'Machine',
        muscleGroup: 'Back'
    },
    {
        name: 'Banded Machine T-Bar Row',
        type: 'Machine',
        muscleGroup: 'Back'
    },
    {
        name: 'High Pull Sled Drag',
        type: 'Other',
        muscleGroup: 'Back'
    },
    {
        name: 'Reverse Grip Incline Bench Cable Row',
        type: 'Cable',
        muscleGroup: 'Back'
    },
    {
        name: 'Neck Tiger Tail',
        type: 'Other',
        muscleGroup: 'Other'
    },
    {
        name: 'Side Crunch (AKA Oblique Crunch)',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Landmine Rotation',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Wood Chop',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Side Plank with Hip Dip',
        type: 'Bodyweight',
        muscleGroup: 'Core'
    },
    {
        name: 'Half Kneeling Cable Lift',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Split Stance Cable Chop',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Low Cable Wood Chop',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Split Stance Cable Lift',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Tall Kneeling Cable Lift',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Tall Kneeling Cable Chop',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Off Bench Oblique Hold',
        type: 'Other',
        muscleGroup: 'Core'
    },
    {
        name: 'Half Kneeling Cable Chop',
        type: 'Cable',
        muscleGroup: 'Core'
    },
    {
        name: 'Palmar Fascia Lacrosse Ball',
        type: 'Other',
        muscleGroup: 'Other'
    },
    {
        name: 'Plantar Fascia Lacrosse Ball',
        type: 'Other',
        muscleGroup: 'Other'
    },
    {
        name: 'Barbell Back Squat',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Goblet Squat',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Squat',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Leg Press',
        type: 'Machine',
        muscleGroup: 'Legs'
    },
    {
        name: 'Leg Extension',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Lunge',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Rear Lunge',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Step Up',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Frog Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'One Leg Dumbbell Squat (AKA Dumbbell Bulgarian Split Squat)',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Machine Hack Squat',
        type: 'Machine',
        muscleGroup: 'Legs'
    },
    {
        name: 'Plie Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Front Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Walking Lunge',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Split Squat',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Bodyweight Walking Lunge',
        type: 'Bodyweight',
        muscleGroup: 'Legs'
    },
    {
        name: 'Bodyweight Jump Squat',
        type: 'Bodyweight',
        muscleGroup: 'Legs'
    },
    {
        name: 'Prisoner Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Bodyweight Side Lunge',
        type: 'Bodyweight',
        muscleGroup: 'Legs'
    },
    {
        name: 'Smith Machine Squat',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Reverse Bodyweight Lunge',
        type: 'Bodyweight',
        muscleGroup: 'Legs'
    },
    {
        name: 'Barbell Lunge',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Barbell Hack Squat',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Smith Machine Front Squat',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Barbell Reverse Lunge',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Bodyweight Lunge',
        type: 'Bodyweight',
        muscleGroup: 'Legs'
    },
    {
        name: 'Smith Machine Lunge',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Side Lunge',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'One Leg 45 Degree Leg Press',
        type: 'Machine',
        muscleGroup: 'Legs'
    },
    {
        name: 'Sissy Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Prisoner Squat Jump',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Landmine Goblet Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Kettlebell Goblet Squat',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Walking Barbell Lunge',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Single Leg Extension',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Bodyweight Step Up',
        type: 'Bodyweight',
        muscleGroup: 'Legs'
    },
    {
        name: 'Kettlebell Reverse Lunge',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: '1 KB Kettlebell Snatch',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Sumo Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Jumping Squat',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: '1 Dumbbell Step Up',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Jumping Squat',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Deep Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: '1 KB Kettlebell Push Press',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Kettlebell Step Up',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Landmine Reverse Lunge',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Front Foot Elevated Dumbbell Split Squat',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Wall Ball',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Smith Machine Leg Press',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Wide Stance 45 Degree Leg Press',
        type: 'Machine',
        muscleGroup: 'Legs'
    },
    {
        name: '1 KB Kettlebell Clean',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Goblet Box Squat',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Squat To Bench',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: '1 KB Kettlebell Clean & Press',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Contralateral Load Split Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Wide Hack Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Barbell Step Ups',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Narrow Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Narrow Stance High Bar Back Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Pit Shark Belt Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Front Foot Elevated Smith Machine Split Squat',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Split Jump',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Safety Bar Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Single Leg Hop',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Narrow Stance 45 Degree Leg Press',
        type: 'Machine',
        muscleGroup: 'Legs'
    },
    {
        name: '1 Kettlebell Step Up',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Barbell Lateral Lunge',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Zerchers Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Wide Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Kettlebell Walking Lunge',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Muscle Clean',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Seated Vertical Jump',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Contralateral Load Dumbbell Front Lunge',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'One Leg Barbell Squat',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Prone Quad Stretch',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: '1/4 Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Resistance Band Machine Hack Squat',
        type: 'Machine',
        muscleGroup: 'Legs'
    },
    {
        name: 'Box Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Squat to Stand',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Clean & Jerk',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Barbell Jumping Squats',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Depth Jump to Box Jump',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Bottoms Up 1 Kettlebell Split Squat',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Tire Flip',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: '1 Kettlebell Step Up',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Narrow Smith Machine Squat',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Reverse Lunge Elbow to Instep with Rotation',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Barbell Thruster',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Power Jerk',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Split Squat with Banded Adduction',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Box Jump',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Box Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Wide Stance Front Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Kettlebell Lateral Lunge',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Feet Forward Smith Machine Squat',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Squat to Stand w/ T-Spine Rotation',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Weighted Sissy Squat',
        type: 'Weighted',
        muscleGroup: 'Legs'
    },
    {
        name: 'Reverse Sled Drag',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Overhead Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Ipsilateral Load Split Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Split Squat Jump',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Toes Out Leg Extension',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: '1 KB Kettlebell Jerk',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Rack Pin Front Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Wall Squat',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Sled Push',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Valslide Lateral Lunge',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Narrow Stance Machine Hack Squat',
        type: 'Machine',
        muscleGroup: 'Legs'
    },
    {
        name: 'Overhead Step Up',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Split Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Goblet Split Squat',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Offset Single Kettlebell Front Squat',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Split Squat with Iso-Hold',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: '2 KB Kettlebell Snatch',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Double Kettlebell Front Squat',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Smith Machine One Leg Squat',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Reverse Lunge with Twist',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Double Kettlebell Split Squat',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Decline Bench Bodyweight Lunge',
        type: 'Bodyweight',
        muscleGroup: 'Legs'
    },
    {
        name: 'Power Snatch',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Sled Push',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Valslide Lateral Lunge',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Narrow Stance Machine Hack Squat',
        type: 'Machine',
        muscleGroup: 'Legs'
    },
    {
        name: 'Ipsilateral Load Dumbbell Rear Lunge',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Lateral Lunge to Drop Lunge',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Back Squat to Box Against Chains',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Backward Sled Push',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Power Clean',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Thruster',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Snatch Balance',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: '1/2 Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Band Resisted Box Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Smith Machine Zercher Squat',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Power Clean from Blocks',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Hang Clean',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Snatch',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Ipsilateral Load Dumbbell Front Lunge',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Reverse Lunge with Lateral Flexion',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Jerk Balance',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Split Clean',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'One Leg Bodyweight Squat',
        type: 'Bodyweight',
        muscleGroup: 'Legs'
    },
    {
        name: '1 KB Kettlebell Split Snatch',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Bench One Leg Dumbbell Squat',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Split Jerk',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'One Leg Bodyweight Wall Squat',
        type: 'Bodyweight',
        muscleGroup: 'Legs'
    },
    {
        name: '2 KB Kettlebell Split Snatch',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Exercise Ball Wall Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Reverse Lunge Sled Walk',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Narrow Stance Front Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: '2 KB Kettlebell Clean',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Split Snatch',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Cycled Split Squat Jump',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Bodyweight Wall Squat',
        type: 'Bodyweight',
        muscleGroup: 'Legs'
    },
    {
        name: 'Kettlebell Thruster',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Low Bar Back Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Decline Bench Dumbbell Lunge',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Smith Machine Squat To Bench',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Band Resisted Back Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Front Barbell Step Up',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Walking Quad Stretch to Overhead Lunge',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Anderson Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Toes In Leg Extension',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: '2 KB Kettlebell Clean & Press',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Counterbalanced Skater Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Squat To Bench',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Quad Tiger Tail',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Counterbalanced Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: '1 to 2 Box Jump',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Front Squat To Bench',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Depth Jump to Broad Jump',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Belt Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Half Kneeling Quad Stretch',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Decline Bench Barbell Lunge',
        type: 'Barbell',
        muscleGroup: 'Legs'
    },
    {
        name: '2 KB Kettlebell Jerk',
        type: 'Kettlebell',
        muscleGroup: 'Legs'
    },
    {
        name: '2 to 1 Box Jump',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Muscle Snatch',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Valslide Reverse Lunges',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Depth Jump to Hurdle Hop',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Back Squat Against Chains',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Anti-Rotation Forward Sled Walk',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Overhead Banded Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Sled Sprint',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Speed Squats',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Depth Jump',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'High Bar Back Squat',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Lateral Lunge to Drop Lunge',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Back Squat to Box Against Chains',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Ipsilateral Load Dumbbell Rear Lunge',
        type: 'Dumbbell',
        muscleGroup: 'Legs'
    },
    {
        name: 'Backward Sled Push',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Power Clean',
        type: 'Other',
        muscleGroup: 'Legs'
    },
    {
        name: 'Dumbbell Lateral Raise',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Military Press (AKA Overhead Press)',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Bent Over Dumbbell Reverse Fly',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Standing Dumbbell Shoulder Press',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Dumbbell Press',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Arnold Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Dumbbell Lateral Raise',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Smith Machine Shoulder Press',
        type: 'Barbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Barbell Shoulder Press',
        type: 'Barbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Standing Cable Reverse Fly',
        type: 'Cable',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Cable Face Pull',
        type: 'Cable',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Behind the Neck Shoulder Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Bent Over Dumbbell Reverse Fly',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Standing Dumbbell Front Raise',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Machine Shoulder Press',
        type: 'Machine',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Cable Lateral Raise',
        type: 'Cable',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Single Arm Cable Lateral Raise (Crossbody)',
        type: 'Cable',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Machine Reverse Fly',
        type: 'Machine',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Machine Lateral Raise',
        type: 'Machine',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Cable Upright Row',
        type: 'Cable',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Dumbbell Upright Row',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Barbell Front Raise',
        type: 'Barbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Dumbbell Lateral Raise',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Bent Over Low Pulley Rear Delt Fly',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Band Pull Apart',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Smith Machine Upright Row',
        type: 'Barbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Half Kneeling Landmine Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Z Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Standing Arnold Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Bent Over Rear Delt Fly (Head on Bench)',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Weight Plate Front Raise',
        type: 'Weighted',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Lateral Raise Partials',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Kettlebell Halo',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Push Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Neutral Grip Dumbbell Shoulder Press',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Incline Rear Delt Fly',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Banded Lateral Raise',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Cable Face Pull with External Rotation',
        type: 'Cable',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Clean Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Alternate Seated Dumbbell Press',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Alternating Arnold Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Kettlebell Lateral Raise',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Landmine Lateral Raise',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Half Kneeling Kettlebell Press',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Cable Front Raise (Bilateral)',
        type: 'Cable',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Cable External Rotation',
        type: 'Cable',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Dumbbell 6 Ways (Raise)',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Standing Kettlebell Press',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Smith Machine Shoulder Press Behind Neck',
        type: 'Barbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Arm Circles',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Cable Internal Rotation',
        type: 'Cable',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Half Kneeling Bottoms Up Kettlebell Press',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Lying Dumbbell Front Raise On Incline Bench',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One Arm Kettlebell Z Press',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Lying Shoulder Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Cable Front Raise',
        type: 'Cable',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Dumbbell Front Raise',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Single Arm Landmine Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Landmine Thruster',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Banded Shoulder Dislocates',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Alternating Dumbbell Lateral Raise',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Barbell Rear Delt Row To Neck',
        type: 'Barbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Banded Standing Shoulder Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Half Kneeling Banded Face Pull',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Alternating Big Waves Battling Ropes',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Standing One Arm Kettlebell Press',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Dumbbell Front Raise',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Lying Rear Delt Barbell Raise',
        type: 'Barbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Standing Dublin Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Face Pulls on Rings',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Bus Drivers',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Anti-Gravity Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Lying Rear Delt Fly',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Military Press Behind Neck',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Single Arm Landmine Push Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Lying Single Arm Trap Raise',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Kettlebell Press',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Standing Neutral Grip Dumbbell Shoulder Press',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Cable Rear Delt Fly',
        type: 'Cable',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Knee to Elbow Dumbbell External Rotation',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Kettlebell Press',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Cable Rear Delt Fly',
        type: 'Cable',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Knee to Elbow Dumbbell External Rotation',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Rotational Med Ball Shot Put',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Spider Crawls',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Dublin Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Back to Wall Shoulder Flexion',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Kettlebell Arm Bar',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Banded Bent Over Reverse Fly',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Kettlebell Angled Press',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Side Lying Rear Delt Fly',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Alternating Dumbbell Front Raise',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Overhead Front Raise (with Weight Plate)',
        type: 'Weighted',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One Arm Seated Kettlebell Press',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Alternating Standing Arnold Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Shoulder Pin Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Standing One Arm Bottoms Up Kettlebell Press',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Standing Banded Face Pull',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Rotational Medicine Ball Step Behind Shot Put',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Exercise Ball Dumbbell Shoulder Press',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Jumping Jacks Battling Ropes',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Rotational Medicine Ball Throw',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Reverse Lunge with Alternating Waves Battling Ropes',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Bench Supported Dumbbell External Rotation',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Shoulder To Shoulder Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: '2 KB Kettlebell Push Press',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Seated Arnold Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Split Stance Anti-Rotational Medicine Ball Scoop Toss',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Trap Bar Shoulder Press',
        type: 'Barbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Scapular Wall Slide',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Half Kneeling Banded External Rotation',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Standing External Rotation ("No Money Drill")',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Serrano Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Standing Banded Face Pull to Chest',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Alternating Standing Kettlebell Press',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Tall Kneeling One Arm Kettlebell Press',
        type: 'Kettlebell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Double Wave Battling Rope',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Banded Internal Rotation',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Neutral Grip Dumbbell Shoulder Press',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Tall Kneeling Battling Ropes',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Back to Wall Alternating Shoulder Flexion',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Seated Dumbbell Lateral Raise',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Power Slam Battling Rope',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Reverse Flys on Rings',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Alternating Incline Rear Delt Fly',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Lying Cable Front Raise',
        type: 'Cable',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Barbell Overhead Front Raise',
        type: 'Barbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: '3-D Band Pull Apart',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Half Kneeling Battling Rope',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Lunge Jump with Alternating Waves Battling Ropes',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Seated Dumbbell Front Raise',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Pronated 90 Degree Band Pull Apart',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'No Counter Movement Rotational Medicine Ball Throw',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Alternating Standing Dumbbell Press',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Alternating Dumbbell Lateral Raise',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Cuban Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Modified Handstand Push Up (Off Box)',
        type: 'Bodyweight',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Alternating Dumbbell Front Raise',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Supinated 90 Degree Band Pull Apart',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Shuffle Into Rotational Medicine Ball Throw',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Standing Neutral Grip Alternating Dumbbell Shoulder Press',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Alternating Seated Bent Over Rear Delt Fly',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Lying Rear Delt Fly',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Double Arm Circles Battling Ropes',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Incline Dumbbell Front Raise',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Forearm Wall Slide',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Step Behind Rotational Medicine Ball Throw',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Bradford Press (AKA Seated Rocky Press)',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: "Banded Y's",
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Alternating Rear Delt Fly',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Behind The Neck Push Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Half Kneeling Cable External Rotation',
        type: 'Cable',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Standing Arnold Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Alternating Lying Rear Delt Fly',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Quadruped Push Up Plus',
        type: 'Bodyweight',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Exercise Ball Barbell Shoulder Press',
        type: 'Barbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Seated Rear Delt Fly',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Battling Ropes',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Dumbbell Rear Delt Fly',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Alternating Neutral Grip Dumbbell Shoulder Press',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Lying Rear Delt Fly',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Double Arm Circles Battling Ropes',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Incline Dumbbell Front Raise',
        type: 'Dumbbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Forearm Wall Slide',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Step Behind Rotational Medicine Ball Throw',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Bradford Press (AKA Seated Rocky Press)',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Alternating Rear Delt Fly',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Behind The Neck Push Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: "Banded Y's",
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Alternating Lying Rear Delt Fly',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Half Kneeling Cable External Rotation',
        type: 'Cable',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Standing Arnold Press',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Quadruped Push Up Plus',
        type: 'Bodyweight',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Exercise Ball Barbell Shoulder Press',
        type: 'Barbell',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'One-Arm Seated Rear Delt Fly',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Seated Battling Ropes',
        type: 'Other',
        muscleGroup: 'Shoulders'
    },
    {
        name: 'Dumbbell Shrug',
        type: 'Dumbbell',
        muscleGroup: 'Traps'
    },
    {
        name: 'Barbell Upright Row',
        type: 'Barbell',
        muscleGroup: 'Traps'
    },
    {
        name: 'Barbell Shrug',
        type: 'Barbell',
        muscleGroup: 'Traps'
    },
    {
        name: 'Wide Grip Upright Row',
        type: 'Other',
        muscleGroup: 'Traps'
    },
    {
        name: 'One-Arm Dumbbell Upright Row',
        type: 'Dumbbell',
        muscleGroup: 'Traps'
    },
    {
        name: 'Seated Dumbbell Shrug',
        type: 'Dumbbell',
        muscleGroup: 'Traps'
    },
    {
        name: 'Smith Machine Shrug',
        type: 'Barbell',
        muscleGroup: 'Traps'
    },
    {
        name: 'High Pull',
        type: 'Other',
        muscleGroup: 'Traps'
    },
    {
        name: 'Cable Shrug',
        type: 'Cable',
        muscleGroup: 'Traps'
    },
    {
        name: 'Trap Bar Shrug',
        type: 'Barbell',
        muscleGroup: 'Traps'
    },
    {
        name: 'Tate Press',
        type: 'Other',
        muscleGroup: 'Traps'
    },
    {
        name: 'Sumo High Pull',
        type: 'Other',
        muscleGroup: 'Traps'
    },
    {
        name: 'Snatch Grip High Pull',
        type: 'Other',
        muscleGroup: 'Traps'
    },
    {
        name: 'Trap Lacrosse Ball',
        type: 'Other',
        muscleGroup: 'Traps'
    },
    {
        name: 'Seated Cable Shrug',
        type: 'Cable',
        muscleGroup: 'Traps'
    },
    {
        name: 'Snatch Grip Barbell Shrug',
        type: 'Barbell',
        muscleGroup: 'Traps'
    },
    {
        name: '1 KB Kettlebell Sumo Deadlift High Pull',
        type: 'Kettlebell',
        muscleGroup: 'Traps'
    },
    {
        name: 'Standing Calf Machine Shrug',
        type: 'Machine',
        muscleGroup: 'Traps'
    },
    {
        name: '2 KB Kettlebell Sumo Deadlift High Pull',
        type: 'Kettlebell',
        muscleGroup: 'Traps'
    },
    {
        name: 'T-Bar Machine Shrug',
        type: 'Machine',
        muscleGroup: 'Traps'
    },
    {
        name: 'Behind-The-Back Barbell Shrug',
        type: 'Barbell',
        muscleGroup: 'Traps'
    },
    {
        name: 'Inverted Shrug',
        type: 'Other',
        muscleGroup: 'Traps'
    },
    {
        name: 'Lying Cable Upright Row',
        type: 'Cable',
        muscleGroup: 'Traps'
    },
    {
        name: 'Machine Shrug',
        type: 'Machine',
        muscleGroup: 'Traps'
    },
    {
        name: 'Cable Row to Neck',
        type: 'Cable',
        muscleGroup: 'Traps'
    },
    {
        name: 'Snatch Shrug',
        type: 'Other',
        muscleGroup: 'Traps'
    },
    {
        name: 'Lying Cable Shrug',
        type: 'Cable',
        muscleGroup: 'Traps'
    },
    {
        name: 'Overhead Barbell Shrug',
        type: 'Barbell',
        muscleGroup: 'Traps'
    },
    {
        name: 'Clean Shrug',
        type: 'Other',
        muscleGroup: 'Traps'
    },
    {
        name: 'Gittleson Shrug',
        type: 'Other',
        muscleGroup: 'Traps'
    },
    {
        name: 'Straight Bar Tricep Extension',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Lying Dumbbell Extension',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Seated Dumbbell Tricep Extension',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Rope Tricep Extension',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Dumbbell Floor Press',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'EZ Bar Skullcrusher',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Tricep Dip',
        type: 'Bodyweight',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Bent Over Dumbbell Tricep Kickback',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Lying Barbell Tricep Extension (Skull Crusher)',
        type: 'Barbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Two Arm Standing Dumbbell Extension',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Close Grip Bench Press',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'French Press',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Dumbbell Tricep Kickback',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'One-Arm Standing Dumbbell Extension',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: '45 Degree Lying Tricep Extension',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Weighted Tricep Dips',
        type: 'Bodyweight',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Bench Dip',
        type: 'Bodyweight',
        muscleGroup: 'Triceps'
    },
    {
        name: 'One-Arm Seated Dumbbell Extension',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Reverse Grip Cable Tricep Extension',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Standing Overhead EZ Bar Tricep Extension',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Close Grip Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Triceps'
    },
    {
        name: 'One-Arm Cable Tricep Extension',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Seated French Press',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Standing Low Pulley Overhead Tricep Extension (Rope Extension)',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Cable Tricep Extension With V-Bar',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Incline Skull Crusher',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'High Pulley Overhead Tricep Extension (rope extension)',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Eccentric Only Dip',
        type: 'Bodyweight',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Machine Tricep Extension',
        type: 'Machine',
        muscleGroup: 'Triceps'
    },
    {
        name: 'One Arm Kettlebell Floor Press',
        type: 'Kettlebell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Reverse One-Arm Cable Tricep Extension',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Lying Pronated Dumbbell Tricep Extension',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Smith Machine Close Grip Bench Press',
        type: 'Barbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Smith Machine Incline Tricep Extension',
        type: 'Barbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Single Bench Dip',
        type: 'Bodyweight',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Band Assisted Dip',
        type: 'Bodyweight',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Cable Tricep Kickback',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'High Pulley Overhead Tricep Extension',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Incline Dumbbell Tricep Extension',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Kettlebell Floor Press',
        type: 'Kettlebell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Kettlebell Floor Press',
        type: 'Kettlebell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Dumbbell Tate Press',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'One Arm Bent Over Dumbbell Tricep Kickback',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Decline Close Grip Bench Press',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Banded Tricep Extension',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Overhead Banded Tricep Extension',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Seated Bent Over Tricep Dumbbell Kickback',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Alternating Bent-Over Dumbbell Kickback',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Decline Lying Dumbbell Extension',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Incline Close Grip Bench Press',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Kneeling Overhead Tricep Extension (Over Flat Bench)',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Cable Concentration Tricep Extension',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Sphinx Push Up',
        type: 'Bodyweight',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Close Grip EZ Bar Press',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'California Skullcrusher',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Rolling Dumbbell Extension',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Close Grip Chest Press',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Close Grip Press Behind-The-Neck',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Weighted Bench Dip',
        type: 'Bodyweight',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Reverse Grip French Press',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Seated Low Pulley Overhead Tricep Extension (Rope Extension)',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Incline Cable Tricep Extension',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'One-Arm Lying Pronated Dumbbell Extension',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Incline Cable Tricep Extension (Rope Extension)',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Alternating Lying Dumbbell Extension',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Seated EZ Bar French Press',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Reverse Grip Close Grip Bench Press',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'EZ Bar Incline Skullcrusher',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Smith Machine Reverse Close Grip Bench Press',
        type: 'Barbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Ring Dip',
        type: 'Bodyweight',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Lying Dumbbell Extension (Single Dumbbell)',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Lying Barbell Reverse Extension',
        type: 'Barbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Lying Cable Tricep Extension (Rope Extension)',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Standing Low Pulley Overhead Tricep Extension',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Tricep Tiger Tail',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'One Arm Bottoms Up Kettlebell Floor Press',
        type: 'Kettlebell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Three Bench Dip',
        type: 'Bodyweight',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Lying Cable Tricep Extension',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'One-Arm Seated Dumbbell Kickback',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Seated Low Pulley Overhead Tricep Extension',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Close Grip Pin Press',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Banded Skullcrusher',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Seated Alternating Bent Over Dumbbell Kickback',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Exercise Ball Dumbbell Kickbacks',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: '45 Degree Lying Tricep Extension (EZ Bar)',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Inline Bench French Press',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Two-Arm Tricep Cable Extension',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'One-Arm Cable Overhead Tricep Extension',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Triceps Lacrosse Ball',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Exercise Ball Dip',
        type: 'Bodyweight',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Two Arm Cable Tricep Kickback',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'One-Arm Lying Dumbbell Extension',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Reverse Grip One-Arm Overhead Cable Tricep Extension',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Exercise Ball French Press',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Decline Lying Tricep Extension (Skullcrusher)',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Alternating Dumbbell Floor Press',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Reverse Grip Cable Tricep Kickback',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Exercise Ball Two-Arm Dumbbell Extension',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Exercise Ball One-Arm Dumbbell Extension',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Smith Machine Reverse Close Grip Bench Press',
        type: 'Barbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Ring Dip',
        type: 'Bodyweight',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Lying Dumbbell Extension (Single Dumbbell)',
        type: 'Dumbbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Lying Cable Tricep Extension (Rope Extension)',
        type: 'Cable',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Lying Barbell Reverse Extension',
        type: 'Barbell',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Standing Low Pulley Overhead Tricep Extension',
        type: 'Other',
        muscleGroup: 'Triceps'
    },
    {
        name: 'Tricep Tiger Tail',
        type: 'Other',
        muscleGroup: 'Triceps'
    }
]

export default exercises;
