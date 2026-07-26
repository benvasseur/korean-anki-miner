import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitize';

/**
 * The Extra field is model output rendered with v-html AND written into an Anki
 * note, so anything that survives here executes in two places. These cases are
 * the attack list, not the happy path — a failure means a card could run script.
 */
describe('sanitizeHtml', () => {
  describe('keeps the formatting the prompt asks for', () => {
    it('preserves allowed inline tags', () => {
      const html = '<b>Verb.</b> To scratch.<br><br><b>Key expressions:</b><br>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('preserves nested allowed tags', () => {
      expect(sanitizeHtml('<b><em>긁다</em></b>')).toBe('<b><em>긁다</em></b>');
    });

    it('leaves plain text and Hangul untouched', () => {
      expect(sanitizeHtml('모기에 물린 곳을 긁었더니 더 가려워.')).toBe(
        '모기에 물린 곳을 긁었더니 더 가려워.',
      );
    });

    it('escapes bare angle brackets instead of dropping the text', () => {
      expect(sanitizeHtml('a < b and b > a')).toBe('a &lt; b and b &gt; a');
    });
  });

  describe('strips attributes from allowed tags', () => {
    it('removes event handlers but keeps the text', () => {
      expect(sanitizeHtml('<b onclick="alert(1)">keep me</b>')).toBe('<b>keep me</b>');
    });

    it('removes style, class and id', () => {
      expect(sanitizeHtml('<em style="position:fixed" class="x" id="y">hi</em>')).toBe(
        '<em>hi</em>',
      );
    });

    it('removes handlers written in mixed case', () => {
      expect(sanitizeHtml('<b OnMouseOver=alert(1)>x</b>')).toBe('<b>x</b>');
    });
  });

  describe('drops disallowed elements', () => {
    it('removes an img with an onerror payload', () => {
      expect(sanitizeHtml('before<img src=x onerror=alert(1)>after')).toBe('beforeafter');
    });

    it('removes an svg onload payload', () => {
      expect(sanitizeHtml('<svg/onload=alert(1)>')).toBe('');
    });

    it('drops script elements including their contents', () => {
      expect(sanitizeHtml('a<script>alert(1)</script>b')).toBe('ab');
    });

    it('drops style elements including their contents', () => {
      expect(sanitizeHtml('a<style>body{display:none}</style>b')).toBe('ab');
    });

    it('unwraps anchors, keeping the link text but not the href', () => {
      expect(sanitizeHtml('<a href="javascript:alert(1)">click</a>')).toBe('click');
    });

    // Embedded content. <iframe> is deliberately not used here: happy-dom tries
    // to load a page for one the moment it is parsed, which floods the run with
    // navigation errors. It goes through the same "not in the allowlist" branch
    // as these, and the payload loop below covers the attribute stripping.
    it('unwraps object and embed elements', () => {
      expect(sanitizeHtml('<object data="evil.swf"></object>x')).toBe('x');
      expect(sanitizeHtml('<embed src="evil.swf">x')).toBe('x');
    });

    it('unwraps block elements but keeps their text', () => {
      expect(sanitizeHtml('<div><p>meaning</p></div>')).toBe('meaning');
    });

    it('keeps allowed formatting nested inside a dropped element', () => {
      expect(sanitizeHtml('<div><b>meaning</b></div>')).toBe('<b>meaning</b>');
    });

    it('removes comments (which can hide markup from a naive filter)', () => {
      expect(sanitizeHtml('a<!-- <script>alert(1)</script> -->b')).toBe('ab');
    });
  });

  describe('survives malformed markup', () => {
    // The regex sanitizer this replaced stopped at the first '>', so an
    // attribute value containing '>' could leave markup behind as text.
    it('handles an attribute value containing a closing bracket', () => {
      const out = sanitizeHtml('<a href="a>b" onclick=alert(1)>text</a>');
      expect(out).not.toMatch(/onclick/i);
      expect(out).not.toContain('<a');
    });

    it('handles nested/broken script tags', () => {
      const out = sanitizeHtml('<scr<script>ipt>alert(1)</scr</script>ipt>');
      expect(out).not.toMatch(/<script/i);
    });

    it('closes unclosed allowed tags', () => {
      expect(sanitizeHtml('<b>unclosed')).toBe('<b>unclosed</b>');
    });

    it('drops stray closing tags', () => {
      expect(sanitizeHtml('text</b></div>')).toBe('text');
    });

    it('is idempotent — sanitizing twice changes nothing', () => {
      const once = sanitizeHtml('<div onclick=x><b>a</b><img src=y onerror=z></div>');
      expect(sanitizeHtml(once)).toBe(once);
    });

    it('handles empty input', () => {
      expect(sanitizeHtml('')).toBe('');
    });
  });

  describe('no output can carry an executable attribute', () => {
    const payloads = [
      '<b onclick="alert(1)">x</b>',
      '<img src=x onerror=alert(1)>',
      '<svg><animate onbegin=alert(1)></svg>',
      '<body onload=alert(1)>x',
      '<a href="javascript:alert(1)">x</a>',
      '<form><button formaction="javascript:alert(1)">x</button></form>',
      '<b><![CDATA[<script>alert(1)</script>]]></b>',
      '<math><mtext><script>alert(1)</script></mtext></math>',
    ];

    it.each(payloads)('%s yields inert markup', (payload) => {
      const out = sanitizeHtml(payload);
      // Re-parse the output and assert the DOM the renderer would build is clean.
      const doc = new DOMParser().parseFromString(out, 'text/html');
      for (const element of Array.from(doc.body.querySelectorAll('*'))) {
        expect(['B', 'I', 'U', 'STRONG', 'EM', 'BR']).toContain(element.tagName);
        expect(element.attributes.length).toBe(0);
      }
      expect(out).not.toMatch(/javascript:/i);
      expect(out).not.toMatch(/\son\w+\s*=/i);
    });
  });
});
