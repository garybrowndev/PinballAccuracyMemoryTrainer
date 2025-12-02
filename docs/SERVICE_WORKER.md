# Service Worker Testing Guide

## ⚠️ Important: Dev vs Production Behavior

The service worker behaves differently in development vs production mode:

### Development Mode (`npm run dev`)
- Service worker is registered but has **limited functionality**
- **Offline mode will NOT work** due to Vite HMR (Hot Module Replacement) requirements
- Use dev mode for: development, debugging, testing features
- Service worker file: `dev-sw.js`

### Production Mode (`npm run build`)
- Service worker has **full offline functionality**
- All assets are precached (91 entries, ~756 KB)
- **Offline mode works perfectly**
- Service worker file: `sw.js`

## Testing Service Worker Offline Functionality

### Method 1: Production Build (Recommended)
```bash
# Build production version
npm run build

# Serve production build locally
npx serve dist -p 3000

# Open browser to http://localhost:3000
# DevTools → Application → Service Workers → Check "Offline"
# Refresh page - should work offline!
```

### Method 2: GitHub Pages Deployment
The deployed version at https://garybrowndev.github.io/PinballAccuracyMemoryTrainer/ has full service worker functionality including offline support.

## How to Verify Service Worker is Active

1. **Open DevTools** (F12)
2. Go to **Application** tab → **Service Workers**
3. Look for:
   - ✅ Status: "Activated and running"
   - ✅ Source: `sw.js` (production) or `dev-sw.js` (dev)
   - ✅ Scope: `/`

## Cached Resources

The service worker precaches:
- All JavaScript bundles
- All CSS files
- HTML files
- Images (SVG, WebP)
- All 38+ pinball preset JSON files from `/public/presets/`

## Cache Strategies

- **App shell** (HTML, JS, CSS): Precached at install
- **Presets JSON**: Cache-first with 30-day expiration
- **External fonts**: Cache-first with 1-year expiration

## Configuration

Service worker configuration is in `config/vite.config.js`:
- `registerType: 'autoUpdate'` - Users get updates on next page refresh
- `devOptions.enabled: true` - Enable SW in dev mode (limited functionality)
- Workbox caching strategies defined in `runtimeCaching` array
