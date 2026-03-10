/**
 * Custom Mock Data Example
 *
 * This example shows how to create custom test scenarios
 * using the mock data utilities.
 *
 * Usage:
 *   1. Customize the data below
 *   2. Import this into your enhanced mock server
 *   3. Or use it in your tests directly
 */

import {
  generateMessage,
  generateMessages,
  generateAttachment,
  generateEmail,
  generateTag,
  SCENARIOS,
  DEV_PRESETS,
  DEFAULT_TAGS
} from '../src/utils/mockData.js';

// ============================================================================
// Example 1: Generate specific email types
// ============================================================================

export function createUrgentWorkEmails() {
  return [
    generateMessage({
      category: 'work',
      subject: 'URGENT: Q4 Budget Review Needed',
      from: 'cfo@company.com',
      hasAttachments: true
    }),
    generateMessage({
      category: 'work',
      subject: 'Critical: Server Outage',
      from: 'ops@company.com'
    }),
    generateMessage({
      category: 'work',
      subject: 'Emergency Meeting: Client Escalation',
      from: 'manager@company.com'
    })
  ];
}

// ============================================================================
// Example 2: Create a realistic inbox for a specific role
// ============================================================================

export function createProductManagerInbox() {
  return [
    // Engineering updates
    ...generateMessages(5, { category: 'work' }),

    // Customer feedback
    generateMessage({
      category: 'work',
      subject: 'Customer Feedback: Feature Request',
      from: 'support@company.com'
    }),
    generateMessage({
      category: 'work',
      subject: 'Re: Bug Report - Login Issues',
      from: 'qa@company.com'
    }),

    // Newsletters
    ...generateMessages(3, { category: 'newsletter' }),

    // Team communication
    generateMessage({
      category: 'work',
      subject: 'Sprint Planning - Week of Feb 26',
      from: 'scrum-master@company.com'
    }),

    // Personal
    ...generateMessages(2, { category: 'personal' }),

    // Spam/Promotional
    ...generateMessages(10, { category: 'promotional' })
  ];
}

// ============================================================================
// Example 3: Time-based scenario (simulate inbox over time)
// ============================================================================

export function createTimelineInbox() {
  const now = Date.now();
  const oneHour = 3600000;
  const oneDay = 86400000;

  return [
    // This hour - urgent items
    ...generateMessages(3, {
      receivedAt: now - Math.random() * oneHour,
      category: 'work'
    }),

    // Today - normal workload
    ...generateMessages(10, {
      receivedAt: now - Math.random() * oneDay,
      category: 'work'
    }),

    // This week
    ...generateMessages(20, {
      receivedAt: now - Math.random() * oneDay * 7
    }),

    // Last month
    ...generateMessages(30, {
      receivedAt: now - Math.random() * oneDay * 30
    })
  ];
}

// ============================================================================
// Example 4: Test specific features
// ============================================================================

// All untagged - for testing auto-tagging
export function createUntaggedInbox() {
  return generateMessages(20, { noTag: true });
}

// All with attachments - for testing attachment handling
export function createAttachmentHeavyInbox() {
  return generateMessages(15, { hasAttachments: true });
}

// High spam rate - for testing spam detection
export function createSpamHeavyInbox() {
  return [
    ...generateMessages(40, { category: 'promotional' }),
    ...generateMessages(10, { category: 'work' })
  ];
}

// ============================================================================
// Example 5: Project-specific tags and messages
// ============================================================================

export function createProjectAlphaScenario() {
  const tags = [
    { id: 'tag-alpha', name: 'Projects/Alpha', created_at: Date.now() - 1000000 },
    { id: 'tag-alpha-design', name: 'Projects/Alpha/Design', created_at: Date.now() - 900000 },
    { id: 'tag-alpha-dev', name: 'Projects/Alpha/Development', created_at: Date.now() - 800000 },
    { id: 'tag-alpha-qa', name: 'Projects/Alpha/QA', created_at: Date.now() - 700000 }
  ];

  const messages = [
    generateMessage({
      category: 'work',
      subject: 'Alpha Project: Design Review',
      from: 'designer@company.com'
    }),
    generateMessage({
      category: 'work',
      subject: 'Alpha: Development Status Update',
      from: 'dev@company.com'
    }),
    generateMessage({
      category: 'work',
      subject: 'QA Report: Alpha Testing Results',
      from: 'qa@company.com',
      hasAttachments: true
    })
  ];

  // Apply project tags
  messages[0].tag = 'Projects/Alpha/Design';
  messages[0].tag_confidence = 0.95;
  messages[1].tag = 'Projects/Alpha/Development';
  messages[1].tag_confidence = 0.92;
  messages[2].tag = 'Projects/Alpha/QA';
  messages[2].tag_confidence = 0.89;

  return { messages, tags };
}

// ============================================================================
// Example 6: Email thread simulation
// ============================================================================

export function createEmailThread() {
  const threadId = `thread-${Date.now()}`;
  const baseTime = Date.now() - 86400000; // 1 day ago

  return [
    generateMessage({
      id: `${threadId}-1`,
      category: 'work',
      subject: 'Q4 Budget Planning',
      from: 'alice@company.com',
      receivedAt: baseTime
    }),
    generateMessage({
      id: `${threadId}-2`,
      category: 'work',
      subject: 'Re: Q4 Budget Planning',
      from: 'bob@company.com',
      receivedAt: baseTime + 3600000 // 1 hour later
    }),
    generateMessage({
      id: `${threadId}-3`,
      category: 'work',
      subject: 'Re: Q4 Budget Planning',
      from: 'charlie@company.com',
      receivedAt: baseTime + 7200000, // 2 hours later
      hasAttachments: true
    }),
    generateMessage({
      id: `${threadId}-4`,
      category: 'work',
      subject: 'Re: Q4 Budget Planning',
      from: 'alice@company.com',
      receivedAt: baseTime + 10800000 // 3 hours later
    })
  ];
}

// ============================================================================
// Example 7: Mixed confidence tagging (for testing UI confidence display)
// ============================================================================

export function createMixedConfidenceScenario() {
  const messages = generateMessages(10);

  // Manually set various confidence levels
  messages[0].tag = 'Work';
  messages[0].tag_confidence = 0.99; // Very high

  messages[1].tag = 'Personal';
  messages[1].tag_confidence = 0.85; // High

  messages[2].tag = 'Finance';
  messages[2].tag_confidence = 0.65; // Medium

  messages[3].tag = 'Projects/Alpha';
  messages[3].tag_confidence = 0.45; // Low

  messages[4].tag = 'spam';
  messages[4].tag_confidence = 0.25; // Very low

  messages[5].tag = null; // Untagged
  messages[5].tag_confidence = null;

  return messages;
}

// ============================================================================
// Example 8: Performance testing dataset
// ============================================================================

export function createPerformanceTestDataset() {
  console.log('Generating large dataset for performance testing...');

  const messages = [];
  const batchSize = 100;
  const totalBatches = 10; // 1000 messages total

  for (let i = 0; i < totalBatches; i++) {
    messages.push(...generateMessages(batchSize));
    console.log(`Generated batch ${i + 1}/${totalBatches}`);
  }

  console.log(`Total: ${messages.length} messages`);
  return messages;
}

// ============================================================================
// Example 9: Combine multiple scenarios
// ============================================================================

export function createRealisticDayInbox() {
  return [
    // Morning emails (work)
    ...generateMessages(5, {
      category: 'work',
      receivedAt: Date.now() - 3600000 * 6 // 6 hours ago
    }),

    // Midday spam
    ...generateMessages(3, {
      category: 'promotional',
      receivedAt: Date.now() - 3600000 * 4 // 4 hours ago
    }),

    // Afternoon newsletters
    ...generateMessages(2, {
      category: 'newsletter',
      receivedAt: Date.now() - 3600000 * 2 // 2 hours ago
    }),

    // Evening personal
    ...generateMessages(2, {
      category: 'personal',
      receivedAt: Date.now() - 3600000 // 1 hour ago
    }),

    // Recent notifications
    ...generateMessages(3, {
      category: 'notification',
      receivedAt: Date.now() - 600000 // 10 minutes ago
    })
  ];
}

// ============================================================================
// Example 10: Custom email generator
// ============================================================================

export function createCustomEmail(options) {
  const {
    from = generateEmail(),
    subject = 'Custom Test Email',
    category = 'work',
    tag = 'Work',
    hasAttachments = false,
    daysAgo = 0
  } = options;

  const receivedAt = Date.now() - (daysAgo * 86400000);

  return generateMessage({
    from,
    subject,
    category,
    hasAttachments,
    receivedAt,
    tag,
    tag_confidence: 0.95,
    tag_reason: 'Custom test email'
  });
}

// ============================================================================
// Usage Examples
// ============================================================================

/*

// Use in your mock server:
import { createProductManagerInbox } from './examples/custom-mock-data.js';

let messages = createProductManagerInbox();


// Or mix and match:
import {
  createUrgentWorkEmails,
  createSpamHeavyInbox,
  createTimelineInbox
} from './examples/custom-mock-data.js';

let messages = [
  ...createUrgentWorkEmails(),
  ...createTimelineInbox(),
  ...createSpamHeavyInbox()
];


// Or create custom:
import { createCustomEmail } from './examples/custom-mock-data.js';

const testEmail = createCustomEmail({
  from: 'boss@company.com',
  subject: 'Urgent: Review Needed',
  tag: 'Finance',
  hasAttachments: true,
  daysAgo: 2
});


// For tests:
import { createMixedConfidenceScenario } from './examples/custom-mock-data.js';
import { test, expect } from '@playwright/test';

test('confidence badges display correctly', async ({ page }) => {
  const messages = createMixedConfidenceScenario();
  // ... your test code
});

*/
