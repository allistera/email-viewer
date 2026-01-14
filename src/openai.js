/**
 * OpenAI spam classification client
 */

import { stripHtml } from './mime.js';

/**
 * Truncate string to max length
 */
function truncate(str, maxLength) {
  if (!str) return '';
  return str.length <= maxLength ? str : str.substring(0, maxLength);
}

/**
 * Build truncated input for OpenAI according to spec
 */
export function buildSpamCheckInput(message) {
  const bodyText = message.text_body || stripHtml(message.html_body);

  return {
    from: truncate(message.from_addr, 200),
    to: truncate(message.to_addr, 200),
    subject: truncate(message.subject, 200),
    snippet: truncate(message.snippet, 300),
    body: truncate(bodyText, 2000)
  };
}

/**
 * Classify email as spam using OpenAI
 */
export async function classifySpam(message, env) {
  const input = buildSpamCheckInput(message);

  const prompt = `Analyze this email and determine if it's spam.

From: ${input.from}
To: ${input.to}
Subject: ${input.subject}
Snippet: ${input.snippet}
Body: ${input.body}

Respond with JSON in this exact format:
{
  "is_spam": true or false,
  "confidence": 0.0 to 1.0,
  "reason": "Short explanation"
}`;

  try {
    const response = await callOpenAI(prompt, env);
    return parseSpamResponse(response);
  } catch (error) {
    console.error('OpenAI classification error (attempt 1):', error.message);

    try {
      const response = await callOpenAI(prompt, env);
      return parseSpamResponse(response);
    } catch (retryError) {
      console.error('OpenAI classification error (attempt 2):', retryError.message);

      return {
        spam_status: 'unknown',
        spam_confidence: null,
        spam_reason: `Classification failed: ${retryError.message}`,
        spam_checked_at: Date.now()
      };
    }
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(prompt, env) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL || 'gpt-4o-mini';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a spam detection system. Analyze emails and respond only with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 150
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Parse OpenAI response into spam data
 */
function parseSpamResponse(responseText) {
  const parsed = JSON.parse(responseText);

  const isSpam = parsed.is_spam === true;
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : null;
  const reason = parsed.reason || 'No reason provided';

  return {
    spam_status: isSpam ? 'spam' : 'ham',
    spam_confidence: confidence,
    spam_reason: reason,
    spam_checked_at: Date.now()
  };
}
