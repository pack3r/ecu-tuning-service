# How to Install Node.js (includes npm)

## Quick Installation Steps:

1. **Download Node.js:**
   - Go to: https://nodejs.org/
   - Click the "LTS" (Long Term Support) version button - it will download automatically
   - Or direct download: https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi

2. **Install:**
   - Run the downloaded `.msi` file
   - Click "Next" through all the installation steps (use default settings)
   - Make sure "Add to PATH" is checked (it should be by default)
   - Click "Install"

3. **Verify Installation:**
   - Close and reopen PowerShell/Command Prompt
   - Run: `node --version`
   - Run: `npm --version`
   - Both should show version numbers

4. **After Installation:**
   - Navigate to: `cd C:\inetpub`
   - Run: `npm install` (to install dependencies)
   - Run: `npm start` (to start the server)
   - Open browser: http://localhost:3000

## Alternative: If you prefer not to install Node.js

I can create a PHP version instead (requires PHP installation) or a Python version (requires Python installation).
