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
  marketInfo: {
    marketId: null, // Assigned when synced; existing server markets can be selected offline from cache
    marketName: "Market name",
    localName: "",
    country: "",
    provinceState: "",
    district: "",
    cityTownVillage: "",
    setting: "",
    settingOther: "",
    latitude: null,
    longitude: null,
    leadAssessor: { userId: 7, name: "Assessor name", email: "assessor@example.com" },
    otherAssessors: [],
    assessmentSequence: 1,
    generalNotes: ""
  },
  scores: { "indicator[X][Y]": scoreValue }, // 1-4 or "na"
  progress: {
    currentQuestionIndex: 0,
    totalQuestions: 60,
    lastUpdated: "ISO date",
    completed: true,
    completedAt: "ISO date"
  },
  mediaAttachments: [],
  notes: "",
  questionNotes: { "indicator[X][Y]": "Optional observation" },
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

When signed in with an unfinished assessment saved on the device, the Home tab
offers actions to delete it or continue it. If a completed assessment is waiting
to sync and the server is reachable, Home also offers the same sync operation as
the Export tab.

Question notes are saved with the assessment as they are entered. The final screen
also saves optional assessment-wide notes locally and marks the assessment for
sync. Both kinds of notes appear in the admin assessment detail after sync.
The attachment uploader syncs the completed assessment before uploading files,
then verifies that sync succeeded. It currently accepts images and PDFs only.
The upload step stays available after a reload until the user chooses to skip
to Reports.

Each assessment question also has a final “Not applicable” option. It is excluded
from the category score and confidence denominator; unanswered applicable questions
remain in the confidence denominator.

The Home tab shows the login form when signed out and the welcome section only
when signed in. The market-information wizard works offline with a previously
signed-in account,
stores the information with the assessment, and uses the signed-in user's profile
as lead assessor when available. Markets belong to their creators; new offline
markets are matched or created within that user's markets when assessments are synced, which
assigns the permanent market ID and sequence number.
Selecting an existing market prefills its identification and the setting, GPS,
other assessors and general notes from its latest synced assessment. Review and
update these details for the new visit. The lead assessor comes from the current
account, and the next sequence is estimated locally until sync. Previously fetched
market details are available offline while signed in as the same user. Market
caches and wizard drafts are separated by account; old shared caches are not
reused. An anonymous wizard draft is moved to the account on login only if that
account has no draft already; otherwise it remains available after logout.
Older unscoped wizard drafts are not reused because their ownership cannot be
established. Local assessments themselves remain stored on the device and are
not isolated between accounts on a shared device. Loading the app offline also
requires its files to be available: there is no service worker.

### Authentication Required

Before syncing, users must:
1. Register an account or login
2. Stay logged in (JWT token stored in localStorage)
3. Backend server must be running and accessible

See [../back/README.md](../back/README.md) for backend setup instructions.

### Future Enhancements

- Login/register UI in frontend (currently backend only)
- Maybe: Download assessments from server to device
