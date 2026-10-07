/**
 * Cloze cards mark the hidden words inline: "Plants make {{glucose}} from light".
 * Recall screens must hide those words until the answer is revealed; list and
 * preview screens should read as a normal sentence.
 */
const CLOZE_SPAN = /\{\{(.*?)\}\}/g;

/** True when the text contains at least one {{blank}}. */
export const hasCloze = (text: string): boolean => /\{\{.*?\}\}/.test(text);

/** Replaces every {{blank}} with a placeholder, hiding the answer. */
export const maskCloze = (text: string, placeholder = '_____'): string => text.replace(CLOZE_SPAN, placeholder);

/** Removes the {{ }} markers, leaving the full sentence. */
export const fillCloze = (text: string): string => text.replace(CLOZE_SPAN, '$1');
