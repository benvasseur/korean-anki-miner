/**
 * Allowlist sanitizer for the Extra field.
 *
 * The Extra field is model-generated HTML: it is rendered with `v-html` in the
 * card preview AND written into the Anki note, where Anki's webview renders it
 * again. Both are script-executing contexts, so the enrichment providers are
 * treated as untrusted input — a prompt-injected caption should not be able to
 * put an event handler on a card that runs for years of reviews.
 *
 * Parsing (rather than matching tags with a regex) is the point: the browser's
 * own parser decides what a tag is, so there is no gap between what this
 * function thinks it removed and what the renderer will later execute.
 */

/** Inline formatting the prompt asks for; everything else is unwrapped. */
const ALLOWED_TAGS = new Set(['B', 'I', 'U', 'STRONG', 'EM', 'BR']);

export function sanitizeHtml(html: string): string {
  // `text/html` parsing happens in an inert document: no scripts run, no
  // resources load, so `<img onerror>` never fires while we inspect it.
  const doc = new DOMParser().parseFromString(html, 'text/html');
  sanitizeChildren(doc.body);
  return doc.body.innerHTML;
}

function sanitizeChildren(parent: Element): void {
  // Snapshot first: unwrapping mutates the live childNodes list.
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) continue;

    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove(); // comments, CDATA, processing instructions
      continue;
    }

    const element = node as Element;
    sanitizeChildren(element);

    if (ALLOWED_TAGS.has(element.tagName)) {
      // Strip every attribute: no href/src/style, so no javascript: URLs, no
      // event handlers, no CSS-based exfiltration.
      for (const attribute of Array.from(element.attributes)) {
        element.removeAttribute(attribute.name);
      }
      continue;
    }

    // Not allowed: drop the tag but keep its text, so a stray <p> or <div>
    // degrades to its content instead of silently deleting an explanation.
    // <script>/<style> content is markup, not prose — discard it outright.
    if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
      element.remove();
      continue;
    }
    element.replaceWith(...Array.from(element.childNodes));
  }
}
