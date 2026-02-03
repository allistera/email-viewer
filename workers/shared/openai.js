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

const buildTodoistInput = (message) => {
  const input = {
    from: (message.from_addr || '').substring(0, 200),
    to: (message.to_addr || '').substring(0, 200),
    subject: (message.subject || '').substring(0, 200),
    snippet: (message.snippet || '').substring(0, 500),
    body: (message.text_body || '').substring(0, 3000)
  };

  if (!input.body && message.html_body) {
    input.body = message.html_body.replace(/<[^>]*>?/gm, ' ').substring(0, 3000);
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
      
      // Validate response structure
      if (!data?.choices?.[0]?.message?.content) {
        console.error('Invalid OpenAI response structure:', data);
        return null;
      }
      
      const content = data.choices[0].message.content;
      const parsed = JSON.parse(content);
      const tagValue = parsed?.tag?.tag ?? null;

      // Case-insensitive tag validation - find matching tag from the list
      if (tagValue) {
        const matchedTag = safeTags.find(t => t.toLowerCase() === tagValue.toLowerCase());
        if (!matchedTag) {
          return {
            tag: { tag: null, confidence: parsed?.tag?.confidence ?? 0, reason: 'Tag not in list' }
          };
        }
        // Use the original tag name from our list to ensure consistency
        parsed.tag.tag = matchedTag;
      }

      return parsed;
    } catch (e) {
      console.error('Message classification failed:', e);
      return null;
    }
  }
};

export const TodoistProjectSelector = {
  /**
   * Select best Todoist project for a message.
   * @param {Object} message
   * @param {Array<Object>} projects
   * @param {string} apiKey
   * @param {string} model
   */
  async selectProject(message, projects, apiKey, model = 'gpt-4o-mini') {
    const safeProjects = Array.isArray(projects)
      ? projects
        .filter(project => project?.id && project?.name)
        .map(project => ({
          id: String(project.id),
          name: String(project.name).substring(0, 200),
          parent_id: project.parent_id || null,
          is_inbox_project: Boolean(project.is_inbox_project)
        }))
      : [];

    if (!apiKey || safeProjects.length === 0) {
      return { projectId: null, projectName: null, reason: 'Missing API key or projects.' };
    }

    const input = buildTodoistInput(message);

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
              content: `You are a Todoist project selection assistant.
Choose the single best project from the list for this email.
If none match, return null for both project_id and project_name.
Only choose from the provided list and do not invent new projects.
Return JSON in this schema:
{
  "project_id": string|null,
  "project_name": string|null,
  "reason": "string"
}`
            },
            {
              role: 'user',
              content: JSON.stringify({ projects: safeProjects, email: input })
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        console.error('OpenAI Todoist selector error:', await response.text());
        return { projectId: null, projectName: null, reason: 'OpenAI request failed.' };
      }

      const data = await response.json();

      if (!data?.choices?.[0]?.message?.content) {
        console.error('Invalid OpenAI response structure:', data);
        return { projectId: null, projectName: null, reason: 'Invalid OpenAI response.' };
      }

      const content = data.choices[0].message.content;
      const parsed = JSON.parse(content);
      const projectId = parsed?.project_id ?? null;
      const projectName = parsed?.project_name ?? null;

      return {
        projectId: projectId ? String(projectId) : null,
        projectName: projectName ? String(projectName) : null,
        reason: parsed?.reason || ''
      };
    } catch (e) {
      console.error('Todoist project selection failed:', e);
      return { projectId: null, projectName: null, reason: 'Todoist selection failed.' };
    }
  }
};
