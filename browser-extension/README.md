# 🔐 Office Display Credentials Sync Extension

> **Browser extension that automates the capture and synchronization of authentication credentials for Office Display systems**

Eliminates the need to manually extract cookies via DevTools, automating the entire credential sync process for multiple displays.

---

## 🎯 **FEATURES**

### ✅ **Core Features**
- 🔍 **Auto-detection** of known dashboards (Grafana, Tableau, Sentry, etc.)
- 🍪 **Automatic capture** of credentials after login
- 🚀 **One-click sync** with DisplayOps Admin
- 🔧 **Auto-configuration** of the endpoint (localhost:3000)
- 🔔 **Visual indicators** on the extension icon (no intrusive notifications)
- 📊 **Real-time status** of monitored domains

### 🎨 **Extension Icon States**
- ⚪️ **Grey**: No credentials detected
- 🟡 **Yellow**: Credentials ready to sync
- 🟢 **Green**: Synced recently
- 🔴 **Red**: Sync error

---

## 📦 **INSTALLATION**

### **1. Download the Extension**

The extension is distributed via GitHub Releases:

1. **Go to**: https://github.com/fredppm/DisplayOps/releases
2. **Find**: Tag `extension-v*` (e.g., `extension-v1.0`)
3. **Download**: `displayops-extension-{version}.zip`
4. **Extract** the ZIP file

### **2. Install on Chrome/Edge**
1. **Open Chrome/Edge**
2. **Go to** `chrome://extensions/` (or `edge://extensions/`)
3. **Enable "Developer mode"** (top right corner)
4. **Click "Load unpacked"**
5. **Select** the folder extracted from the ZIP
6. **✅ Extension installed!**

**Or download directly from the Web Admin interface:**
- Go to `http://localhost:3000/cookies`
- Click "Download Extension"
- Extract and install as above

### **3. Initial Configuration**
The extension auto-configures itself:
- 🔍 **Detects Office Display** at `localhost:3000`
- ⚙️ **Editable configuration** if needed
- 🔗 **Automatically tests connection**

---

## 🚀 **HOW TO USE**

### **Typical Workflow:**
```
1. 🌐 Navigate to a dashboard (e.g.: grafana.company.com)
2. 🔐 Log in as usual  
3. 🟡 Extension icon turns yellow (credentials ready)
4. 📱 Click the extension icon
5. 🚀 Click "Sync Credentials"
6. ✅ All displays are logged in automatically!
7. 🟢 Icon turns green (synced)
```

### **Extension Popup Interface:**
```
📱 [Extension Popup]
┌─────────────────────────────────┐
│ 🔐 Office Display Sync          │
├─────────────────────────────────┤
│ 🟢 Connected: localhost:3000    │
│                                 │
│ 📍 Current Domain               │
│ grafana.company.com             │
│ 🟡 Credentials ready            │
│ [🚀 Sync Credentials]           │
│                                 │
│ 📊 Monitored Domains:           │
│ 🟢 grafana.company.com (2m)     │
│ 🟢 tableau.company.com (5m)     │
│ 🔴 sentry.io (expired)          │
│                                 │
│ ⚙️ Office Display: localhost:3000│
│ [Test] [Save]                   │
└─────────────────────────────────┘
```

---

## 🔧 **ADVANCED CONFIGURATION**

### **Automatically Supported Domains:**
- 🔶 **Grafana**: `grafana.*`
- 📊 **Tableau**: `tableau.*`
- 🏥 **Health Monitor**: `healthmonitor.*`
- 📈 **Generic Dashboard**: `dashboard.*`
- 📊 **Monitoring**: `monitoring.*`, `metrics.*`
- 🐛 **Kibana**: `kibana.*`
- 🚨 **Sentry**: `sentry.*`
- 🐕 **DataDog**: `datadog.*`

### **Office Display Endpoint:**
```javascript
// Auto-detects in this order:
const DEFAULT_ENDPOINTS = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://127.0.0.1:3000'
];
```

### **Manual Configuration:**
1. **Click the extension icon**
2. **Go to the "⚙️ Configuration" section**
3. **Enter endpoint**: `http://localhost:3000`
4. **Click "Test"** to validate
5. **Click "Save"**

---

## 🔍 **LOGIN DETECTION**

The extension detects logins automatically using:

### **🌐 URL patterns:**
- `/dashboard`, `/home`, `/main`, `/overview`, `/app`

### **🎯 DOM Elements:**
- User menus, sidebars, navigation
- Logout buttons (indicates logged in)
- Elements specific to Grafana, Tableau, etc.

### **📝 Text Content:**
- "welcome", "dashboard", "logout", "profile"

### **🍪 Authentication Cookies:**
- Filters for relevant cookies (session, auth, token, jwt, etc.)
- Ignores cookies that are too short (< 10 chars)
- Prioritizes long cookies (> 50 chars)

---

## 🔗 **INTEGRATION WITH OFFICE DISPLAY**

### **API Used:**
```javascript
POST /api/cookies/import
{
  "domain": "https://grafana.company.com",
  "cookies": "session_id=abc123\nauth_token=xyz789...",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### **Status API:**
```javascript
GET /api/cookies/status
// Checks if Office Display is online
```

### **Credential Format:**
```
# Format sent to API:
session_id=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
auth_token=MTIzNDU2Nzg5MC4xMjM0NTY3ODkw...
grafana_sess=abcd1234567890xyz...
```

---

## 🐛 **TROUBLESHOOTING**

### **❌ Extension doesn't detect login:**
- ✅ Make sure the domain is in the supported list
- ✅ Wait 2-5 seconds after login for detection
- ✅ Make sure the login was successful (not redirected to an error page)

### **❌ Sync fails:**
- ✅ Make sure Office Display is running (`localhost:3000`)
- ✅ Test connection in the extension settings
- ✅ Confirm there are valid credentials for the current domain

### **❌ Icon always grey:**
- ✅ Go to a supported dashboard domain
- ✅ Complete login in the dashboard
- ✅ Wait a few seconds for automatic detection

### **❌ Office Display not responding:**
```bash
# Check if Office Display is running:
curl http://localhost:3000/api/cookies/status

# Start Office Display if needed:
cd web-admin && npm run dev
```

---

## 🔒 **SECURITY & PRIVACY**

### **✅ Local Data:**
- 🔐 **Credentials are NOT stored** permanently in the extension
- 📊 **Only metadata** is saved (domain, timestamp, counters)
- 🌐 **Local communication only** with Office Display (localhost)

### **✅ Minimum Permissions:**
- 🍪 `cookies`: For authentication credential read only
- 📱 `activeTab`: Only for tab in use when the extension is used
- 💾 `storage`: Local extension settings

### **✅ No Telemetry:**
- ❌ **No data sent** to external servers
- ❌ **No personal information collected**
- ✅ **100% local** between browser and Office Display

---

## 📁 **PROJECT STRUCTURE**

```
office-display-extension/
├── manifest.json              # Extension Manifest V3
├── background.js              # Main Service Worker
├── content-script.js          # Login detection script
├── popup/
│   ├── popup.html            # Extension UI
│   ├── popup.css             # Extension styles
│   └── popup.js              # Extension UI logic
├── icons/
│   ├── create-icons.py       # Script to generate icons
│   ├── icon-idle-*.png       # Idle state icons
│   ├── icon-ready-*.png      # Ready state icons
│   ├── icon-synced-*.png     # Synced state icons
│   └── icon-error-*.png      # Error state icons
└── README.md                 # This documentation
```

---

## 🎯 **RESULTS**

### **BEFORE:** 😞
1. F12 → DevTools → Application → Cookies
2. Select domain → Copy cookies
3. Open Office Display → Cookies tab  
4. Paste cookies → Validate → Sync
5. **Total: ~2-3 minutes per dashboard**

### **AFTER:** 😍
1. 🔐 Login to the dashboard as usual
2. 🟡 See icon turn yellow (credentials ready)
3. 📱 Click the extension → "Sync Credentials"
4. ✅ All displays logged in automatically!
5. **Total: ~10 seconds per dashboard**

### **🚀 Benefits:**
- ⚡ **20x faster** than the manual process
- 🔒 **More secure** – no need to open DevTools
- 🤖 **Automatic** – detects login with no intervention  
- 📊 **Visibility** – real-time status
- 🔄 **Scalable** – works with multiple domains simultaneously

---

## 📞 **SUPPORT**

For issues or suggestions:
1. **Check troubleshooting** above
2. **Browser console**: F12 → Console (for extension logs)
3. **Office Display logs**: Terminal running `npm run dev`

---

## 🚀 **RELEASE / DEVELOPMENT**

### **For Developers:**

#### **Create a new release:**

```powershell
# Windows
cd browser-extension
.\release.ps1 1.0.1
```

```bash
# Linux/Mac
cd browser-extension
./release.sh 1.0.1
```

The script will:
1. ✅ Check that the version in `manifest.json` is correct
2. ✅ Create tag `extension-v1.0.1` on Git
3. ✅ Push the tag to GitHub
4. 🚀 GitHub Actions automatically:
   - Packages the extension
   - Creates a release on GitHub
   - Publishes the ZIP for download

#### **Update version in manifest.json:**

```json
{
  "manifest_version": 3,
  "name": "DisplayOps Credentials Sync",
  "version": "1.0.1",   // ← Update here before releasing
  ...
}
```

#### **GitHub Actions Workflow:**

Located at `.github/workflows/release-extension.yml`:
- Triggered by tags `extension-v*`
- Packages all files automatically
- Generates SHA256 checksum
- Creates release with changelog
- Provides public download

---

**✅ OFFICE DISPLAY CREDENTIALS SYNC EXTENSION – READY TO USE!** 🚀🔐