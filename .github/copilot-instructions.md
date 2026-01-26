# MMT Assessment Tool - AI Coding Guide

## Project Overview
This is a **client-side only** assessment tool for evaluating market management and biosecurity practices. The app uses vanilla JavaScript with no build pipeline - all code runs directly in the browser with localStorage as the only persistence layer.

## Architecture

### Data Storage Strategy
- **localStorage** is the database - assessment data persists client-side only
- Assessment IDs follow format: `assessment_YYYYMMDD_HHMMSS`
- Index stored at key `assessment_list` contains array of assessment IDs
- Contact info stored at key `contactInfo`
- Each assessment stored individually with its ID as the key

### File Responsibilities
- [js/app.js](../js/app.js): Tab navigation, settings persistence, UI initialization
- [js/mmt.js](../js/mmt.js): Assessment form generation, scoring logic, reports, Excel export
- [index.html](../index.html): Single-page app with 4 tab panels (Home, Assessment, Reports, Export)
- [css/styles.css](../css/styles.css): Mobile-first responsive styling with CSS custom properties

### Key Libraries (all vendored/CDN)
- **Umbrella JS** (`u()` selector): jQuery-like DOM manipulation
- **Chart.js**: Radar and bar graph visualizations
- **SheetJS (XLSX)**: Excel export functionality
- **Swiffy Slider**: Category navigation in assessment form

## Development Workflow

### Running Locally
```bash
npm run start  # Uses live-server
# OR open index.html directly in browser (if you have a webserver running)
```

### Assessment Data Structure
```javascript
{
  contactInfo: { fullName, email, location },
  scores: { "indicator[catIdx][indIdx]": scoreValue }, // 1-4 scale
  created: "ISO date string"
}
```

### Scoring System
- 9 categories (governance, infrastructure, biosecurity, etc.)
- Each category has 5-6 indicators
- Each indicator scored 1-4 (4 = best practices)
- Percentage calculated: `(total_score * 100) / (4 * num_indicators)`
- Warning levels: <20% red, 20-40% orange, 40-60% yellow, 60-80% light green, 80%+ green

## Important Patterns

### Tab Management
- ARIA-compliant tab navigation (roles, aria-selected, aria-controls)
- Keyboard navigation intentionally disabled to avoid conflicts with slider

### Form Validation
- Assessment tab only enables when all 3 contact fields filled
- Settings auto-save to localStorage on change via `save_settings()`

### Reports Generation
Displays last 3 assessments in table and charts:
```javascript
generateScoretable() // Fetches last 3 from assessment_list
→ render_scoretable() // Builds HTML table
→ render_radargraph() // Chart.js radar
→ render_bargraph()   // Chart.js bar
```

### Excel Export
- Converts assessments to 2D array with category headers
- Uses cell merges for multi-column category labels
- Filename: `mmt_assessments.xlsx`

## Common Modifications

### Adding Indicators
Edit [js/mmt.js](../js/mmt.js) `indicators` array - each category is an array of objects:
```javascript
indicators[categoryIndex].push({
  name: 'Indicator name',
  scores: ['Score 1 desc', 'Score 2 desc', 'Score 3 desc', 'Score 4 desc']
});
```

### Styling Changes
- Colors defined in [css/styles.css](../css/styles.css) `:root` as CSS custom properties
- Warning level colors: `--warning1` through `--warning5`
- Mobile-first: base styles for mobile, `@media(min-width:640px)` for desktop

### Data Reset
`delete_assessments()` calls `localStorage.clear()` - wipes ALL data including contact info

## Technical Constraints
- No transpilation/bundling - ES5-compatible syntax only
- All dependencies vendored or loaded via `<script>` tags
- No async data fetching - localStorage is synchronous
- Form uses `onsubmit="return false;"` to prevent page reload

---

## Phase 2 Development (In Progress)

### New Architecture
- **Offline-first**: All features work without network, sync when available
- **Backend**: Node.js/Express + PostgreSQL (on Hetzner Cloud)
- **Auth**: Simple username/password with JWT tokens
- **Sync**: Push assessments to server with eventual consistency
- **Question versioning**: Server manages question set versions, clients auto-update

### Key Changes from Phase 1
1. **Single question per screen** (60+ total) with free navigation
2. **Optional answers** - confidence score tracks completion per-category
3. **Progress auto-save** after each answer to localStorage
4. **Media attachments** (images, PDFs, external links) at end of assessment
5. **Admin screen** for role-based question/category management
6. **Sync status** shown in export screen

### New Data Structure
```javascript
{
  id: "assessment_YYYYMMDD_HHMMSS",
  contactInfo: { fullName, email, location },
  scores: { "indicator[catIdx][indIdx]": scoreValue }, // Can be undefined
  progress: { currentQuestionIndex, totalQuestions, lastUpdated },
  mediaAttachments: [{ type, filename, url, size }],
  notes: "string",
  synced: false,
  version: 1
}
```

### Development Priority
1. Question navigation + progress persistence
2. Confidence scoring for partial completion
3. Backend API + authentication
4. Sync mechanism
5. Media upload
6. Admin panel

See [PHASE2_PLAN.md](../PHASE2_PLAN.md) for detailed implementation roadmap.
