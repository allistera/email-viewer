/**
 * OpenAI Spam Classifier Client
 */

const buildMessageInput = (message) => {
  const input = {
    from: (message.from_addr || '').substring(0, 200),
    to: (message.to_addr || '').substring(0, 200),
    subject: (message.subject || '').substring(0, 200),
    snippet: (message.snippet || '').substring(0, 300),
    body: (message.text_body || '').substring(0, 2000)
  };

  if (!input.body && message.html_body) {
    input.body = message.html_body.replace(/<[^>]*>?/gm, ' ').substring(0, 2000);
  }

  return input;
};

export const SpamClassifier = {
  /**
   * Classify email as spam/ham
   * @param {Object} message 
   * @param {string} apiKey 
   * @param {string} model 
   */
  async classify(message, apiKey, model = 'gpt-4o-mini') {
    // 1. Truncate input (cost saving)
    const input = buildMessageInput(message);

    // 2. Call OpenAI
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: `You are a specialized spam detection system for a personal email inbox. 
              Analyze the metadata and body provided. 
              Return JSON matching this schema: { "is_spam": boolean, "confidence": number (0-1), "reason": "string" }.
              High confidence (0.9+) is required to mark as true.`
            },
            {
              role: 'user',
              content: JSON.stringify(input)
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        console.error('OpenAI Error:', await response.text());
        return null;
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      return JSON.parse(content);

    } catch (e) {
      console.error('Spam classification failed:', e);
      return null;
    }
  }
};

export const TagClassifier = {
  /**
   * Assign best tag for an email
   * @param {Object} message
   * @param {string[]} tags
   * @param {string} apiKey
   * @param {string} model
   */
  async classify(message, tags, apiKey, model = 'gpt-4o-mini') {
    const input = buildMessageInput(message);

    const normalizedTags = tags.map(tag => tag.trim()).filter(Boolean);
    if (normalizedTags.length === 0) return null;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: `You label incoming emails with a single tag from the provided list.
              Choose the best matching tag from the list, or return null if none apply.
              Return JSON matching this schema: { "tag": string | null, "confidence": number (0-1), "reason": "string" }.
              Only use exact tags from the list.`
            },
            {
              role: 'user',
              content: JSON.stringify({ tags: normalizedTags, email: input })
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        console.error('OpenAI Tagging Error:', await response.text());
        return null;
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const parsed = JSON.parse(content);
      const tag = typeof parsed.tag === 'string' ? parsed.tag.trim() : null;
      const match = tag
        ? normalizedTags.find(option => option.toLowerCase() === tag.toLowerCase())
        : null;

      if (!match) return { tag: null, confidence: 0, reason: parsed.reason || '' };

      return {
        tag: match,
        confidence: Number(parsed.confidence) || 0,
        reason: parsed.reason || ''
      };
    } catch (e) {
      console.error('Tag classification failed:', e);
      return null;
    }
  }
};
