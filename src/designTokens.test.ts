import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Design check (DESIGN.md, "Color tokens"): every text/background pairing the components use stays
 * readable in both themes. Text needs 4.5:1 (WCAG AA); the focus ring needs 3:1 against the page.
 * Tokens are read straight from src/index.css, so a token edit that hurts readability fails here.
 */

type RGBA = [number, number, number, number];

const css = readFileSync(resolve(__dirname, 'index.css'), 'utf8');

/** The custom properties declared directly inside the first block that opens at `selector`. */
function tokensIn(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`No ${selector} block in index.css`);
  const open = css.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  const body = css.slice(open + 1, end);
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
}

const dark = tokensIn(':root {');
const paper = { ...dark, ...tokensIn('[data-theme="paper"] {') };

const srgbFromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return rgb.map(v => Math.round(Math.min(1, Math.max(0, srgbFromLinear(v))) * 255)) as [number, number, number];
}

function parse(value: string, tokens: Record<string, string>): RGBA {
  const ref = value.match(/^var\(--([a-z0-9-]+)\)$/);
  if (ref) return parse(tokens[ref[1]], tokens);
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map(x => x + x).join('') : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const fn = value.match(/^(rgb|oklch)\(([^)]+)\)$/);
  if (!fn) throw new Error(`Unsupported color: ${value}`);
  const [channels, alpha = '1'] = fn[2].split('/').map(s => s.trim());
  const n = channels.split(/\s+/).map(Number);
  const a = Number(alpha);
  if (fn[1] === 'rgb') return [n[0], n[1], n[2], a];
  return [...oklchToRgb(n[0], n[1], n[2]), a];
}

/** A translucent color painted over an opaque one, as the browser composites it. */
const over = (top: RGBA, below: RGBA): RGBA => [0, 1, 2].map(i => top[i] * top[3] + below[i] * (1 - top[3])).concat(1) as RGBA;

const luminance = ([r, g, b]: RGBA) => {
  const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a: RGBA, b: RGBA) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** [text token, background token(s) painted bottom-up, minimum ratio] */
const PAIRS: [string, string[], number][] = [
  ...['ink', 'ink-muted', 'ink-subtle'].flatMap(text =>
    [['canvas'], ['canvas-raised'], ['surface-solid'], ['canvas', 'surface'], ['canvas', 'surface-hover']].map(
      bg => [text, bg, 4.5] as [string, string[], number],
    ),
  ),
  ['ink-muted', ['surface-solid', 'brand-soft'], 4.5], // selected options
  ['brand-text', ['canvas'], 4.5],
  ['brand-text', ['surface-solid'], 4.5],
  ['brand-text', ['canvas', 'brand-soft'], 4.5], // brand badges, active tabs
  ['brand-ink', ['brand'], 4.5], // primary buttons
  ['brand-ink', ['brand-hover'], 4.5],
  ['success-ink', ['success'], 4.5],
  ['danger-ink', ['danger'], 4.5],
  ['gold', ['canvas', 'gold-soft'], 4.5], // streak badges
  ['danger', ['canvas', 'danger-soft'], 4.5], // error messages
  ['brand', ['canvas'], 3], // focus ring (non-text)
];

describe.each([
  ['dark', dark],
  ['paper', paper],
] as const)('%s theme tokens', (_theme, tokens) => {
  it.each(PAIRS)('%s on %j reaches %d:1', (text, layers, min) => {
    const bg = layers.map(t => parse(tokens[t], tokens)).reduce((below, top) => over(top, below));
    const fg = over(parse(tokens[text], tokens), bg);
    expect(Number(contrast(fg, bg).toFixed(2))).toBeGreaterThanOrEqual(min);
  });
});
