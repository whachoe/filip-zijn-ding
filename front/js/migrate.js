// Migration script: Add Phase 2 fields to existing Phase 1 assessments
// Run once on app load to upgrade existing assessments in localStorage

function migratePhase1Data() {
    console.log('Checking for Phase 1 data to migrate...');
    
    let assessmentList = JSON.parse(localStorage.getItem('assessment_list') || '[]');
    let migratedCount = 0;
    
    assessmentList.forEach(id => {
        let assessment = JSON.parse(localStorage.getItem(id) || '{}');
        let needsUpdate = false;
        
        // Add synced flag if missing (default to false - needs sync)
        if (assessment.synced === undefined) {
            assessment.synced = false;
            needsUpdate = true;
        }
        
        // Add version if missing
        if (!assessment.version) {
            assessment.version = 1;
            needsUpdate = true;
        }
        
        // Add progress if missing (mark old assessments as complete)
        if (!assessment.progress) {
            // Count total questions
            const totalQuestions = indicators.reduce((total, cat) => total + cat.length, 0);
            
            assessment.progress = {
                currentQuestionIndex: totalQuestions - 1, // Mark as complete
                totalQuestions: totalQuestions,
                lastUpdated: assessment.created || new Date().toISOString(),
                completed: true,
                completedAt: assessment.created || new Date().toISOString()
            };
            needsUpdate = true;
        }
        
        // Add mediaAttachments if missing
        if (!assessment.mediaAttachments) {
            assessment.mediaAttachments = [];
            needsUpdate = true;
        }
        
        // Add notes if missing
        if (assessment.notes === undefined) {
            assessment.notes = "";
            needsUpdate = true;
        }
        
        // Save if updated
        if (needsUpdate) {
            localStorage.setItem(id, JSON.stringify(assessment));
            migratedCount++;
        }
    });
    
    if (migratedCount > 0) {
        console.log(`✓ Migrated ${migratedCount} assessment(s) to Phase 2 format`);
    } else {
        console.log('✓ No migration needed - all assessments up to date');
    }
}

// Run migration on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait for indicators to be available
        setTimeout(migratePhase1Data, 100);
    });
} else {
    setTimeout(migratePhase1Data, 100);
}
