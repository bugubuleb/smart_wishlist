# Smart Wishlist Mobile (React Native CLI)

This folder contains the React Native CLI app that connects to the existing backend.

## Setup

```
cd mobile
npm install
```

### iOS

```
cd ios
bundle install
bundle exec pod install
cd ..

npm run ios
```

### Android

```
npm run android
```

## Environment

Set API endpoint (optional):

```
SMARTWISHLIST_API_URL=https://smartwishlist-production.up.railway.app/api
```

## Notes
- This is a CLI-based React Native app (not PWA).
- Apple developer account is not required at this stage for local builds.
