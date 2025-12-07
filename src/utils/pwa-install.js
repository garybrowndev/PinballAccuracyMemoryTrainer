/**
 * PWA Install Prompt Component
 * Provides a better UX for PWA installation with dismissible prompts
 */

let deferredPrompt;
let installPromptShown = false;

const PWA_DISMISS_KEY = 'pwa-install-dismissed';
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const INSTALL_DELAY_MS = 10000;
const IOS_DELAY_MS = 15000;

/**
 * Initialize PWA install prompt
 */
function initPWAInstallPrompt() {
  // Check if already installed
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return; // Already installed
  }

  // Check if user has dismissed the prompt before
  const dismissed = localStorage.getItem(PWA_DISMISS_KEY);
  const dismissedTime = dismissed ? Number.parseInt(dismissed, 10) : 0;

  // Don't show again for a week if dismissed
  if (dismissed && Date.now() - dismissedTime < WEEK_IN_MS) {
    return;
  }

  // Listen for the beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;

    // Show install prompt after a delay (better UX)
    setTimeout(() => {
      if (!installPromptShown) {
        showInstallPrompt();
      }
    }, INSTALL_DELAY_MS);
  });

  // Detect if app was installed
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallPrompt();
    localStorage.removeItem(PWA_DISMISS_KEY);
  });

  // iOS detection
  if (isIOS() && !isInStandaloneMode()) {
    showIOSInstallInstructions();
  }
}

/**
 * Check if device is iOS
 */
function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Check if app is in standalone mode
 */
function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
}

/**
 * Show install prompt
 */
function showInstallPrompt() {
  installPromptShown = true;

  const promptHTML = `
    <div id="pwa-install-prompt" style="
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      max-width: 400px;
      margin: 0 auto;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      animation: slideUp 0.3s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <style>
        @keyframes slideUp {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      </style>
      <div style="display: flex; align-items: flex-start; gap: 15px;">
        <div style="flex-shrink: 0; font-size: 32px;">📱</div>
        <div style="flex: 1;">
          <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">Install App</h3>
          <p style="margin: 0 0 15px 0; font-size: 14px; opacity: 0.95; line-height: 1.4;">
            Install Pinball Trainer for quick access and offline use!
          </p>
          <div style="display: flex; gap: 10px;">
            <button id="pwa-install-btn" style="
              flex: 1;
              background: white;
              color: #2563eb;
              border: none;
              padding: 10px 20px;
              border-radius: 6px;
              font-weight: 600;
              cursor: pointer;
              font-size: 14px;
            ">Install</button>
            <button id="pwa-dismiss-btn" style="
              background: rgba(255, 255, 255, 0.2);
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 6px;
              font-weight: 600;
              cursor: pointer;
              font-size: 14px;
            ">Later</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', promptHTML);

  // Add event listeners
  document.querySelector('#pwa-install-btn')?.addEventListener('click', installPWA);
  document.querySelector('#pwa-dismiss-btn')?.addEventListener('click', dismissInstallPrompt);
}

/**
 * Show iOS install instructions
 */
function showIOSInstallInstructions() {
  // Only show once per session
  if (sessionStorage.getItem('ios-install-shown')) {
    return;
  }

  const dismissed = localStorage.getItem(PWA_DISMISS_KEY);
  const dismissedTime = dismissed ? Number.parseInt(dismissed, 10) : 0;

  if (dismissed && Date.now() - dismissedTime < WEEK_IN_MS) {
    return;
  }

  sessionStorage.setItem('ios-install-shown', 'true');

  setTimeout(() => {
    const promptHTML = `
      <div id="ios-install-prompt" style="
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        max-width: 400px;
        margin: 0 auto;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideUp 0.3s ease-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="display: flex; align-items: flex-start; gap: 15px;">
          <div style="flex-shrink: 0; font-size: 32px;">🍎</div>
          <div style="flex: 1;">
            <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">Install on iOS</h3>
            <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.95; line-height: 1.4;">
              Tap the share button <span style="font-size: 18px;">⎋</span> then "Add to Home Screen"
            </p>
            <button id="ios-dismiss-btn" style="
              background: rgba(255, 255, 255, 0.2);
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              font-weight: 600;
              cursor: pointer;
              font-size: 14px;
              margin-top: 8px;
            ">Got it</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', promptHTML);
    document.querySelector('#ios-dismiss-btn')?.addEventListener('click', () => {
      document.querySelector('#ios-install-prompt')?.remove();
      localStorage.setItem(PWA_DISMISS_KEY, Date.now().toString());
    });
  }, IOS_DELAY_MS);
}

/**
 * Install PWA
 */
async function installPWA() {
  if (!deferredPrompt) {
    return;
  }

  const promptToShow = deferredPrompt;
  deferredPrompt = null; // Clear immediately to prevent race condition

  // Show the install prompt
  promptToShow.prompt();

  // Wait for the user to respond to the prompt
  const { outcome } = await promptToShow.userChoice;

  if (outcome === 'accepted') {
    // User accepted
    hideInstallPrompt();
  } else {
    // User dismissed
    dismissInstallPrompt();
  }
}

/**
 * Dismiss install prompt
 */
function dismissInstallPrompt() {
  hideInstallPrompt();
  localStorage.setItem(PWA_DISMISS_KEY, Date.now().toString());
}

/**
 * Hide install prompt
 */
function hideInstallPrompt() {
  const prompt = document.querySelector('#pwa-install-prompt');
  if (prompt) {
    prompt.style.animation = 'slideDown 0.3s ease-out';
    setTimeout(() => prompt.remove(), 300);
  }
}

// Export at end of file
export { initPWAInstallPrompt };
