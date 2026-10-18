import DOMPurify from 'dompurify';

export function sanitizeResumeHtml(value) {
  return DOMPurify.sanitize(typeof value === 'string' ? value : '', {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'a'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
  });
}
