// Sync Engine for MMT Assessment Tool
// Handles synchronization of assessments with the server

// Sync status tracking
let syncStatus = {
  pending: 0,
  synced: 0,
  failed: 0,
  isSyncing: false,
  serverOnline: false,
  lastCheck: null
};

// Server health check cache (avoid too many requests)
const SERVER_CHECK_CACHE_MS = 30000; // 30 seconds

// Check if server is actually reachable
async function checkServerStatus() {
  // Use cached result if recent
  if (syncStatus.lastCheck && (Date.now() - syncStatus.lastCheck) < SERVER_CHECK_CACHE_MS) {
    return syncStatus.serverOnline;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch('/api/health', {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    syncStatus.serverOnline = response.ok;
    syncStatus.lastCheck = Date.now();
    
    return response.ok;
  } catch (error) {
    console.log('Server health check failed:', error.message);
    syncStatus.serverOnline = false;
    syncStatus.lastCheck = Date.now();
    return false;
  }
}

// Get all unsynced assessment IDs
function getUnsyncedAssessments() {
  const assessmentList = JSON.parse(localStorage.getItem('assessment_list') || '[]');
  return assessmentList.filter(id => {
    const assessment = JSON.parse(localStorage.getItem(id) || '{}');
    return !assessment.synced;
  });
}

// Update sync status display
async function updateSyncStatus() {
  const unsyncedIds = getUnsyncedAssessments();
  syncStatus.pending = unsyncedIds.length;
  
  // Check server status
  const serverOnline = await checkServerStatus();
  
  // Update UI elements
  const statusText = document.getElementById('sync-status-text');
  const syncButton = document.getElementById('sync-button');
  const syncIcon = document.getElementById('sync-icon');
  
  if (statusText) {
    if (syncStatus.pending > 0) {
      statusText.textContent = `${syncStatus.pending} assessment${syncStatus.pending > 1 ? 's' : ''} pending sync`;
      statusText.className = 'sync-status warning';
    } else {
      statusText.textContent = 'All assessments synced';
      statusText.className = 'sync-status success';
    }
  }
  
  if (syncButton) {
    const isLoggedIn = typeof window.isLoggedIn === 'function' ? window.isLoggedIn() : false;
    const canSync = serverOnline && isLoggedIn && syncStatus.pending > 0 && !syncStatus.isSyncing;

    // Keep login CTA clickable when unauthenticated.
    syncButton.disabled = isLoggedIn ? !canSync : false;
    
    if (syncStatus.isSyncing) {
      syncButton.textContent = 'Syncing...';
    } else if (!serverOnline) {
      syncButton.textContent = 'Server Offline';
    } else if (!isLoggedIn) {
      syncButton.textContent = 'Login required';
    } else if (syncStatus.pending === 0) {
      syncButton.textContent = 'All Synced';
    } else {
      syncButton.textContent = `Send to Server (${syncStatus.pending})`;
    }
  }
  
  if (syncIcon) {
    if (!serverOnline) {
      syncIcon.textContent = '⚠️';
      syncIcon.title = 'Server offline';
    } else if (syncStatus.pending > 0) {
      syncIcon.textContent = '⏳';
      syncIcon.title = `${syncStatus.pending} assessment(s) pending sync`;
    } else {
      syncIcon.textContent = '✓';
      syncIcon.title = 'All synced';
    }
  }
}

// Sync all unsynced assessments
async function syncAssessments() {
  // Check if server is reachable
  const serverOnline = await checkServerStatus();
  if (!serverOnline) {
    console.log('Cannot sync: server offline or unreachable');
    showSyncMessage('Cannot reach server - check connection', 'error');
    return { success: false, message: 'Server offline' };
  }
  
  if (typeof window.isLoggedIn !== 'function' || !window.isLoggedIn()) {
    console.log('Cannot sync: not logged in');
    showSyncMessage('Please login to sync assessments', 'error');
    return { success: false, message: 'Not logged in' };
  }
  
  syncStatus.isSyncing = true;
  await updateSyncStatus();
  
  const unsyncedIds = getUnsyncedAssessments();
  
  if (unsyncedIds.length === 0) {
    syncStatus.isSyncing = false;
    await updateSyncStatus();
    showSyncMessage('No assessments to sync', 'info');
    return { success: true, synced: 0 };
  }
  
  const results = {
    uploaded: [],
    failed: []
  };
  
  // Sync each assessment
  for (const id of unsyncedIds) {
    try {
      const assessment = JSON.parse(localStorage.getItem(id));
      
      // Make API call
      const response = await AssessmentAPI.sync(assessment);
      
      // Mark as synced
      assessment.synced = true;
      assessment.syncedAt = new Date().toISOString();
      localStorage.setItem(id, JSON.stringify(assessment));
      
      results.uploaded.push(id);
      syncStatus.synced++;
      
      console.log(`Synced assessment: ${id}`);
    } catch (error) {
      console.error(`Failed to sync assessment ${id}:`, error);
      results.failed.push({ id, error: error.message });
      syncStatus.failed++;
    }
  }
  
  syncStatus.isSyncing = false;
  await updateSyncStatus();
  
  // Show result message
  if (results.uploaded.length > 0) {
    showSyncMessage(
      `Successfully synced ${results.uploaded.length} assessment${results.uploaded.length > 1 ? 's' : ''}`,
      'success'
    );
  }
  
  if (results.failed.length > 0) {
    showSyncMessage(
      `Failed to sync ${results.failed.length} assessment${results.failed.length > 1 ? 's' : ''}`,
      'error'
    );
  }
  
  return {
    success: results.failed.length === 0,
    uploaded: results.uploaded,
    failed: results.failed
  };
}

// Show sync message to user
function showSyncMessage(message, type = 'info') {
  const messageEl = document.getElementById('sync-message');
  if (messageEl) {
    messageEl.textContent = message;
    messageEl.className = `sync-message ${type}`;
    messageEl.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 5000);
  } else {
    // Fallback to console if no message element
    console.log(`[Sync ${type}] ${message}`);
  }
}

// Initialize sync on page load
function initSync() {
  updateSyncStatus();
  
  // Check server status periodically (every 30 seconds)
  setInterval(() => {
    if (!syncStatus.isSyncing) {
      updateSyncStatus();
    }
  }, 30000);
  
  // Listen for online/offline events (recheck server immediately)
  window.addEventListener('online', async () => {
    console.log('Network connected - checking server status');
    syncStatus.lastCheck = null; // Clear cache to force recheck
    await updateSyncStatus();
  });
  
  window.addEventListener('offline', async () => {
    console.log('Network disconnected');
    syncStatus.serverOnline = false;
    await updateSyncStatus();
  });
  
  // Listen for localStorage changes (if assessment added/deleted)
  window.addEventListener('storage', (e) => {
    if (e.key === 'assessment_list' || e.key && e.key.startsWith('assessment_')) {
      updateSyncStatus();
    }
  });
  
  // Hook up sync button
  const syncButton = document.getElementById('sync-button');
  if (syncButton) {
    syncButton.addEventListener('click', async () => {
      const isLoggedIn = typeof window.isLoggedIn === 'function' ? window.isLoggedIn() : false;
      if (!isLoggedIn) {
        if (typeof window.openFrontendLoginScreen === 'function') {
          window.openFrontendLoginScreen();
        }
        return;
      }
      await syncAssessments();
    });
  }
}

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSync);
} else {
  initSync();
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    syncAssessments,
    updateSyncStatus,
    getUnsyncedAssessments,
    initSync
  };
}
