/**
 * OpenAI Tag Classifier Client
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

export const MessageClassifier = {
  /**
   * Classify email into a single best matching tag (including "spam").
   * @param {Object} message
   * @param {string[]} tags
   * @param {string} apiKey
   * @param {string} model
   */
  async classify(message, tags, apiKey, model = 'gpt-4o-mini') {
    const safeTags = Array.isArray(tags) ? tags.filter(Boolean) : [];
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
              content: `You are a specialized email classification system.
              Analyze the metadata and body provided.
              Choose the single best tag from the provided list.
              Use the "spam" tag when the email is spam.
              If no tag clearly matches (including spam), return null for tag.
              Return JSON matching this schema:
              {
                "tag": { "tag": string|null, "confidence": number (0-1), "reason": "string" }
              }
              Only output tags from the provided list.
              Only output a single tag.`
            },
            {
              role: 'user',
              content: JSON.stringify({ tags: safeTags, email: input })
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
      const parsed = JSON.parse(content);
      const tagValue = parsed?.tag?.tag ?? null;

      if (tagValue && !safeTags.includes(tagValue)) {
        return {
          tag: { tag: null, confidence: parsed?.tag?.confidence ?? 0, reason: 'Tag not in list' }
        };
      }

      return parsed;
    } catch (e) {
      console.error('Message classification failed:', e);
      return null;
    }
  }
};
