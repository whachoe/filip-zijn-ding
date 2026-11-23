function buildAssessmentProgress(existing, options) {
    const assessmentData = {
        ...(existing || {}),
        id: options.id,
        marketInfo: existing && existing.marketInfo
            ? existing.marketInfo
            : (typeof window.getCurrentMarketInfo === 'function' ? window.getCurrentMarketInfo() : null),
        scores: options.scores,
        progress: {
            ...(existing && existing.progress ? existing.progress : {}),
            currentQuestionIndex: options.currentQuestionIndex,
            totalQuestions: options.totalQuestions,
            lastUpdated: new Date().toISOString()
        },
        created: existing ? existing.created : new Date().toISOString(),
        synced: false,
        version: options.getCurrentQuestionVersion(),
        mediaAttachments: existing && existing.mediaAttachments ? existing.mediaAttachments : [],
        notes: existing && existing.notes ? existing.notes : "",
        questionNotes: options.questionNotes
    };
    delete assessmentData.contactInfo;
    return assessmentData;
}
