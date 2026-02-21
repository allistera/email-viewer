import sanitizeHtml from 'sanitize-html';

export const CONFIG = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img', 'style', 'font', 'center', 'u', 's', 'ins', 'del', 'map', 'area'
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
  selfClosing: ['img', 'br', 'hr', 'area', 'basefont', 'input', 'link', 'meta'],
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
  allowProtocolRelative: true,
  enforceHtmlBoundary: false,
  allowVulnerableTags: false,
  transformTags: {
    'a': sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true)
  }
};
