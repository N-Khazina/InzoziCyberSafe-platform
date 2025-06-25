# Development Setup

This project is configured to use Firebase in development mode with emulators.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start Firebase emulators:**
   ```bash
   npm run emulators
   ```

3. **In a new terminal, start the development server:**
   ```bash
   npm run dev
   ```

   Or run both together:
   ```bash
   npm run dev:emulators
   ```

## Firebase Emulators

The project is configured to use Firebase emulators for local development:

- **Authentication Emulator**: http://localhost:9099
- **Firestore Emulator**: http://localhost:8080
- **Emulator UI**: http://localhost:4000

## Development Features

- ✅ Firebase Authentication (local emulator)
- ✅ Firestore Database (local emulator)
- ✅ Development-friendly security rules (allow all)
- ✅ Hot reload with Vite
- ✅ TypeScript support

## Environment Variables

The `.env` file contains your Firebase configuration. The `VITE_USE_EMULATORS=true` flag ensures emulators are used in development.

## Available Scripts

- `npm run dev` - Start Vite development server
- `npm run emulators` - Start Firebase emulators
- `npm run dev:emulators` - Start both emulators and dev server
- `npm run emulators:ui` - Start emulators with UI
- `npm run deploy:rules` - Deploy Firestore rules to production

## Notes

- All data in emulators is temporary and will be lost when emulators are stopped
- Security rules are set to allow all operations in development mode
- Switch `VITE_USE_EMULATORS=false` in `.env` to use production Firebase
