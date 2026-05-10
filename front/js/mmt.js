    const defaultQuestionData = window.MMT_QUESTION_DATA || { categories: [], indicators: [] };
    let categories = defaultQuestionData.categories;
    let indicators = defaultQuestionData.indicators;

    function getCurrentQuestionVersion() {
        const version = parseInt(localStorage.getItem('question_set_version') || '1', 10);
        return isNaN(version) ? 1 : version;
    }

    function applyStoredQuestionSet() {
        const storedQuestionSet = localStorage.getItem('question_set_data');

        if (!storedQuestionSet) {
            localStorage.setItem('question_set_version', String(getCurrentQuestionVersion()));
            return;
        }

        try {
            const parsed = JSON.parse(storedQuestionSet);
            if (Array.isArray(parsed.categories) && Array.isArray(parsed.indicators) && parsed.categories.length === parsed.indicators.length) {
                categories = parsed.categories;
                indicators = parsed.indicators;
            }
        } catch (error) {
            console.warn('Could not load stored question set:', error);
        }
    }

    function getCurrentQuestionSet() {
        return JSON.parse(JSON.stringify({
            version: getCurrentQuestionVersion(),
            categories: categories,
            indicators: indicators
        }));
    }

    window.getCurrentQuestionSet = getCurrentQuestionSet;

    function refreshQuestionnaire() {
        document.getElementById('new_assessment_wrapper').innerHTML = generate_assessment_form(categories, indicators);
        initAssessmentNavigation();
        refreshReports();
    }

    window.refreshQuestionnaire = refreshQuestionnaire;

    applyStoredQuestionSet();

    // Build flat list of all questions with category context
    function buildQuestionList(categories, indicators) {
        let questions = [];
        categories.forEach((category, catIdx) => {
            indicators[catIdx].forEach((indicator, indIdx) => {
                questions.push({
                    categoryIndex: catIdx,
                    categoryName: category,
                    indicatorIndex: indIdx,
                    indicatorName: indicator.name,
                    scores: indicator.scores
                });
            });
        });
        return questions;
    }

    // Global state for navigation
    let currentQuestionIndex = 0;
    let allQuestions = [];
    let currentAssessmentId = null;
    let swipeBoundElement = null;
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeStartTime = 0;

    function generate_assessment_form(categories, indicators) {
        allQuestions = buildQuestionList(categories, indicators);
        
        let html = `
          <div id="assessment-container">
            <!-- Progress Bar -->
            <div class="progress-container">
              <div class="progress-info">
                <span id="progress-text">Question 1 of ${allQuestions.length}</span>
                <span id="progress-percentage">0%</span>
              </div>
              <div class="progress-bar-track">
                <div id="progress-bar-fill" class="progress-bar-fill" style="width: 0%"></div>
              </div>
              <div id="category-indicator" class="category-indicator">${allQuestions[0].categoryName}</div>
            </div>

            <!-- Question Display -->
            <form id="assessment-form">
              <div id="question-container"></div>
              
              <!-- Navigation Buttons -->
              <div class="question-nav">
                <button type="button" id="prev-btn" class="nav-btn" disabled>Previous</button>
                <button type="button" id="next-btn" class="nav-btn">Next</button>
                <button type="button" id="finish-btn" class="nav-btn save-btn" style="display:none;">Finish Assessment</button>
              </div>
            </form>
          </div>`;

        return html;
    }

    function renderQuestion(index) {
        if (index < 0 || index >= allQuestions.length) return;
        
        const question = allQuestions[index];
        const questionContainer = document.getElementById('question-container');
        if (!questionContainer) return;
        const fieldName = `indicator[${question.categoryIndex}][${question.indicatorIndex}]`;
        
        let html = `
          <fieldset class="question-fieldset">
            <h3 class="indicator-label">${question.indicatorName}</h3>
            <div class="score-options">`;
        
        question.scores.forEach((score, scoreIdx) => {
            const inputId = `q-${index}-score-${scoreIdx}`;
            const value = scoreIdx + 1;
            html += `
              <div class="score-option">
                <input type="radio" 
                       id="${inputId}" 
                       name="${fieldName}" 
                       value="${value}" 
                       class="score-radio">
                <label for="${inputId}" class="score-label">
                  <span class="score-number">${value}</span>
                  <span class="score-description">${score}</span>
                </label>
              </div>`;
        });
        
        html += `
            </div>
          </fieldset>`;
        
        questionContainer.innerHTML = html;
        
        // Restore previously saved answer if exists
        const savedAnswer = getAssessmentProgress();
        if (savedAnswer && savedAnswer.scores && savedAnswer.scores[fieldName]) {
            const savedValue = savedAnswer.scores[fieldName];
            const radioToCheck = document.querySelector(`input[name="${fieldName}"][value="${savedValue}"]`);
            if (radioToCheck) radioToCheck.checked = true;
        }
        
        // Add change listener to save progress, and click-to-deselect support
        const radios = questionContainer.querySelectorAll('.score-radio');
        radios.forEach(radio => {
            const markWasChecked = function() {
                radio._wasChecked = radio.checked;
            };

            radio.addEventListener('mousedown', markWasChecked);
            radio.addEventListener('pointerdown', markWasChecked);

            const label = questionContainer.querySelector(`label[for="${radio.id}"]`);
            if (label) {
                label.addEventListener('mousedown', markWasChecked);
                label.addEventListener('pointerdown', markWasChecked);
            }

            radio.addEventListener('click', function() {
                if (this._wasChecked) {
                    this.checked = false;
                    deleteScoreAndSave(this.name);
                    this._wasChecked = false;
                }
            });
            radio.addEventListener('change', () => saveProgress());
        });
    }

    function updateProgressBar() {
        const progressText = document.getElementById('progress-text');
        const progressPercentage = document.getElementById('progress-percentage');
        const progressFill = document.getElementById('progress-bar-fill');
        const categoryIndicator = document.getElementById('category-indicator');
        
        const current = currentQuestionIndex + 1;
        const total = allQuestions.length;
        const percentage = Math.round((current / total) * 100);
        
        progressText.textContent = `Question ${current} of ${total}`;
        progressPercentage.textContent = `${percentage}%`;
        progressFill.style.width = `${percentage}%`;
        categoryIndicator.textContent = allQuestions[currentQuestionIndex].categoryName;
    }

    function updateNavigationButtons() {
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const finishBtn = document.getElementById('finish-btn');
        
        // Enable/disable previous button
        prevBtn.disabled = currentQuestionIndex === 0;
        
        // Show finish button on last question, hide next button
        if (currentQuestionIndex === allQuestions.length - 1) {
            nextBtn.style.display = 'none';
            finishBtn.style.display = 'inline-block';
        } else {
            nextBtn.style.display = 'inline-block';
            finishBtn.style.display = 'none';
        }
    }

    function navigateToQuestion(index) {
        if (index < 0 || index >= allQuestions.length) return;
        
        currentQuestionIndex = index;
        renderQuestion(index);
        updateProgressBar();
        updateNavigationButtons();
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function bindSwipeNavigation() {
        const questionContainer = document.getElementById('question-container');
        if (!questionContainer) return;

        if (swipeBoundElement === questionContainer) {
            return;
        }

        if (swipeBoundElement) {
            swipeBoundElement.removeEventListener('touchstart', handleSwipeTouchStart);
            swipeBoundElement.removeEventListener('touchend', handleSwipeTouchEnd);
            swipeBoundElement.removeEventListener('touchcancel', handleSwipeTouchCancel);
        }

        swipeBoundElement = questionContainer;
        swipeBoundElement.addEventListener('touchstart', handleSwipeTouchStart, { passive: true });
        swipeBoundElement.addEventListener('touchend', handleSwipeTouchEnd, { passive: true });
        swipeBoundElement.addEventListener('touchcancel', handleSwipeTouchCancel, { passive: true });
    }

    function handleSwipeTouchStart(event) {
        if (!event.touches || event.touches.length !== 1) return;

        swipeStartX = event.touches[0].clientX;
        swipeStartY = event.touches[0].clientY;
        swipeStartTime = Date.now();
    }

    function handleSwipeTouchEnd(event) {
        if (!event.changedTouches || event.changedTouches.length === 0) return;

        const endX = event.changedTouches[0].clientX;
        const endY = event.changedTouches[0].clientY;
        const deltaX = endX - swipeStartX;
        const deltaY = endY - swipeStartY;
        const elapsed = Date.now() - swipeStartTime;

        const minHorizontalDistance = 60;
        const maxVerticalDistance = 50;
        const maxDurationMs = 800;

        if (Math.abs(deltaX) < minHorizontalDistance) return;
        if (Math.abs(deltaY) > maxVerticalDistance) return;
        if (elapsed > maxDurationMs) return;

        if (deltaX < 0) {
            navigateToQuestion(currentQuestionIndex + 1);
            return;
        }

        navigateToQuestion(currentQuestionIndex - 1);
    }

    function handleSwipeTouchCancel() {
        swipeStartX = 0;
        swipeStartY = 0;
        swipeStartTime = 0;
    }

    function initAssessmentNavigation() {
        // Look for any incomplete assessment in localStorage
        const incompleteAssessment = findIncompleteAssessment();
        
        if (incompleteAssessment) {
            // Resume incomplete assessment
            currentAssessmentId = incompleteAssessment.id;
            const savedIndex = incompleteAssessment.progress && typeof incompleteAssessment.progress.currentQuestionIndex === 'number'
                ? incompleteAssessment.progress.currentQuestionIndex
                : 0;
            currentQuestionIndex = getResumeQuestionIndex(incompleteAssessment, savedIndex);
        } else {
            // Start new assessment
            currentAssessmentId = create_assessment_id();
            currentQuestionIndex = 0;
        }
        
        // Render first question
        renderQuestion(currentQuestionIndex);
        updateProgressBar();
        updateNavigationButtons();
        
        bindAssessmentNavigationHandlers();
    }

    function bindAssessmentNavigationHandlers() {
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const finishBtn = document.getElementById('finish-btn');

        if (!prevBtn || !nextBtn || !finishBtn) return;

        // Clone and replace to remove old listeners
        prevBtn.replaceWith(prevBtn.cloneNode(true));
        nextBtn.replaceWith(nextBtn.cloneNode(true));
        finishBtn.replaceWith(finishBtn.cloneNode(true));

        // Add new listeners
        document.getElementById('prev-btn').addEventListener('click', () => {
            navigateToQuestion(currentQuestionIndex - 1);
        });

        document.getElementById('next-btn').addEventListener('click', () => {
            navigateToQuestion(currentQuestionIndex + 1);
        });

        document.getElementById('finish-btn').addEventListener('click', () => {
            save_assessment();
        });

        bindSwipeNavigation();
    }
    
    function findIncompleteAssessment() {
        // Check all known assessment IDs for any incomplete assessments.
        const assessmentList = getAssessmentIdsNewestFirst();
        
        for (let id of assessmentList) {
            const data = localStorage.getItem(id);
            if (data) {
                const assessment = JSON.parse(data);
                // Return first incomplete assessment found
                if (assessment.progress && !assessment.progress.completed) {
                    return assessment;
                }
            }
        }
        
        return null;
    }
    
    function startNewAssessment() {
        const wrapper = document.getElementById('new_assessment_wrapper');

        // If the upload screen replaced the assessment DOM, rebuild it first.
        if (!document.getElementById('question-container') && wrapper) {
            wrapper.innerHTML = generate_assessment_form(categories, indicators);
            bindAssessmentNavigationHandlers();
        }

        // Prefer resuming latest unsynced assessment; otherwise start fresh.
        const unsyncedAssessment = findLatestUnsyncedAssessment();
        if (unsyncedAssessment) {
            currentAssessmentId = unsyncedAssessment.id;
            const savedIndex = unsyncedAssessment.progress && typeof unsyncedAssessment.progress.currentQuestionIndex === 'number'
                ? unsyncedAssessment.progress.currentQuestionIndex
                : 0;
            currentQuestionIndex = getResumeQuestionIndex(unsyncedAssessment, savedIndex);
        } else {
            currentAssessmentId = create_assessment_id();
            currentQuestionIndex = 0;
        }
        
        // Render fresh state
        renderQuestion(currentQuestionIndex);
        updateProgressBar();
        updateNavigationButtons();
    }

    function getResumeQuestionIndex(assessment, fallbackIndex) {
        const firstUnanswered = findFirstUnansweredQuestionIndex(assessment);
        if (firstUnanswered !== -1) {
            return firstUnanswered;
        }

        if (typeof fallbackIndex === 'number' && fallbackIndex >= 0 && fallbackIndex < allQuestions.length) {
            return fallbackIndex;
        }

        return 0;
    }

    function findFirstUnansweredQuestionIndex(assessment) {
        const scores = assessment && assessment.scores ? assessment.scores : {};

        for (let i = 0; i < allQuestions.length; i++) {
            const question = allQuestions[i];
            const fieldName = `indicator[${question.categoryIndex}][${question.indicatorIndex}]`;
            const answer = scores[fieldName];

            if (answer === undefined || answer === null || answer === '') {
                return i;
            }
        }

        return -1;
    }

    function findLatestUnsyncedAssessment() {
        const assessmentList = getAssessmentIdsNewestFirst();

        for (let i = assessmentList.length - 1; i >= 0; i--) {
            const id = assessmentList[i];
            const data = localStorage.getItem(id);
            if (!data) continue;

            try {
                const assessment = JSON.parse(data);
                if (assessment && assessment.synced === false) {
                    return assessment;
                }
            } catch (error) {
                // Ignore malformed items and continue scanning.
            }
        }

        return null;
    }

    function getAssessmentIdsNewestFirst() {
        let assessmentList = [];

        try {
            const parsed = JSON.parse(localStorage.getItem('assessment_list') || '[]');
            if (Array.isArray(parsed)) {
                assessmentList = parsed;
            }
        } catch (error) {
            assessmentList = [];
        }

        // Include draft IDs that may exist in localStorage but are missing from assessment_list.
        // Assessment IDs follow: assessment_YYYYMMDD_HHMMSS.
        const assessmentIdPattern = /^assessment_\d{8}_\d{6}$/;
        const discoveredIds = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && assessmentIdPattern.test(key)) {
                discoveredIds.push(key);
            }
        }

        const seen = {};
        const merged = [];
        const combined = assessmentList.concat(discoveredIds).sort();
        for (let i = combined.length - 1; i >= 0; i--) {
            const id = combined[i];
            if (!seen[id]) {
                seen[id] = true;
                merged.push(id);
            }
        }

        return merged;
    }

    function getAssessmentProgress() {
        if (!currentAssessmentId) return null;
        const data = localStorage.getItem(currentAssessmentId);
        return data ? JSON.parse(data) : null;
    }

    function deleteScoreAndSave(fieldName) {
        const existing = getAssessmentProgress();
        if (existing && existing.scores) {
            delete existing.scores[fieldName];
        }
        const contactForm = document.getElementById('settings-form');
        const contactData = new FormData(contactForm);
        const assessmentData = {
            id: currentAssessmentId,
            contactInfo: {
                fullName: contactData.get('fullName'),
                email: contactData.get('email'),
                location: contactData.get('location')
            },
            scores: existing ? existing.scores : {},
            progress: {
                currentQuestionIndex: currentQuestionIndex,
                totalQuestions: allQuestions.length,
                lastUpdated: new Date().toISOString()
            },
            created: existing ? existing.created : new Date().toISOString(),
            synced: false,
            version: getCurrentQuestionVersion(),
            mediaAttachments: [],
            notes: ""
        };
        localStorage.setItem(currentAssessmentId, JSON.stringify(assessmentData));
    }

    function saveProgress() {
        const formData = new FormData(document.getElementById('assessment-form'));
        const scores = Object.fromEntries(formData.entries());
        
        // Merge with existing scores
        const existing = getAssessmentProgress();
        const allScores = existing && existing.scores ? {...existing.scores, ...scores} : scores;
        
        const contactForm = document.getElementById('settings-form');
        const contactData = new FormData(contactForm);
        const contactInfo = {
            fullName: contactData.get('fullName'),
            email: contactData.get('email'),
            location: contactData.get('location')
        };
        
        const assessmentData = {
            id: currentAssessmentId,
            contactInfo: contactInfo,
            scores: allScores,
            progress: {
                currentQuestionIndex: currentQuestionIndex,
                totalQuestions: allQuestions.length,
                lastUpdated: new Date().toISOString()
            },
            created: existing ? existing.created : new Date().toISOString(),
            synced: false,
            version: getCurrentQuestionVersion(),
            mediaAttachments: [],
            notes: ""
        };
        
        localStorage.setItem(currentAssessmentId, JSON.stringify(assessmentData));
    }

    function calculate_percentage(scores, catX) {
        let indicators_in_category = indicators[catX];
        let answeredCount = 0;
        let scoreTotal = 0;

        for (i=0; i < indicators_in_category.length; i++) {
            let label = "indicator["+catX+"]["+i+"]";
            let score = scores[label];
            
            // Only count answered questions
            if (score !== undefined && score !== null && score !== '') {
                answeredCount++;
                scoreTotal += parseInt(score);
            }
        }
        
        // If no questions answered in this category, return object with 0 values
        if (answeredCount === 0) return { percentage: 0, confidence: 0 };
        
        // Calculate percentage based on answered questions only
        let percentage = Math.round((scoreTotal * 100) / (4 * answeredCount));
        
        // Calculate confidence (how many questions were answered)
        let confidence = Math.round((answeredCount * 100) / indicators_in_category.length);
        
        return { percentage, confidence };
    }
    
    function generateScoretable() {
        // Fetch the last 3 assessments
        let assessmentList = JSON.parse(localStorage.getItem('assessment_list')) || [];
        // let last3 = assessmentList ? assessmentList.slice(1).slice(-3) : [];
        // console.log("Last 3:", last3);

        let currentId   = assessmentList.pop();    // newest
        let previous2Id = assessmentList.pop();    // middle child
        let previous1Id = assessmentList.pop();    // oldest
        // console.log(currentId, previous2Id, previous1Id);

        let current   = currentId ? JSON.parse(localStorage.getItem(currentId)) : null;
        let previous2 = previous2Id ? JSON.parse(localStorage.getItem(previous2Id)) : null;
        let previous1 = previous1Id ? JSON.parse(localStorage.getItem(previous1Id)) : null;

        let scoretable = [];
        categories.forEach((cat, catX) => {
            scoretable[catX] = [];
            scoretable[catX][0] = cat;
            scoretable[catX][1] = current   ? calculate_percentage(current.scores, catX)   : { percentage: 0, confidence: 0 };
            scoretable[catX][2] = previous2 ? calculate_percentage(previous2.scores, catX) : { percentage: 0, confidence: 0 };
            scoretable[catX][3] = previous1 ? calculate_percentage(previous1.scores, catX) : { percentage: 0, confidence: 0 };
        });

        return scoretable;
    }

    function calculate_warning_level(score) {
        if (score < 20) {
            return "warning1";
        } else if (score < 40) {
            return "warning2";
        } else if (score < 60) {
            return "warning3";
        } else if (score < 80){
            return "warning4";
        } else {
            return "warning5";
        }
    }

    function render_scoretable(scoretable) {
        u('table#reports-scoretable tbody').html('');
        scoretable.forEach((row) => {
            let current = row[1];
            let prev2 = row[2];
            let prev1 = row[3];
            
            let rowHtml = `
            <tr>
                <td>${row[0]}</td>
                <td align="center" class="${calculate_warning_level(current.percentage)}">${current.percentage}% (${current.confidence}%)</td>
                <td align="center" class="${calculate_warning_level(prev2.percentage)}">${prev2.percentage}% (${prev2.confidence}%)</td>
                <td align="center" class="${calculate_warning_level(prev1.percentage)}">${prev1.percentage}% (${prev1.confidence}%)</td>
            </tr>
            `;

            u('table#reports-scoretable tbody').append(rowHtml);
        });
    }

    function render_radargraph(scoretable) {
        const data = {
            labels: categories,
            datasets: [{
                label: 'Current',
                data: scoretable.map(function(value) { return value[1].percentage; }),
                fill: true,
                backgroundColor: '#cc3300',
                borderColor: 'rgb(255, 99, 132)',
                pointBackgroundColor: 'rgb(255, 99, 132)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(255, 99, 132)'
            }, {
                label: 'Previous 1',
                data: scoretable.map(function(value) { return value[2].percentage; }),
                fill: true,
                backgroundColor: '#ff9966',
                borderColor: 'rgb(54, 162, 235)',
                pointBackgroundColor: 'rgb(54, 162, 235)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(54, 162, 235)'
            }, {
                label: 'Previous 2',
                data: scoretable.map(function(value) { return value[3].percentage; }),
                fill: true,
                backgroundColor: '#ffcc00',
                borderColor: 'rgb(54, 162, 235)',
                pointBackgroundColor: 'rgb(54, 162, 235)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(54, 162, 235)'
            }]
            };

        const config = {
            type: 'radar',
            data: data,
            options: {
                elements: {
                    line: {
                        borderWidth: 1
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            },
        };

        const ctx = document.getElementById('radar-graph');
        let chart = Chart.getChart("radar-graph"); 
        if(chart){
            chart.clear();
            chart.destroy();
        }

        const radarChart = new Chart(ctx, config);
    }

    function render_bargraph(scoretable) {        
        const data = {
            labels: categories,
            datasets: [{
                axis: 'y',
                label: 'Current',
                data: scoretable.map(function(value) { return value[1].percentage; }),
                fill: true,
                backgroundColor: '#cc3300',
                borderColor: 'rgb(255, 99, 132)',
                borderWidth: 1
            },
            {
                axis: 'y',
                label: 'Previous 1',
                data: scoretable.map(function(value) { return value[2].percentage; }),
                fill: true,
                backgroundColor: '#ff9966',
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1
            },
            {
                axis: 'y',
                label: 'Previous 2',
                data: scoretable.map(function(value) { return value[3].percentage; }),
                fill: true,
                backgroundColor: '#ffcc00',
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1
            }
        ]};

        const config = {
            type: 'bar',
            data,
            options: {
                plugins: {
                    legend: {
                        display: false
                    }
                },
                indexAxis: 'y',
            }};

        const ctx = document.getElementById('bar-graph');
        let chart = Chart.getChart("bar-graph"); 
        if(chart){
            chart.clear();
            chart.destroy();
        }

        const barChart = new Chart(ctx, config);    
    }



    function refreshReports() {
        // Filling up the Reports tab
        let scoretable = generateScoretable();

        render_scoretable(scoretable)
        render_radargraph(scoretable);
        render_bargraph(scoretable);
    }

    function create_assessment_id(date) {
        const curDate = date || new Date();

        // Format: assessment_YYYYMMDD_HHMMSS
        const year = curDate.getFullYear();
        const month = String(curDate.getMonth() + 1).padStart(2, '0');
        const day = String(curDate.getDate()).padStart(2, '0');
        const hours = String(curDate.getHours()).padStart(2, '0');
        const minutes = String(curDate.getMinutes()).padStart(2, '0');
        const seconds = String(curDate.getSeconds()).padStart(2, '0');
        
        return `assessment_${year}${month}${day}_${hours}${minutes}${seconds}`;
    }

    function save_assessment() {
        // Save final progress
        saveProgress();
        
        const assessmentData = getAssessmentProgress();
        if (!assessmentData) return;
        
        // Mark as complete and set final creation date
        assessmentData.progress.completed = true;
        assessmentData.progress.completedAt = new Date().toISOString();
        assessmentData.created = new Date().toISOString();
        
        // Add sync flag (not synced yet)
        assessmentData.synced = false;
        assessmentData.version = getCurrentQuestionVersion();
        
        localStorage.setItem(currentAssessmentId, JSON.stringify(assessmentData));

        // Add to assessment list if not already there
        let assessmentList = JSON.parse(localStorage.getItem('assessment_list')) || [];
        if (!assessmentList.includes(currentAssessmentId)) {
            assessmentList.push(currentAssessmentId);
            localStorage.setItem("assessment_list", JSON.stringify(assessmentList));
        }

        // Update sync status
        if (typeof updateSyncStatus === 'function') {
            updateSyncStatus();
        }

        if (typeof updateTotalRecords === 'function') {
            updateTotalRecords();
        }

        // Capture finished assessment ID before clearing module state
        var finishedId = currentAssessmentId;

        // Reset for next assessment
        currentAssessmentId = null;
        currentQuestionIndex = 0;

        // Show upload screen instead of immediately going to reports
        showUploadScreen(finishedId);
    }

    function showUploadScreen(finishedAssessmentId) {
        var wrapper = document.getElementById('new_assessment_wrapper');
        wrapper.innerHTML = [
            '<div id="upload-screen" class="upload-screen">',
            '  <h2>Upload Supporting Media</h2>',
            '  <p>Attach photos, PDFs or other documents to your assessment.</p>',
            '  <div id="upload-status" class="upload-status"></div>',
            '  <div id="upload-sync-notice" class="upload-sync-notice"></div>',
            '  <div class="upload-input-row">',
            '    <input id="upload-file-input" type="file" multiple accept="image/*,.pdf">',
            '    <button id="upload-btn" class="mmt-button" disabled>Upload files</button>',
            '  </div>',
            '  <ul id="upload-results" class="upload-results"></ul>',
            '  <div class="upload-actions">',
            '    <button id="upload-skip-btn" class="mmt-button secondary">Skip &ndash; go to Reports</button>',
            '  </div>',
            '</div>'
        ].join('');

        var fileInput = document.getElementById('upload-file-input');
        var uploadBtn = document.getElementById('upload-btn');
        var skipBtn = document.getElementById('upload-skip-btn');
        var statusEl = document.getElementById('upload-status');
        var syncNotice = document.getElementById('upload-sync-notice');
        var resultsList = document.getElementById('upload-results');

        function goToReports() {
            refreshReports();
            u('button#tab-reports').trigger('click');
        }

        function setStatus(msg, type) {
            statusEl.textContent = msg;
            statusEl.className = 'upload-status ' + (type || 'info');
        }

        skipBtn.addEventListener('click', function() {
            var assessment = finishedAssessmentId
                ? JSON.parse(localStorage.getItem(finishedAssessmentId) || 'null')
                : null;

            if (assessment && !assessment.synced && typeof syncAssessments === 'function') {
                skipBtn.disabled = true;
                syncNotice.textContent = 'Syncing assessment to server…';

                checkServerStatus().then(function(online) {
                    if (!online) {
                        syncNotice.textContent = '';
                        goToReports();
                        return;
                    }

                    syncAssessments().then(function() {
                        syncNotice.textContent = '';
                        goToReports();
                    }).catch(function() {
                        syncNotice.textContent = '';
                        goToReports();
                    });
                });
            } else {
                goToReports();
            }
        });

        fileInput.addEventListener('change', function() {
            uploadBtn.disabled = fileInput.files.length === 0;
        });

        uploadBtn.addEventListener('click', function() {
            uploadBtn.disabled = true;
            fileInput.disabled = true;
            skipBtn.disabled = true;
            setStatus('', '');
            syncNotice.textContent = '';

            var assessment = finishedAssessmentId
                ? JSON.parse(localStorage.getItem(finishedAssessmentId) || 'null')
                : null;

            if (!assessment) {
                setStatus('Assessment not found in local storage.', 'error');
                uploadBtn.disabled = false;
                fileInput.disabled = false;
                skipBtn.disabled = false;
                return;
            }

            var doUpload = function(dbAssessmentId) {
                var files = Array.prototype.slice.call(fileInput.files);
                var done = 0;
                var failed = 0;

                function uploadNext(idx) {
                    if (idx >= files.length) {
                        var msg = done + ' file(s) uploaded';
                        if (failed > 0) msg += ', ' + failed + ' failed';
                        setStatus(msg, failed > 0 ? 'warning' : 'success');
                        fileInput.disabled = false;
                        fileInput.value = '';
                        uploadBtn.disabled = true;
                        skipBtn.disabled = false;
                        return;
                    }

                    var file = files[idx];
                    var li = document.createElement('li');
                    li.textContent = file.name + ' …';
                    resultsList.appendChild(li);

                    MediaAPI.upload(file, dbAssessmentId)
                        .then(function(resp) {
                            done++;
                            li.textContent = '✓ ' + file.name;
                            li.className = 'upload-ok';
                            // Store media reference locally
                            var stored = JSON.parse(localStorage.getItem(finishedAssessmentId) || '{}');
                            if (!Array.isArray(stored.mediaAttachments)) stored.mediaAttachments = [];
                            stored.mediaAttachments.push(resp.media);
                            localStorage.setItem(finishedAssessmentId, JSON.stringify(stored));
                        })
                        .catch(function(err) {
                            failed++;
                            li.textContent = '✗ ' + file.name + ' – ' + (err.message || 'Upload failed');
                            li.className = 'upload-fail';
                        })
                        .then(function() {
                            uploadNext(idx + 1);
                        });
                }

                setStatus('Uploading…', 'info');
                uploadNext(0);
            };

            // Ensure the assessment is synced before uploading media
            if (assessment.synced && assessment.syncedAt) {
                // Already synced – the local ID is the DB primary key
                doUpload(finishedAssessmentId);
            } else {
                syncNotice.textContent = 'Syncing assessment to server before uploading…';
                if (typeof syncAssessments === 'function') {
                    syncAssessments().then(function(result) {
                        if (!result.success) {
                            syncNotice.textContent = '';
                            setStatus('Could not sync assessment. Please sync first, then retry.', 'error');
                            uploadBtn.disabled = false;
                            fileInput.disabled = false;
                            skipBtn.disabled = false;
                            return;
                        }
                        syncNotice.textContent = 'Synced. Uploading files…';
                        doUpload(finishedAssessmentId);
                    });
                } else {
                    syncNotice.textContent = '';
                    setStatus('Sync not available. Please log in and sync before uploading.', 'warning');
                    uploadBtn.disabled = false;
                    fileInput.disabled = false;
                    skipBtn.disabled = false;
                }
            }
        });
    }

    function create_random_assessment(indicators) { // eslint-disable-line no-unused-vars
        const curDate = generateRandomDate(new Date(2023, 0, 1), new Date());
        let assessmentId = create_assessment_id(curDate);
        let scores = {};
        indicators.forEach((cat, catX) => {
            cat.forEach((indicator, indX) => {
                scoreIdx = "indicator["+catX+"]["+indX+"]";
                scores[scoreIdx] = Math.floor(Math.random() * indicator.scores.length) + 1;
            });
        });
        
        let newAssessment = {
            contactInfo: {
                fullName: 'John Doe',
                email: 'jdoe@fake.com',
                location: 'New York, USA'
            },
            scores: scores,
            created: curDate.toISOString()
        };

        // Save the assessment to localstorage
        localStorage.setItem(assessmentId, JSON.stringify(newAssessment));

        // Now update the assessment list
        let assessmentList = JSON.parse(localStorage.getItem('assessment_list'));
        if (!assessmentList) assessmentList = [];
        
        assessmentList.push(assessmentId);
        localStorage.setItem("assessment_list", JSON.stringify(makeArrayUnique(assessmentList)));
    }

    /**
     * Convert scores object in the form {indicator[cat][ind]: score, ...} to a 2D array with cat and ind dimensions
     * 
     */
    function scores_to_2d_array(scores) {
        let scoreArray = [];
        indicators.forEach((cat, catX) => {
            scoreArray[catX] = [];
            cat.forEach((indicator, indX) => {
                let label = "indicator["+catX+"]["+indX+"]";
                scoreArray[catX][indX] = scores[label];
            });
        });

        return scoreArray;
    }

    function scores_to_array(scores) {
        let scoreArray = [];
        indicators.forEach((cat, catX) => {            
            cat.forEach((indicator, indX) => {
                let label = "indicator["+catX+"]["+indX+"]";
                scoreArray.push(scores[label]);
            });
        });

        return scoreArray;
    }


    function export_xlsx() {
        let assessmentList = JSON.parse(localStorage.getItem('assessment_list'));
        let globalContactInfoJSON = localStorage.getItem('contactInfo');
        if (!assessmentList) assessmentList = [];
        
        let scores = [];
        let merges = [];

        assessmentList.forEach((assessmentId) => {
            let assessment = JSON.parse(localStorage.getItem(assessmentId));

            // Prepare header row for scores sheet
            if (scores.length === 0) {
                let categoryRow = ['','','',''];
                let headerRow = ['Date', 'Contact Name', 'Email', 'Location'];
                let startcol = headerRow.length;

                indicators.forEach((cat, catX) => {                                
                    // Calculate merges    
                    endcol = startcol + cat.length - 1;
                    merges.push({ s: { r:0, c:startcol }, e: { r:0, c:endcol }});
                    startcol = endcol + 1;

                    cat.forEach((indicator, indX) => {
                        // Only add category label for first indicator in that category
                        if (indX > 0)
                            categoryRow.push('');
                        else {
                            let catLabel = categories[catX];
                            categoryRow.push(catLabel);
                        }

                        // Add indicator label to header row
                        let label = indicator.name;
                        headerRow.push(label);
                    });
                });
                scores.push(categoryRow);
                scores.push(headerRow);
            }

            let scoreRow = scores_to_array(assessment.scores);
            scoreRow.unshift(assessment.created, assessment.contactInfo.fullName, assessment.contactInfo.email, assessment.contactInfo.location);
            scores.push(scoreRow);
        });

        // console.log(scores);

        // Create workbook and add the worksheets
        let wb = XLSX.utils.book_new();
        // let ws = XLSX.utils.json_to_sheet(globalContactInfoJSON);
        let ws2 = XLSX.utils.aoa_to_sheet(scores);
        ws2['!merges'] = merges;
        // merges.forEach((merge) => {
        //     console.log(merge); 
        //     ws2[merges.s].s = {
        //         type: 'style',
        //         fill: {
        //             type: 'pattern',
        //             patternType: 'solid',
        //             fgColor: { rgb: 'FFFF0000' }, // Red color
        //         },
        //         };
        // });
        // XLSX.utils.book_append_sheet(wb, ws, "MMT Assessments - Contact Info");
        XLSX.utils.book_append_sheet(wb, ws2, "MMT Indicator Scores");

        // Export to file
        XLSX.writeFile(wb, "mmt_assessments.xlsx");        
    }

    function delete_assessments_confirmation() {
        if (confirm("Are you sure you want to delete all recorded assessments? This action cannot be undone.")) {
            delete_assessments();
        }
    }
    
    function delete_assessments() {
        localStorage.clear();
        updateTotalRecords();
        
        // Update sync status after clearing
        if (typeof updateSyncStatus === 'function') {
            updateSyncStatus();
        }
    }

    /////////////////////////////// GLOBAL INIT ////////////////////////////////

    // Refresh the Reports tab
    refreshReports();

    // Generate the Assessment Form
    document.getElementById('new_assessment_wrapper').innerHTML = generate_assessment_form(categories, indicators);

    // Initialize the assessment navigation
    initAssessmentNavigation();

    // Comment this line out. only used for testing
    // callNTimes(function() { create_random_assessment(indicators); }, 5, 100);    