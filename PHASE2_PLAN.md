# Phase 2 Implementation Plan

## Overview
Transform the client-side MVP into an offline-first, server-synced application with enhanced UX and admin capabilities.

## Technical Stack
- **Frontend**: Vanilla JS (maintain no-build approach)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (assessments stored as JSONB)
- **Auth**: Username/password with session/JWT
- **Deployment**: Hetzner Cloud

## Feature Implementation Order

### 1. Question-per-Screen Navigation + Progress Saving ⏱️ ~2-3 days

#### Frontend Changes
- **Refactor assessment form**: Convert from slider-based multi-question to single-question per screen
- **Navigation UI**:
  - Previous/Next buttons
  - Progress bar with percentage (e.g., "45% - 27 of 60")
  - Category indicator (show current category name)
  - Optional: Question list sidebar for jumping
- **Progress persistence**:
  - Save to localStorage after each answer
  - Add `lastQuestionIndex` to assessment data
  - On load, resume from last question or start fresh
- **Remove required validation**: All questions optional

#### Data Structure Changes
```javascript
// Enhanced assessment structure
{
  id: "assessment_YYYYMMDD_HHMMSS",
  contactInfo: { fullName, email, location },
  scores: { "indicator[catIdx][indIdx]": scoreValue }, // Can be undefined/null
  progress: {
    currentQuestionIndex: 12,
    totalQuestions: 60,
    lastUpdated: "ISO date"
  },
  mediaAttachments: [], // For future
  notes: "",            // For future
  created: "ISO date",
  synced: false,        // Sync status flag
  version: 1            // Question set version
}
```

#### Files to Modify
- `js/mmt.js`: Rewrite `generate_assessment_form()` for single-question display
- `js/app.js`: Add progress tracking logic
- `css/styles.css`: New styles for progress bar and navigation
- `index.html`: Update assessment panel structure

---

### 2. Optional Answers + Confidence Scoring ⏱️ ~1 day

#### Logic Changes
- Modify `calculate_percentage()` to handle missing answers:
  ```javascript
  function calculate_percentage(scores, catX) {
    let indicators = indicators[catX];
    let answeredCount = 0;
    let totalScore = 0;
    
    indicators.forEach((ind, indX) => {
      let label = "indicator["+catX+"]["+indX+"]";
      let score = scores[label];
      if (score !== undefined && score !== null) {
        answeredCount++;
        totalScore += parseInt(score);
      }
    });
    
    if (answeredCount === 0) return { percentage: 0, confidence: 0 };
    
    let percentage = Math.round((totalScore * 100) / (4 * answeredCount));
    let confidence = Math.round((answeredCount * 100) / indicators.length);
    
    return { percentage, confidence };
  }
  ```

#### Display Changes
- Update reports table to show confidence per category
- Add confidence column: "Category | Score | Confidence | Prev 1 | Prev 2"
- Color-code confidence like scores (red <20%, yellow 40-60%, green 80%+)

#### Files to Modify
- `js/mmt.js`: Update scoring functions
- `index.html`: Add confidence column to reports table
- `css/styles.css`: Confidence styling

---

### 3. Backend Setup + Authentication ⏱️ ~3-4 days

#### Backend Structure
```
server/
├── package.json
├── server.js              # Express app entry
├── config/
│   └── db.js             # PostgreSQL connection
├── middleware/
│   └── auth.js           # Auth middleware
├── routes/
│   ├── auth.js           # Login/logout/register
│   ├── assessments.js    # CRUD for assessments
│   ├── questions.js      # Get question sets
│   └── admin.js          # Admin operations
├── models/
│   ├── User.js
│   ├── Assessment.js
│   └── QuestionSet.js
└── migrations/
    └── 001_initial_schema.sql
```

#### Database Schema
```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(20) DEFAULT 'user', -- 'user' or 'admin'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Question sets (versioned)
CREATE TABLE question_sets (
  id SERIAL PRIMARY KEY,
  version INTEGER NOT NULL,
  categories JSONB NOT NULL,
  indicators JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Assessments (synced from clients)
CREATE TABLE assessments (
  id VARCHAR(50) PRIMARY KEY,  -- assessment_YYYYMMDD_HHMMSS
  user_id INTEGER REFERENCES users(id),
  data JSONB NOT NULL,  -- Full assessment object
  question_set_version INTEGER NOT NULL,
  created_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Media attachments
CREATE TABLE media (
  id SERIAL PRIMARY KEY,
  assessment_id VARCHAR(50) REFERENCES assessments(id),
  filename VARCHAR(255),
  filepath VARCHAR(500),
  file_type VARCHAR(50),
  file_size INTEGER,
  uploaded_at TIMESTAMP DEFAULT NOW()
);
```

#### API Endpoints
```
POST   /api/auth/register          # Register new user
POST   /api/auth/login             # Login (returns JWT/session)
POST   /api/auth/logout            # Logout
GET    /api/auth/me                # Get current user

GET    /api/questions/latest       # Get latest question set
GET    /api/questions/:version     # Get specific version

POST   /api/assessments            # Upload assessment(s)
GET    /api/assessments            # List user's assessments
GET    /api/assessments/:id        # Get specific assessment

POST   /api/media                  # Upload media file
GET    /api/media/:id              # Download media file

-- Admin only --
POST   /api/admin/questions        # Create new question set
PUT    /api/admin/questions/:id    # Update question set
GET    /api/admin/users            # List all users
```

#### Frontend Changes
- Add login/register screen (new tab or modal)
- Store JWT token in localStorage
- Add `isOnline` detection
- Show login status in header

#### Files to Create/Modify
- NEW: `server/` directory with all backend code
- NEW: `js/api.js` - API client for server communication
- `js/app.js`: Add auth state management
- `index.html`: Add login UI elements

---

### 4. Sync Mechanism ⏱️ ~2-3 days

#### Sync Strategy
- **Offline-first**: All operations work without server
- **Background sync**: Upload when connection detected
- **Conflict-free**: No server-side edits (server is read-only for assessments)

#### Sync Logic
```javascript
// js/sync.js
async function syncAssessments() {
  if (!navigator.onLine || !isLoggedIn()) return;
  
  let assessmentList = JSON.parse(localStorage.getItem('assessment_list') || '[]');
  let unsyncedIds = assessmentList.filter(id => {
    let assessment = JSON.parse(localStorage.getItem(id));
    return !assessment.synced;
  });
  
  for (let id of unsyncedIds) {
    let assessment = JSON.parse(localStorage.getItem(id));
    try {
      await fetch('/api/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(assessment)
      });
      
      // Mark as synced
      assessment.synced = true;
      localStorage.setItem(id, JSON.stringify(assessment));
    } catch (err) {
      console.error('Sync failed for', id, err);
    }
  }
  
  updateSyncStatus();
}

// Auto-sync on network change
window.addEventListener('online', syncAssessments);
```

#### UI Changes
- Export screen shows: "X assessments pending sync"
- Manual "Sync Now" button
- Sync indicator icon in header (✓ synced, ⏳ pending, ⚠️ failed)

#### Files to Create/Modify
- NEW: `js/sync.js` - Sync engine
- `js/app.js`: Hook sync events
- `index.html`: Add sync status UI in export panel

---

### 5. Media Upload ⏱️ ~2 days

#### Frontend Changes
- Add media upload section at end of assessment
- Support: Images (jpg, png), PDFs, external links
- Show upload progress
- Store metadata in localStorage until synced

#### Backend Changes
- File upload endpoint with 100MB limit
- Store files in `server/uploads/`
- Return file ID and URL

#### Data Structure
```javascript
{
  ...assessment,
  mediaAttachments: [
    {
      id: "local_123",           // Local ID until synced
      serverId: 456,             // Server ID after sync
      type: "image",             // image, pdf, link
      filename: "photo.jpg",
      url: "/uploads/...",       // Server URL
      size: 1024000,
      uploadedAt: "ISO date"
    }
  ],
  notes: "Additional observations..."
}
```

#### Files to Create/Modify
- `js/mmt.js`: Add media upload UI and logic
- `server/routes/media.js`: Media upload endpoint
- `index.html`: Media section in assessment panel

---

### 6. Admin Screen ⏱️ ~2-3 days

#### Admin UI
- New tab: "Admin" (only visible for role=admin)
- CRUD for categories and indicators
- Version management: Create new question set version
- User management: View users, change roles

#### Question Set Versioning
- Each edit creates new version (immutable history)
- Clients fetch latest on login
- localStorage stores current version number
- If version mismatch detected, download new questions

#### Files to Create/Modify
- NEW: `js/admin.js` - Admin panel logic
- `server/routes/admin.js`: Admin API endpoints
- `index.html`: Add admin tab panel
- `css/styles.css`: Admin UI styles

---

## Migration Strategy

### Phase 1 → Phase 2 Data Migration
```javascript
// Run once on app load to upgrade existing assessments
function migratePhase1Data() {
  let assessmentList = JSON.parse(localStorage.getItem('assessment_list') || '[]');
  
  assessmentList.forEach(id => {
    let assessment = JSON.parse(localStorage.getItem(id));
    
    // Add Phase 2 fields if missing
    if (!assessment.progress) {
      assessment.progress = {
        currentQuestionIndex: getTotalQuestions() - 1, // Mark as complete
        totalQuestions: getTotalQuestions(),
        lastUpdated: assessment.created
      };
    }
    
    if (assessment.synced === undefined) {
      assessment.synced = false;
    }
    
    if (!assessment.version) {
      assessment.version = 1;
    }
    
    if (!assessment.mediaAttachments) {
      assessment.mediaAttachments = [];
    }
    
    if (assessment.notes === undefined) {
      assessment.notes = "";
    }
    
    localStorage.setItem(id, JSON.stringify(assessment));
  });
}
```

---

## Testing Checklist

### Feature 1: Question Navigation
- [ ] Next/Previous navigation works
- [ ] Progress saves after each answer
- [ ] Progress bar updates correctly
- [ ] Can resume from last question
- [ ] Can skip questions (no validation errors)
- [ ] Can jump to specific question

### Feature 2: Confidence Scoring
- [ ] Confidence calculates correctly for partial answers
- [ ] Displays in reports table
- [ ] Color-codes appropriately
- [ ] Works with 0 answers (shows 0% confidence)

### Feature 3: Backend + Auth
- [ ] User registration works
- [ ] Login/logout works
- [ ] JWT token stored and sent with requests
- [ ] Protected routes require authentication
- [ ] Admin routes require admin role

### Feature 4: Sync
- [ ] Detects online/offline status
- [ ] Syncs assessments when online
- [ ] Shows sync status correctly
- [ ] Handles sync failures gracefully
- [ ] Manual sync button works

### Feature 5: Media Upload
- [ ] Can upload images
- [ ] Can upload PDFs
- [ ] Can add external links
- [ ] 100MB limit enforced
- [ ] Files downloadable from server
- [ ] Sync includes media files

### Feature 6: Admin Screen
- [ ] Admin tab only visible to admins
- [ ] Can create/edit categories
- [ ] Can create/edit indicators
- [ ] Version increments on change
- [ ] Clients detect version mismatch
- [ ] Can manage users

---

## Development Notes

### Maintaining No-Build Philosophy
- Keep vanilla JS, no transpilation
- Use ES6 modules if needed: `<script type="module">`
- All backend dependencies managed via npm (backend only)

### Deployment
- **Frontend**: Static files served by Express or nginx
- **Backend**: Node.js process (PM2 recommended)
- **Database**: PostgreSQL on Hetzner
- **Files**: Stored on server filesystem

### Security Considerations
- Password hashing: bcrypt
- JWT token expiration: 24h
- HTTPS required in production
- File upload validation (MIME type, size)
- SQL injection prevention: Use parameterized queries
- XSS prevention: Sanitize user inputs

---

## Estimated Timeline
- Feature 1: 2-3 days
- Feature 2: 1 day
- Feature 3: 3-4 days
- Feature 4: 2-3 days
- Feature 5: 2 days
- Feature 6: 2-3 days
- Testing + Polish: 2-3 days

**Total: ~15-20 days** (3-4 weeks at normal pace)
