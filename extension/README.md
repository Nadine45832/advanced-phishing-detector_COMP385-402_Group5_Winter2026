# Advanced phishing Detector - Chrome Extension

A simple Chrome extension that detects specific URLs and reads HTML content from specified elements.

## How to Build and Install

### Step 1: Load Extension in Chrome

1. **Open Chrome Extensions Page**
   - Type `chrome://extensions/` in the address bar and press Enter
   - Or go to: Menu (⋮) → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load the Extension**
   - Click the "Load unpacked" button
   - Navigate to and select the folder containing your extension files
   - Click "Select Folder"

4. **Verify Installation**
   - You should see your extension "URL Content Detector" in the list
   - The extension icon should appear in your Chrome toolbar (top-right)

### Step 2: Test the Extension

1. **Navigate to your target URL**
   - Go to a page that matches your configured domain and path

2. **Check for the notification**
   - If the URL matches and the element is found, you'll see a dialog appear in the top-right corner of the page
   - The dialog will show: "I checked this text:" followed by a preview of the content

3. **Click the extension icon**
   - Click the extension icon in the toolbar to see the current configuration
   - It will show you the target domain, path, and selector
   - It will indicate if the current page is being monitored

