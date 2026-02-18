import sanitizeHtml from 'sanitize-html';

const CONFIG = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img', 'style', 'font', 'center', 'u', 's', 'ins', 'del', 'map', 'area', 'base'
  ]),
  allowedAttributes: {
    '*': ['style', 'class', 'id', 'name', 'width', 'height', 'title', 'lang', 'dir', 'align', 'valign', 'bgcolor', 'color', 'face', 'size'],
    'a': ['href', 'name', 'target', 'rel'],
    'img': ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'usemap'],
    'area': ['shape', 'coords', 'href', 'alt'],
    'table': ['border', 'cellpadding', 'cellspacing', 'width', 'bgcolor', 'background', 'align'],
    'td': ['colspan', 'rowspan', 'align', 'valign', 'bgcolor', 'width', 'height', 'background'],
    'th': ['colspan', 'rowspan', 'align', 'valign', 'bgcolor', 'width', 'height', 'background']
  },
  selfClosing: ['img', 'br', 'hr', 'area', 'base', 'basefont', 'input', 'link', 'meta'],
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
  allowProtocolRelative: true,
  enforceHtmlBoundary: false,
  allowVulnerableTags: true
};

self.onmessage = ({ data: { id, html } }) => {
  try {
    const sanitized = sanitizeHtml(html, CONFIG);
    self.postMessage({ id, html: sanitized });
  } catch (error) {
    console.error('Sanitization failed:', error);
    self.postMessage({ id, error: error.message, html: '' });
  }
};
