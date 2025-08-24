# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common Development Commands

### Build & Development
- `npm start` - Start Expo development server with dev client
- `npm run ios` - Build and run iOS app locally
- `npm run android` - Build and run Android app locally  
- `npm run web` - Start web development server

### Code Quality
- `npm run lint` - Run ESLint on entire codebase
- `npm test` - Run Jest test suite
- `npx prettier --write .` - Format code with Prettier

### Production Builds
- `npm run build-ios-dev` - Create development iOS build via EAS
- `eas build --platform ios` - Create production iOS build
- `eas submit -p ios` - Submit iOS build to App Store Connect

### Testing & Development
- `jest path/to/test.test.ts` - Run a specific test file
- `jest --watch` - Run tests in watch mode
- `expo install` - Install Expo-compatible dependencies
- `npx expo doctor` - Check for common Expo project issues

## Project Architecture

### Technology Stack
- **Framework**: React Native with Expo (v50.0.0)
- **Navigation**: React Navigation v6 (Native Stack + Bottom Tabs)
- **State Management**: Hybrid approach with Redux + Redux Persist and Zustand
- **Backend**: Firebase (Auth, Firestore, Remote Config, Crashlytics)
- **Data Validation**: io-ts for runtime type checking
- **Functional Programming**: fp-ts for functional utilities

### Key Architecture Patterns

#### State Management Migration
The app is currently migrating from Redux to Zustand. Key files:
- **Redux Store**: `src/store/index.ts` - Legacy Redux setup with persistence
- **Zustand Stores**: `src/store/auth/useAuthStore.ts` - New Zustand stores for auth
- **Migration Pattern**: New features use Zustand, legacy features remain on Redux temporarily

#### Navigation Structure
- **Root Navigation**: `App.tsx` - Handles authenticated vs unauthenticated states
- **Auth Stack**: `src/navigation/AuthStack.tsx` - Login/Register flow
- **Main App**: `src/navigation/HomeTabs.tsx` - Bottom tab navigation with Meals and Workouts

#### Data Layer Architecture
- **Models**: `src/data/models/` - TypeScript interfaces and types
- **Decoders**: `src/data/decoders/` - io-ts runtime validation schemas  
- **Converters**: `src/data/converters/` - Transform data between client/server formats
- **Services**: `src/service/` - Business logic and API calls organized by domain

### Directory Structure & Path Aliases
The project uses TypeScript path aliases defined in `tsconfig.json`:
- `@screens/*` → `src/screens/*`
- `@components/*` → `src/components/*`
- `@store/*` → `src/store/*`
- `@theme/*` → `src/styles/*`
- `@service/*` → `src/service/*`
- `@data/*` → `src/data/*`
- `@constants/*` → `src/constants/*`

### Environment Configuration
- **Environment Variables**: Use `.env` file with react-native-dotenv
- **Config Template**: `config.ts.dist` shows required USDA API configuration
- **Firebase Config**: `GoogleService-Info.plist` for iOS Firebase setup

### Code Style & Standards
- **ESLint**: Configured with TypeScript, React, and Prettier rules
- **Import Organization**: Strict import ordering with React first, then external, then internal
- **TypeScript**: Strict mode enabled with path aliases
- **Component Structure**: Functional components with hooks, no class components

### Testing Setup
- **Framework**: Jest with Expo preset (`jest-expo`)
- **Test Location**: `src/utility/__tests__/` contains utility function tests
- **Configuration**: `jest.config.js` uses minimal Expo preset setup

### Build & Deployment
- **EAS Build**: Configured in `eas.json` with development, preview, and production profiles
- **Development Builds**: Use `expo-dev-client` for custom native code
- **iOS Builds**: Use `macos-sonoma-14.6-xcode-16.1` image with `m-medium` resources

## Domain-Specific Context

### Fitness Tracking Focus
This is a comprehensive fitness and nutrition tracking app that combines:
- **Workout Tracking**: Exercise templates, progressive overload, workout history
- **Meal Tracking**: USDA food database integration for nutrition logging
- **Progress Analytics**: Charts and graphs for tracking fitness goals

### Key Business Logic
- **Progressive Overload**: Automatically tracks when users should increase weight/reps
- **Daily Entries**: Automatic creation of daily meal/workout entries
- **USDA Integration**: Real-time food database searches with nutrition data
- **Offline Support**: Local storage with Firebase sync when online

### Firebase Integration
- **Authentication**: Email/password auth with user account management
- **Firestore**: Real-time data sync for user workouts, meals, and progress
- **Remote Config**: Feature flags and app configuration
- **Crashlytics**: Error tracking and crash reporting

### State Persistence
- **Redux Persist**: Whitelist includes `user`, `meals`, `food`, `dailyMealEntries`
- **Migration System**: `src/store/migrations.ts` handles data schema changes
- **Offline First**: App works offline with sync when connection restored
