import { describe, it, expect } from 'vitest';
import { escapeHtml, renderFormattedText } from '../../utils/mathFormatter';

describe('MathRenderer - escapeHtml', () => {
  it('escapes dangerous HTML characters', () => {
    const raw = '<script>alert("xss") & \'foo\'</script>';
    const escaped = escapeHtml(raw);
    expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;) &amp; &#039;foo&#039;&lt;/script&gt;');
  });

  it('leaves safe alphanumeric strings intact', () => {
    expect(escapeHtml('Hello World 123!')).toBe('Hello World 123!');
  });
});

describe('MathRenderer - renderFormattedText', () => {
  it('prevents XSS injection vectors', () => {
    const malicious = '<img src=x onerror="alert(\'pwned\')">';
    const rendered = renderFormattedText(malicious);
    expect(rendered).not.toContain('<img');
    expect(rendered).toContain('&lt;img');
    expect(rendered).toContain('&quot;alert(&#039;pwned&#039;)&quot;');
  });

  it('replaces Greek letters and symbols', () => {
    const input = '\\alpha + \\beta = \\gamma, \\Delta E, \\pi r^2, \\omega t';
    const rendered = renderFormattedText(input);
    expect(rendered).toContain('α + β = γ');
    expect(rendered).toContain('Δ E');
    expect(rendered).toContain('π r<sup>2</sup>');
    expect(rendered).toContain('ω t');
  });

  it('converts mathematical and chemical operators and arrows', () => {
    const input = 'a \\le b \\ge c \\neq d, A -> B, A \\rightarrow B, A <=> B';
    const rendered = renderFormattedText(input);
    expect(rendered).toContain('≤');
    expect(rendered).toContain('≥');
    expect(rendered).toContain('≠');
    expect(rendered).toContain('→');
    expect(rendered).toContain('⇌');
  });

  it('correctly handles superscripts and subscripts', () => {
    const input = 'x^2 + y^{12} - H_2O + a_{ij}';
    const rendered = renderFormattedText(input);
    expect(rendered).toContain('x<sup>2</sup>');
    expect(rendered).toContain('y<sup>12</sup>');
    expect(rendered).toContain('H<sub>2</sub>O');
    expect(rendered).toContain('a<sub>ij</sub>');
  });

  it('formats LaTeX fractions correctly', () => {
    const input = '\\frac{1}{2} + \\frac{x+y}{z}';
    const rendered = renderFormattedText(input);
    expect(rendered).toContain('<span class="inline-flex flex-col text-center align-middle mx-1 text-[0.85em] leading-none">');
    expect(rendered).toContain('<span class="border-b border-current pb-0.5">1</span>');
    expect(rendered).toContain('<span class="pt-0.5">2</span>');
    expect(rendered).toContain('<span class="border-b border-current pb-0.5">x+y</span>');
    expect(rendered).toContain('<span class="pt-0.5">z</span>');
  });

  it('formats inline code with code tags', () => {
    const input = 'Use `console.log(x)` for debugging';
    const rendered = renderFormattedText(input);
    expect(rendered).toMatch(/<code class="[^"]*">console\.log\(x\)<\/code>/);
  });
});
