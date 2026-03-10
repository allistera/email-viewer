/**
 * Mock Data Generator for Email Viewer
 *
 * This module provides utilities to generate realistic test data for local development.
 * Customize and extend these generators to match your testing needs.
 */

/**
 * Random item selector
 */
const randomItem = (array) => array[Math.floor(Math.random() * array.length)];

/**
 * Random integer generator
 */
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Random boolean with probability
 */
const randomBool = (probability = 0.5) => Math.random() < probability;

/**
 * Email address generators
 */
const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Leo', 'Maya', 'Noah', 'Olivia', 'Peter', 'Quinn', 'Rose', 'Sam', 'Tara'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas'];
const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'company.com', 'startup.io', 'agency.co', 'tech.dev', 'business.net'];

export const generateEmail = () => {
  const firstName = randomItem(FIRST_NAMES).toLowerCase();
  const lastName = randomItem(LAST_NAMES).toLowerCase();
  const domain = randomItem(DOMAINS);
  return `${firstName}.${lastName}@${domain}`;
};

/**
 * Subject line templates by category
 */
const SUBJECT_TEMPLATES = {
  work: [
    'Q{quarter} {reportType} Report',
    'Meeting: {topic}',
    'Re: {topic}',
    '{project} Project Update',
    'Action Required: {task}',
    'FYI: {announcement}',
    '{person} is out of office',
    'Reminder: {event} tomorrow'
  ],
  personal: [
    'Catch up soon?',
    'Re: Weekend plans',
    'Happy {occasion}!',
    'Thinking of you',
    'Quick question',
    'Thanks for {favor}',
    'See you at {event}'
  ],
  newsletter: [
    '{emoji} Weekly Newsletter - {topic}',
    'Your {frequency} digest from {source}',
    '{number} things you missed this week',
    '{topic}: What you need to know',
    'Latest updates from {brand}'
  ],
  promotional: [
    '{emoji} {percent}% OFF {product}!!!',
    'LAST CHANCE: {offer}',
    'Exclusive offer just for you',
    "Don't miss out on {deal}",
    '{urgency}: {product} sale ends soon',
    'New arrivals: {category}',
    'Your cart is waiting for you'
  ],
  notification: [
    'Password reset request',
    'New login from {location}',
    'Your {service} subscription expires soon',
    'Payment confirmation',
    '{person} mentioned you',
    'You have {count} new notifications',
    'Security alert: {action} detected'
  ]
};

const SUBJECT_VARS = {
  quarter: () => `Q${randomInt(1, 4)}`,
  reportType: () => randomItem(['Financial', 'Sales', 'Marketing', 'Product', 'Engineering']),
  topic: () => randomItem(['Strategy Review', 'Budget Planning', 'Product Launch', 'Team Sync', 'Client Feedback']),
  project: () => randomItem(['Alpha', 'Phoenix', 'Titan', 'Horizon', 'Catalyst']),
  task: () => randomItem(['Review document', 'Approve budget', 'Sign contract', 'Provide feedback']),
  announcement: () => randomItem(['Office closure', 'New hire', 'Policy update', 'System maintenance']),
  person: () => randomItem(FIRST_NAMES),
  event: () => randomItem(['conference call', 'team lunch', 'training session', 'deadline']),
  occasion: () => randomItem(['Birthday', 'Anniversary', 'Holiday']),
  favor: () => randomItem(['the help', 'your support', 'the recommendation']),
  emoji: () => randomItem(['🎉', '📢', '🚀', '⭐', '💡', '🔥', '📬', '🎁']),
  frequency: () => randomItem(['daily', 'weekly', 'monthly']),
  source: () => randomItem(['TechCrunch', 'Medium', 'Dev.to', 'Product Hunt']),
  number: () => randomInt(5, 10),
  brand: () => randomItem(['Nike', 'Apple', 'Amazon', 'Tesla']),
  percent: () => randomItem([20, 30, 50, 70, 90]),
  product: () => randomItem(['Electronics', 'Fashion', 'Gadgets', 'Everything']),
  offer: () => randomItem(['Flash Sale', 'Member Exclusive', 'Limited Time Deal']),
  deal: () => randomItem(['Black Friday', 'Summer Sale', 'Clearance']),
  urgency: () => randomItem(['URGENT', 'ENDING TODAY', 'FINAL HOURS']),
  category: () => randomItem(['Tech', 'Fashion', 'Home', 'Sports']),
  service: () => randomItem(['Netflix', 'Spotify', 'AWS', 'Adobe']),
  location: () => randomItem(['San Francisco', 'New York', 'London', 'Tokyo']),
  action: () => randomItem(['unusual activity', 'failed login attempt', 'password change']),
  count: () => randomInt(1, 25)
};

/**
 * Generate subject from template
 */
const generateSubject = (category) => {
  const template = randomItem(SUBJECT_TEMPLATES[category]);
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return SUBJECT_VARS[key] ? SUBJECT_VARS[key]() : match;
  });
};

/**
 * Email body templates
 */
const BODY_TEMPLATES = {
  work: [
    "Hi,\n\nI've completed the {task} and attached the {document}. Please review by {deadline} and let me know if you have any questions.\n\nBest regards,\n{sender}",
    "Team,\n\nJust a quick update on {project}. We're {status} and on track to meet our {milestone}.\n\nLet me know if you need anything.\n\n{sender}",
    "Hi {recipient},\n\nThanks for the {item}. I'll {action} and get back to you by {time}.\n\n{sender}"
  ],
  personal: [
    "Hey!\n\nHope you're doing well. Want to {activity} this {when}?\n\nLet me know!\n\n{sender}",
    "Hi {recipient},\n\nThanks so much for {favor}. Really appreciate it!\n\nTalk soon,\n{sender}"
  ],
  newsletter: [
    "Hello,\n\nHere are this week's top stories:\n\n• {story1}\n• {story2}\n• {story3}\n\nRead more at {link}\n\nUnsubscribe: {unsubLink}",
    "Hi {recipient},\n\nYour weekly roundup of {topic} news and updates.\n\n{content}\n\nStay informed,\n{brand}"
  ],
  promotional: [
    "Dear valued customer,\n\nFor a limited time, get {discount} on {product}!\n\nClick here NOW: {link}\n\nOffer expires {deadline}!\n\nUnsubscribe: {unsubLink}",
    "EXCLUSIVE OFFER INSIDE\n\n{emoji} {offer} {emoji}\n\nShop now: {link}\n\nTerms and conditions apply.\n\nUnsubscribe: {unsubLink}"
  ],
  notification: [
    "We received a request to {action}. If you did not make this request, please ignore this email.\n\nClick here to confirm: {link}\n\nThis link expires in {time}.",
    "Hi {recipient},\n\nYour {item} was successful. Here are the details:\n\n{details}\n\nIf you have questions, contact support."
  ]
};

/**
 * Generate realistic email body
 */
const generateBody = (category, subject) => {
  const template = randomItem(BODY_TEMPLATES[category]);
  const vars = {
    task: randomItem(['report', 'analysis', 'proposal', 'document']),
    document: randomItem(['PDF', 'spreadsheet', 'presentation', 'draft']),
    deadline: randomItem(['Friday', 'end of week', 'Monday', 'tomorrow']),
    sender: randomItem(FIRST_NAMES),
    recipient: randomItem(FIRST_NAMES),
    project: randomItem(['Alpha', 'Phoenix', 'Titan']),
    status: randomItem(['on track', 'ahead of schedule', 'making good progress']),
    milestone: randomItem(['Q4 deadline', 'launch date', 'review']),
    item: randomItem(['feedback', 'update', 'document', 'information']),
    action: randomItem(['review it', 'take a look', 'process this']),
    time: randomItem(['EOD', 'tomorrow', 'this week']),
    activity: randomItem(['grab coffee', 'catch up', 'meet for lunch']),
    when: randomItem(['weekend', 'week', 'Friday']),
    favor: randomItem(['your help', 'the recommendation', 'the support']),
    story1: randomItem(['AI breakthrough in healthcare', 'New climate policy announced']),
    story2: randomItem(['Tech IPO raises $500M', 'Study shows remote work benefits']),
    story3: randomItem(['New renewable energy record', 'Cybersecurity trends 2026']),
    link: 'https://example.com/read-more',
    unsubLink: 'https://example.com/unsubscribe',
    topic: randomItem(['tech', 'business', 'science']),
    content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    brand: randomItem(['TechNews', 'BizDaily', 'ScienceWeekly']),
    discount: randomItem(['20% OFF', '50% OFF', 'BUY ONE GET ONE']),
    product: randomItem(['all items', 'select products', 'everything']),
    offer: randomItem(['FLASH SALE', 'MEMBERS ONLY', 'LIMITED TIME']),
    emoji: randomItem(['🎉', '🔥', '⭐']),
    action: randomItem(['reset your password', 'verify your email', 'confirm your account']),
    details: 'Transaction ID: ' + Math.random().toString(36).substr(2, 9).toUpperCase()
  };

  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] || match);
};

/**
 * Tag categories with confidence levels
 */
export const TAG_CATEGORIES = [
  { name: 'Work', weight: 0.25, confidence: [0.75, 0.95] },
  { name: 'Personal', weight: 0.15, confidence: [0.65, 0.85] },
  { name: 'Finance', weight: 0.10, confidence: [0.80, 0.95] },
  { name: 'Projects/Alpha', weight: 0.08, confidence: [0.70, 0.90] },
  { name: 'Projects/Beta', weight: 0.07, confidence: [0.70, 0.90] },
  { name: 'Newsletter', weight: 0.15, confidence: [0.85, 0.95] },
  { name: 'Promotional', weight: 0.10, confidence: [0.60, 0.80] },
  { name: 'Notifications', weight: 0.08, confidence: [0.80, 0.95] },
  { name: 'spam', weight: 0.02, confidence: [0.90, 0.99] }
];

/**
 * Generate a random tag with confidence
 */
export const generateTag = () => {
  const rand = Math.random();
  let cumulative = 0;

  for (const tag of TAG_CATEGORIES) {
    cumulative += tag.weight;
    if (rand < cumulative) {
      const [min, max] = tag.confidence;
      const confidence = min + Math.random() * (max - min);

      return {
        tag: tag.name,
        confidence: parseFloat(confidence.toFixed(2)),
        reason: generateTagReason(tag.name)
      };
    }
  }

  return { tag: null, confidence: null, reason: null };
};

/**
 * Generate tag reasoning
 */
const generateTagReason = (tagName) => {
  const reasons = {
    'Work': 'Professional language and business context',
    'Personal': 'Informal tone and personal content',
    'Finance': 'Financial terminology and reporting language',
    'Projects/Alpha': 'Project-specific keywords detected',
    'Projects/Beta': 'Project-specific keywords detected',
    'Newsletter': 'Newsletter format with multiple stories',
    'Promotional': 'Marketing language with urgency indicators',
    'Notifications': 'System-generated notification patterns',
    'spam': 'Excessive urgency, capitalization, and promotional content'
  };

  return reasons[tagName] || 'Content analysis and keyword matching';
};

/**
 * Generate a single mock message
 */
export const generateMessage = (options = {}) => {
  const category = options.category || randomItem(['work', 'personal', 'newsletter', 'promotional', 'notification']);
  const subject = options.subject || generateSubject(category);
  const from = options.from || generateEmail();
  const tagInfo = options.noTag ? { tag: null, confidence: null, reason: null } : generateTag();
  const hasAttachments = options.hasAttachments !== undefined ? options.hasAttachments : randomBool(0.2);
  const receivedAt = options.receivedAt || Date.now() - randomInt(0, 86400000 * 7); // Last 7 days

  const textBody = generateBody(category, subject);
  const htmlBody = `<p>${textBody.split('\n').join('</p><p>')}</p>`;

  return {
    id: options.id || `550e8400-e29b-41d4-a716-${Math.random().toString(36).substr(2, 12)}`,
    from_addr: from,
    to_addr: options.to || 'me@mydomain.com',
    subject,
    snippet: textBody.substring(0, 100) + '...',
    received_at: receivedAt,
    has_attachments: hasAttachments,
    text_body: textBody,
    html_body: htmlBody,
    tag: tagInfo.tag,
    tag_confidence: tagInfo.confidence,
    tag_reason: tagInfo.reason,
    headers_json: JSON.stringify({
      'message-id': `<${Math.random().toString(36).substr(2, 9)}@${from.split('@')[1]}>`,
      'date': new Date(receivedAt).toISOString()
    })
  };
};

/**
 * Generate bulk messages
 */
export const generateMessages = (count = 50, options = {}) => {
  return Array.from({ length: count }, () => generateMessage(options));
};

/**
 * Generate mock attachment
 */
export const generateAttachment = (messageId) => {
  const types = [
    { ext: 'pdf', contentType: 'application/pdf', sizeRange: [50000, 500000] },
    { ext: 'jpg', contentType: 'image/jpeg', sizeRange: [100000, 2000000] },
    { ext: 'png', contentType: 'image/png', sizeRange: [80000, 1500000] },
    { ext: 'docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeRange: [30000, 300000] },
    { ext: 'xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sizeRange: [40000, 400000] },
    { ext: 'zip', contentType: 'application/zip', sizeRange: [500000, 5000000] }
  ];

  const type = randomItem(types);
  const filenames = [
    `report-q${randomInt(1, 4)}-2026`,
    `presentation-${randomItem(['final', 'draft', 'v2'])}`,
    `document-${randomInt(1, 100)}`,
    `image-${randomInt(1, 999)}`,
    `screenshot-${randomInt(1, 99)}`,
    `invoice-${randomInt(1000, 9999)}`
  ];

  return {
    id: randomInt(1, 100000),
    message_id: messageId,
    filename: `${randomItem(filenames)}.${type.ext}`,
    content_type: type.contentType,
    size_bytes: randomInt(...type.sizeRange),
    sha256: Array.from({ length: 64 }, () => randomInt(0, 15).toString(16)).join('')
  };
};

/**
 * Generate preset scenarios for testing specific features
 */
export const SCENARIOS = {
  // High volume inbox
  highVolume: () => generateMessages(200),

  // All spam
  allSpam: () => generateMessages(20, { category: 'promotional' }),

  // Work emails only
  workOnly: () => generateMessages(30, { category: 'work' }),

  // All with attachments
  withAttachments: () => generateMessages(15, { hasAttachments: true }),

  // Recent emails (last hour)
  recent: () => generateMessages(10, {
    receivedAt: Date.now() - randomInt(0, 3600000)
  }),

  // Mixed time range (last 30 days)
  mixedTimeRange: () => generateMessages(100, {
    receivedAt: Date.now() - randomInt(0, 86400000 * 30)
  }),

  // Untagged emails
  untagged: () => generateMessages(25, { noTag: true })
};

/**
 * Default tags for testing
 */
export const DEFAULT_TAGS = [
  { id: 'tag-work', name: 'Work', created_at: Date.now() - 1000000 },
  { id: 'tag-personal', name: 'Personal', created_at: Date.now() - 900000 },
  { id: 'tag-finance', name: 'Finance', created_at: Date.now() - 800000 },
  { id: 'tag-alpha', name: 'Projects/Alpha', created_at: Date.now() - 700000 },
  { id: 'tag-alpha-design', name: 'Projects/Alpha/Design', created_at: Date.now() - 600000 },
  { id: 'tag-beta', name: 'Projects/Beta', created_at: Date.now() - 500000 },
  { id: 'tag-newsletter', name: 'Newsletter', created_at: Date.now() - 400000 },
  { id: 'tag-notifications', name: 'Notifications', created_at: Date.now() - 300000 },
  { id: 'tag-spam', name: 'spam', created_at: 0 }
];

/**
 * Development presets
 */
export const DEV_PRESETS = {
  // Minimal - just a few emails
  minimal: {
    messages: generateMessages(5),
    tags: DEFAULT_TAGS.slice(0, 3)
  },

  // Standard - typical inbox
  standard: {
    messages: generateMessages(50),
    tags: DEFAULT_TAGS
  },

  // Large - stress test
  large: {
    messages: generateMessages(500),
    tags: DEFAULT_TAGS
  },

  // Custom - use scenario builders
  custom: (scenario, tagFilter = null) => ({
    messages: SCENARIOS[scenario] ? SCENARIOS[scenario]() : generateMessages(50),
    tags: tagFilter ? DEFAULT_TAGS.filter(t => tagFilter.includes(t.name)) : DEFAULT_TAGS
  })
};
