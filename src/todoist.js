const TODOIST_TASKS_API_URL = 'https://api.todoist.com/rest/v2/tasks';
const TODOIST_PROJECTS_API_URL = 'https://api.todoist.com/rest/v2/projects';
const TODOIST_CONTENT_MAX = 500;
const TODOIST_DESCRIPTION_MAX = 2000;

const truncateText = (value, maxLength) => {
  if (!value) return '';
  const text = String(value);
  if (text.length <= maxLength) return text;
  const sliceLength = Math.max(0, maxLength - 3);
  return `${text.slice(0, sliceLength)}...`;
};

const normalizeTodoistLine = (value, maxLength) => {
  if (!value) return '';
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return truncateText(cleaned, maxLength);
};

const normalizeTodoistDescription = (value, maxLength) => {
  if (!value) return '';
  const cleaned = String(value).replace(/\r\n/g, '\n').trim();
  return truncateText(cleaned, maxLength);
};

const formatIsoDate = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
  } catch {
    return '';
  }
};

const buildTodoistDescription = (message, messageUrl) => {
  const lines = [];
  if (messageUrl) lines.push(`Email: ${messageUrl}`);

  const from = normalizeTodoistLine(message.from_addr, 200);
  const to = normalizeTodoistLine(message.to_addr, 200);
  const received = formatIsoDate(message.received_at);
  const snippet = normalizeTodoistLine(message.snippet, 500);

  if (from) lines.push(`From: ${from}`);
  if (to) lines.push(`To: ${to}`);
  if (received) lines.push(`Received: ${received}`);
  if (snippet) lines.push(`Snippet: ${snippet}`);
  lines.push(`Message ID: ${message.id}`);

  return normalizeTodoistDescription(lines.join('\n'), TODOIST_DESCRIPTION_MAX);
};

export const buildTodoistTaskPayload = (message, messageUrl, projectId) => {
  const fallbackFrom = normalizeTodoistLine(message.from_addr, 200);
  const defaultContent = message.subject || message.snippet || (fallbackFrom ? `Email from ${fallbackFrom}` : 'Email task');
  const content = normalizeTodoistLine(defaultContent, TODOIST_CONTENT_MAX) || 'Email task';
  const description = buildTodoistDescription(message, messageUrl);

  const payload = { content };
  if (description) payload.description = description;
  if (projectId) payload.project_id = projectId;

  return payload;
};

const readTodoistError = async (response) => {
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    try {
      const errorBody = await response.json();
      return errorBody?.error || errorBody?.message || JSON.stringify(errorBody);
    } catch (e) {
      return '';
    }
  }
  return await response.text();
};

export const fetchTodoistProjects = async (todoistToken) => {
  const response = await fetch(TODOIST_PROJECTS_API_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${todoistToken}`
    }
  });

  if (!response.ok) {
    const errorDetails = await readTodoistError(response);
    const errorMessage = errorDetails
      ? `Todoist request failed: ${errorDetails}`
      : 'Todoist request failed.';
    throw new Error(errorMessage);
  }

  const projects = await response.json();
  return Array.isArray(projects) ? projects : [];
};

export const createTodoistTask = async (todoistToken, payload) => {
  const response = await fetch(TODOIST_TASKS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${todoistToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorDetails = await readTodoistError(response);
    const errorMessage = errorDetails
      ? `Todoist request failed: ${errorDetails}`
      : 'Todoist request failed.';
    throw new Error(errorMessage);
  }

  return response.json();
};

export const findInboxProject = (projects = []) => {
  if (!Array.isArray(projects)) return null;
  const inboxProject = projects.find(project => project?.is_inbox_project);
  if (inboxProject) return inboxProject;
  return projects.find(project => (project?.name || '').toLowerCase() === 'inbox') || null;
};
