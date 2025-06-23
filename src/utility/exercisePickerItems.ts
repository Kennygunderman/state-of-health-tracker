import {PickerItem} from '@components/Picker'

import {ExerciseBodyPartEnum, ExerciseTypeEnum} from '@data/models/Exercise'

export const exerciseTypeValues: PickerItem[] = [
  {
    label: ExerciseTypeEnum.BARBELL,
    value: ExerciseTypeEnum.BARBELL
  },
  {
    label: ExerciseTypeEnum.DUMBBELL,
    value: ExerciseTypeEnum.DUMBBELL
  },
  {
    label: ExerciseTypeEnum.BODYWEIGHT,
    value: ExerciseTypeEnum.BODYWEIGHT
  },
  {
    label: ExerciseTypeEnum.CABLE,
    value: ExerciseTypeEnum.CABLE
  },
  {
    label: ExerciseTypeEnum.MACHINE,
    value: ExerciseTypeEnum.MACHINE
  },
  {
    label: ExerciseTypeEnum.WEIGHTED,
    value: ExerciseTypeEnum.WEIGHTED
  },
  {
    label: ExerciseTypeEnum.KETTLEBELL,
    value: ExerciseTypeEnum.KETTLEBELL
  },
  {
    label: ExerciseTypeEnum.TIMED,
    value: ExerciseTypeEnum.TIMED
  },
  {
    label: ExerciseTypeEnum.OTHER,
    value: ExerciseTypeEnum.OTHER
  }
]

export const bodyPartValues: PickerItem[] = [
  {
    label: ExerciseBodyPartEnum.CHEST,
    value: ExerciseBodyPartEnum.CHEST
  },
  {
    label: ExerciseBodyPartEnum.BACK,
    value: ExerciseBodyPartEnum.BACK
  },
  {
    label: ExerciseBodyPartEnum.SHOULDERS,
    value: ExerciseBodyPartEnum.SHOULDERS
  },
  {
    label: ExerciseBodyPartEnum.TRAPS,
    value: ExerciseBodyPartEnum.TRAPS
  },
  {
    label: ExerciseBodyPartEnum.TRICEPS,
    value: ExerciseBodyPartEnum.TRICEPS
  },
  {
    label: ExerciseBodyPartEnum.BICEPS,
    value: ExerciseBodyPartEnum.BICEPS
  },
  {
    label: ExerciseBodyPartEnum.CORE,
    value: ExerciseBodyPartEnum.CORE
  },
  {
    label: ExerciseBodyPartEnum.LEGS,
    value: ExerciseBodyPartEnum.LEGS
  },
  {
    label: ExerciseBodyPartEnum.CALVES,
    value: ExerciseBodyPartEnum.CALVES
  },
  {
    label: ExerciseBodyPartEnum.FULL_BODY,
    value: ExerciseBodyPartEnum.FULL_BODY
  },
  {
    label: ExerciseBodyPartEnum.CARDIO,
    value: ExerciseBodyPartEnum.CARDIO
  },
  {
    label: ExerciseBodyPartEnum.OTHER,
    value: ExerciseBodyPartEnum.OTHER
  }
]
