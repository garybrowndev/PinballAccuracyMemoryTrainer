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

## PWA Features

### Install Prompts

The app includes smart install prompts that:

- **Auto-trigger** after 10 seconds of use (Chrome/Edge)
- **Remember dismissals** for 7 days
- **iOS instructions** for Safari users (tap Share → Add to Home Screen)
- **Beautiful UI** with slide-up animation and branded colors

See `src/utils/pwa-install.js` for implementation.

### Offline Fallback

A dedicated offline page (`public/offline.html`) provides:

- Clear offline status indication
- List of available offline features
- Connection status monitoring
- Automatic reconnection detection
- Retry functionality with cache busting

### App Shortcuts

The PWA manifest includes shortcuts for:

- 🎯 **Start Practice** - Begin practice session
- 🧠 **Start Recall** - Begin recall test
- 📋 **Browse Presets** - View available tables

Access via long-press on app icon (Android) or right-click (desktop).

### iOS Support

Special handling for iOS devices:

- Detects iOS Safari
- Shows custom installation instructions
- Proper standalone mode detection
- Full-screen support without browser chrome

### Background Sync (Future Enhancement)

The app is ready for background sync when needed:

- Training data synchronization
- Preset updates
- Statistics backup

## Testing PWA Features

### Install Prompt

1. Clear site data in DevTools
2. Visit the app
3. Wait 10 seconds
4. Install prompt should appear
5. Test "Install" and "Later" buttons

### Offline Mode

1. Build production version
2. Visit app once while online
3. Turn off network in DevTools
4. Refresh page
5. Should show full functionality or offline.html

### iOS Testing

1. Open in Safari on iOS device
2. Wait 15 seconds for instructions
3. Follow prompts to add to home screen
4. Launch from home screen (fullscreen mode)

### App Shortcuts

1. Install PWA
2. Long-press icon (mobile) or right-click (desktop)
3. Verify shortcuts appear and work

## Troubleshooting

### Install prompt not showing?

- Check if app is already installed
- Check localStorage for `pwa-install-dismissed` key
- Clear and wait 10 seconds
- Must be HTTPS or localhost

### Offline not working?

- Must build production version (`npm run build`)
- Visit app once while online first
- Check service worker is active in DevTools
- Check cache storage has assets

### iOS not installing?

- Must use Safari browser
- Tap Share button (⎋ icon)
- Select "Add to Home Screen"
- iOS doesn't support automatic prompts
