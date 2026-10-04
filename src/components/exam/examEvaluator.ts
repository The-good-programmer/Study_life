function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAnswerVariants(target: string): string[] {
  const variants = new Set<string>();
  variants.add(target);

  target.split(/[;/]|\bor\b/i).forEach(v => {
    const trimmed = v.trim();
    if (trimmed) variants.add(trimmed);
  });

  const parenMatch = target.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1].trim()) {
    variants.add(parenMatch[1].trim());
    const withoutParen = target.replace(/\([^)]+\)/g, '').trim();
    if (withoutParen) variants.add(withoutParen);
  }

  return Array.from(variants);
}

function isCloseTypo(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length < 5 || b.length < 5) return false;

  let diff = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] !== b[j]) {
      diff++;
      if (diff > 1) return false;
      if (a.length > b.length) {
        i++;
        continue;
      } else if (b.length > a.length) {
        j++;
        continue;
      }
    }
    i++;
    j++;
  }
  return true;
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'by', 
  'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 
  'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'of', 
  'off', 'over', 'under', 'and', 'or', 'but', 'nor', 'so', 'yet', 'it', 
  'its', 'this', 'that', 'these', 'those'
]);

function getSignificantTokens(text: string): string[] {
  return text
    .split(' ')
    .map(w => w.trim())
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function evaluateTextAnswer(userAns: string, targetAnswer: string): boolean {
  const normUser = normalizeText(userAns);
  const normTarget = normalizeText(targetAnswer);

  if (!normUser || !normTarget) return false;

  // 1. Direct normalized match
  if (normUser === normTarget) return true;

  // 2. Check alias / slash / semicolon / parenthesis variants in target
  const targetVariants = extractAnswerVariants(targetAnswer);
  for (const variant of targetVariants) {
    const normVariant = normalizeText(variant);
    if (normUser === normVariant) return true;
    if (normVariant.length >= 5 && isCloseTypo(normUser, normVariant)) {
      return true;
    }
  }

  // 3. User wrote a full sentence containing the complete target phrase
  if (normTarget.length >= 4) {
    const wholeTargetRegex = new RegExp(`\\b${escapeRegExp(normTarget)}\\b`, 'i');
    if (wholeTargetRegex.test(normUser)) {
      return true;
    }
  }

  // 4. Multi-word token overlap (at least 75% recall and 50% precision of significant terms)
  const targetTokens = getSignificantTokens(normTarget);
  const userTokens = getSignificantTokens(normUser);

  if (targetTokens.length >= 3 && userTokens.length >= 2) {
    const userSet = new Set(userTokens);
    const matches = targetTokens.filter(t => userSet.has(t) || userTokens.some(u => isCloseTypo(u, t)));
    const recall = matches.length / targetTokens.length;
    const precision = matches.length / userTokens.length;
    if (recall >= 0.75 && precision >= 0.5) {
      return true;
    }
  }

  return false;
}
