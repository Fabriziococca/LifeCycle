// Product decision, 2026-09-27: archive the complete transcription feature.
// Deliberately independent of existing API credentials and user preferences.
// Retained code/data can be re-enabled explicitly after a new product decision.
export const TRANSCRIPTIONS_ENABLED = false;

export function isProductModuleEnabled(sectionId) {
    return sectionId !== 'transcripciones-section' || TRANSCRIPTIONS_ENABLED;
}
