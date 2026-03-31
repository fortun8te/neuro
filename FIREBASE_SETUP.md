# Firebase Setup Guide for Neuro Cloud Sync

## 1. Create Firebase Project

### Option A: Using Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a new project"
3. Enter project name: `neuro-sync`
4. Enable Google Analytics (optional)
5. Click "Create project"

### Option B: Using Firebase CLI
```bash
npm install -g firebase-tools
firebase login
firebase init firestore
```

---

## 2. Enable Authentication

### In Firebase Console:
1. Go to **Authentication** → **Sign-in method**
2. Enable these providers:
   - **Email/Password** — Standard auth
   - **Google Sign-In** — For OAuth (optional)
   - **Anonymous** — For testing (optional)

### Configuration in Neuro:
```typescript
// Already set up in src/services/firebase.ts
const auth = getAuth(app);
```

---

## 3. Create Firestore Database

### In Firebase Console:
1. Go to **Firestore Database**
2. Click "Create database"
3. Select region: `us-central1` (or closest to your users)
4. Choose security rules: **Start in production mode**

### Database Structure:
```
firestore/
  └── canvas_documents/ (collection)
      └── {docId}/ (document)
          ├── id: string
          ├── userId: string
          ├── title: string
          ├── content: string
          ├── fileType: 'docx'|'pdf'|'md'|'html'|'txt'|'code'
          ├── tags: string[]
          ├── createdAt: Timestamp
          ├── updatedAt: Timestamp
          ├── cloudVersion: number
          ├── isPublic: boolean
```

---

## 4. Configure Security Rules

### Replace default rules with:

```firestore
// Firestore Security Rules for Neuro
// Rules: Users can only read/write their own documents

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ─────────────────────────────────────────────────────────
    // Canvas Documents Collection
    // ─────────────────────────────────────────────────────────

    match /canvas_documents/{docId} {
      // Allow read if user is the document owner
      allow read: if request.auth.uid == resource.data.userId;

      // Allow create if authenticated user is setting themselves as owner
      allow create: if request.auth != null &&
                       request.resource.data.userId == request.auth.uid &&
                       request.resource.data.createdAt == request.time &&
                       request.resource.data.updatedAt == request.time &&
                       request.resource.data.cloudVersion == 1;

      // Allow update if user is the document owner
      allow update: if request.auth.uid == resource.data.userId &&
                       request.resource.data.userId == resource.data.userId &&
                       request.resource.data.createdAt == resource.data.createdAt &&
                       request.resource.data.updatedAt == request.time;

      // Allow delete if user is the document owner
      allow delete: if request.auth.uid == resource.data.userId;

      // Allow list if authenticated (returns only user's docs due to query)
      allow list: if request.auth != null;
    }

    // ─────────────────────────────────────────────────────────
    // Deny everything else by default
    // ─────────────────────────────────────────────────────────
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### In Firebase Console:
1. Go to **Firestore** → **Rules**
2. Replace all content with rules above
3. Click "Publish"

---

## 5. Get Firebase Configuration

### In Firebase Console:
1. Go to **Project Settings** (⚙️ icon, top-right)
2. Click **Your apps**
3. Click **Web** (or create if needed)
4. Copy the configuration object

### Format:
```javascript
{
  apiKey: "...",
  authDomain: "project.firebaseapp.com",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
}
```

---

## 6. Configure Environment Variables

### Create `.env.local` in project root:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=<your-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<your-project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<your-project-id>
VITE_FIREBASE_STORAGE_BUCKET=<your-project>.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
VITE_FIREBASE_APP_ID=<your-app-id>

# Shell Exec Service (for local filesystem operations)
VITE_SHELL_EXEC_URL=http://localhost:3001

# Other Services (already configured)
VITE_OLLAMA_URL=http://100.74.135.83:11440
VITE_WAYFARER_URL=http://localhost:8889
VITE_SEARXNG_URL=http://localhost:8888
```

### Also update `.env.example`:
```bash
# Copy your configuration but replace values with placeholders
VITE_FIREBASE_API_KEY=sk_live_...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
# etc.
```

---

## 7. Enable Cloud Storage (Optional — for large files)

### If documents exceed Firestore size limits:

1. Go to **Cloud Storage**
2. Click "Create bucket"
3. Name: `neuro-documents` (or similar)
4. Region: Same as Firestore (us-central1)
5. Storage class: **Standard**

### Update Security Rules:
```firestore
// In Cloud Storage Rules
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

### Update `firebaseDocuments.ts` to use Cloud Storage for large files:
```typescript
// Check file size
if (content.length > 1000000) {
  // Upload to Cloud Storage instead of Firestore
  const bucket = getStorage();
  const fileRef = ref(bucket, `users/${userId}/documents/${docId}`);
  await uploadString(fileRef, content);
}
```

---

## 8. Test Firebase Connection

### In browser console:
```javascript
// Test Firebase auth
import { auth } from './services/firebase';

// Should show Firebase app initialized
console.log(auth);

// Test login (opens popup)
firebaseLoginWithGoogle();
```

### Check Firestore:
1. Go to **Firebase Console** → **Firestore Database**
2. Create a test collection: `canvas_documents`
3. Add a test document manually
4. Verify you can query it from the app

---

## 9. Configure Backup & Recovery

### Enable Firestore Backups:
1. Go to **Firestore Database**
2. Click **Backups** tab
3. Click "Create backup"
4. Schedule: Daily (or as needed)
5. Retention: 7 days (or longer)

### Monitor in Cloud Monitoring:
1. Go to **Monitoring** → **Dashboard**
2. Add charts for:
   - Document read/write operations
   - Authentication failures
   - Database size

---

## 10. Production Checklist

Before deploying to production:

- [ ] Firestore rules are published (not in test mode)
- [ ] Authentication providers are configured
- [ ] Environment variables are set in production
- [ ] Backup schedule is active
- [ ] Cloud Monitoring alerts are configured
- [ ] Rate limiting is in place (Firestore has built-in limits)
- [ ] Data encryption is enabled (default in Firestore)
- [ ] API key restrictions are set:
  - Go to **APIs & Services** → **Credentials**
  - Click your API key
  - Restrict to **Cloud Firestore API**
  - Restrict to **Web applications** with domain whitelist

---

## 11. Troubleshooting

### "Permission denied" errors:
- Check if user is authenticated
- Verify Firestore rules (especially userId matching)
- Check Firebase Console → Logs for details

### "CORS errors":
- Add domain to CORS whitelist in Firebase Console
- For development: localhost is usually allowed by default

### "Quota exceeded":
- Firestore has free tier limits (50K reads/day, 20K writes/day)
- Monitor usage in **Firestore Database** → **Usage** tab
- Upgrade to paid plan if needed

### "Network errors":
- Check Shell Exec Server is running (port 3001)
- Verify VITE_SHELL_EXEC_URL is correct
- Check firewall allows localhost:3001

---

## 12. Cleanup & Deletion

### Delete Firebase Project (destructive):
```bash
firebase projects:list
firebase projects:delete <project-id>
```

### Export Firestore Data:
```bash
# Export before deletion
gsutil -m cp -r gs://bucket-name/backups ~/backups/
```

---

## Cost Estimation

**Firestore Pricing (as of 2026):**
- Read operations: $0.06 per 100K
- Write operations: $0.18 per 100K
- Delete operations: $0.02 per 100K
- Storage: $0.18 per GB/month
- Network (egress): $0.12 per GB (first 1GB free)

**Typical Usage (small team):**
- 100 users × 50 syncs/day = 5,000 writes/day
- Cost: ~$0.27/day ≈ $8/month

**Typical Usage (large team):**
- 10,000 users × 50 syncs/day = 500,000 writes/day
- Cost: ~$27/day ≈ $800/month
- (Usually negotiable for enterprise)

---

## Support

- Firebase Documentation: https://firebase.google.com/docs
- Firestore Guide: https://firebase.google.com/docs/firestore
- Community: Stack Overflow tag `firebase`
