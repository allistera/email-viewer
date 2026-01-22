/**
 * OpenAI Spam Classifier Client
 */

const buildInput = (message) => {
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
    const input = buildInput(message);

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
   * Classify email with best matching tag.
   * @param {Object} message
   * @param {string[]} tags
   * @param {string} apiKey
   * @param {string} model
   */
  async classify(message, tags, apiKey, model = 'gpt-4o-mini') {
    if (!Array.isArray(tags) || tags.length === 0) {
      return null;
    }

    const input = buildInput(message);

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
              content: `You are an email tagging assistant. 
              Choose the single best matching tag from the provided list.
              If no tag clearly matches, return null.
              Return JSON matching this schema: { "tag": string|null, "confidence": number (0-1), "reason": "string" }.
              Only output tags from the list.`
            },
            {
              role: 'user',
              content: JSON.stringify({ tags, email: input })
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

      if (parsed?.tag && !tags.includes(parsed.tag)) {
        return { tag: null, confidence: parsed.confidence ?? 0, reason: 'Tag not in list' };
      }

      return parsed;
    } catch (e) {
      console.error('Tag classification failed:', e);
      return null;
    }
  }
};
