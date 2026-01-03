#!/usr/bin/env node

/**
 * Patches chrome-launcher to handle Windows temp directory cleanup errors gracefully
 * This prevents cleanup failures from losing Lighthouse audit results
 */

const fs = require('fs');
const path = require('path');

const chromeLauncherPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'chrome-launcher',
  'dist',
  'chrome-launcher.js'
);

try {
  let content = fs.readFileSync(chromeLauncherPath, 'utf8');

  // Find and patch the destroyTmp method to handle cleanup errors gracefully
  const oldPattern =
    /rmSync\(this\.userDataDir,\s*{\s*recursive:\s*true,\s*force:\s*true,\s*maxRetries:\s*10\s*}\);/;

  const newCode = `try {
            rmSync(this.userDataDir, { recursive: true, force: true, maxRetries: 10 });
        } catch (error) {
            // On Windows, temp directory cleanup can fail due to file locking
            // This shouldn't fail the entire audit - log but don't throw
            if (process.platform === 'win32') {
                // eslint-disable-next-line no-console
                console.warn('Warning: Failed to clean up temp directory:', error.message);
                // Try async cleanup in background without blocking
                setTimeout(() => {
                    try {
                        const { execSync } = require('child_process');
                        execSync(\`powershell -Command "Remove-Item -Path '\${this.userDataDir}' -Recurse -Force -ErrorAction SilentlyContinue"\`, {
                            stdio: 'ignore'
                        });
                    } catch (e) {
                        // Silent fail - OS will eventually clean up temp dir
                    }
                }, 1000);
            } else {
                throw error;
            }
        }`;

  if (oldPattern.test(content)) {
    content = content.replace(oldPattern, newCode);
    fs.writeFileSync(chromeLauncherPath, content, 'utf8');
    // eslint-disable-next-line no-console
    console.log('✓ Successfully patched chrome-launcher for Windows cleanup resilience');
  } else {
    // eslint-disable-next-line no-console
    console.warn('⚠ Could not find chrome-launcher cleanup code - pattern may have changed');
  }
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('Error patching chrome-launcher:', error.message);
  process.exit(1);
}
