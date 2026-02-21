# MMT Assessment Tool - Frontend

## Phase 2 Sync Functionality

The frontend now includes offline-first sync capabilities to work with the backend server.

### Key Features

#### Offline-First Operation
- All features work without internet connection
- Assessments saved to localStorage first
- Syncs to server when connection available and user is logged in

#### Sync Status Tracking
- **Header Icon**: Shows sync status at a glance
  - ⏳ = Pending assessments to sync
  - ✓ = All assessments synced
- **Export Panel**: Full sync controls and status
  - Shows count of pending assessments
  - "Send to Server" button to manually trigger sync
  - Real-time status messages

#### Files

- [js/api.js](js/api.js) - API client for backend communication
  - `AuthAPI` - Login, register, logout
  - `AssessmentAPI` - Sync assessments to server
  - `QuestionAPI` - Fetch question sets
  
- [js/sync.js](js/sync.js) - Sync engine
  - `syncAssessments()` - Upload unsynced assessments
  - `updateSyncStatus()` - Update UI with current status
  - Auto-detects online/offline status
  
- [js/migrate.js](js/migrate.js) - Data migration
  - Upgrades Phase 1 assessments to Phase 2 format
  - Adds `synced`, `version`, `progress` fields

### Sync Button States

| Button Text | State | Reason |
|------------|-------|--------|
| Send to Server (X) | Enabled | X assessments ready to sync |
| All Synced | Disabled | No pending assessments |
| Offline | Disabled | No internet connection |
| Login Required | Disabled | User not authenticated |
| Syncing... | Disabled | Sync in progress |

### Data Structure

Each assessment now includes:
```javascript
{
  id: "assessment_YYYYMMDD_HHMMSS",
  contactInfo: { fullName, email, location },
  scores: { "indicator[X][Y]": scoreValue },
  progress: {
    currentQuestionIndex: 0,
    totalQuestions: 60,
    lastUpdated: "ISO date",
    completed: true,
    completedAt: "ISO date"
  },
  mediaAttachments: [],
  notes: "",
  created: "ISO date",
  synced: false,        // True when uploaded to server
  syncedAt: "ISO date", // When sync completed
  version: 1            // Question set version
}
```

### Usage

1. **Normal Operation**: Continue using the app offline as usual
2. **Manual Sync**: Navigate to Export tab and click "Send to Server"
3. **Auto Status**: Online/offline detection updates sync button automatically

### Authentication Required

Before syncing, users must:
1. Register an account or login
2. Stay logged in (JWT token stored in localStorage)
3. Backend server must be running and accessible

See [../back/README.md](../back/README.md) for backend setup instructions.

### Future Enhancements

- Login/register UI in frontend (currently backend only)
- Maybe: Download assessments from server to device
