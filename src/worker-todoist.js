import * as Sentry from "@sentry/cloudflare";
import { DB } from './db.js';
import { TodoistProjectSelector } from './openai.js';
import { buildTodoistTaskPayload, createTodoistTask, fetchTodoistProjects, findInboxProject } from './todoist.js';

const MISSING_TABLE_PATTERN = /no such table/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isMissingTableError = (error) =>
  Boolean(error?.message && MISSING_TABLE_PATTERN.test(error.message));

const jsonResponse = (payload, init = {}) =>
  new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init
  });

const databaseNotInitializedResponse = () =>
  jsonResponse(
    {
      error: 'Database not initialized.',
      details: 'Run: npx wrangler d1 migrations apply maildb --remote'
    },
    { status: 500 }
  );

const isValidUUID = (id) => typeof id === 'string' && UUID_REGEX.test(id);

const resolveMessageUrl = (origin, messageId) => {
  if (!origin) return '';
  try {
    return new URL(`/#message=${messageId}`, origin).toString();
  } catch {
    return '';
  }
};

const selectProject = (projects, selection) => {
  if (!selection) return null;
  if (selection.projectId) {
    const byId = projects.find(project => String(project.id) === String(selection.projectId));
    if (byId) return byId;
  }
  if (selection.projectName) {
    const projectName = String(selection.projectName).toLowerCase();
    const byName = projects.find(project => (project?.name || '').toLowerCase() === projectName);
    if (byName) return byName;
  }
  return null;
};

const sentryOptions = (env) => ({
  dsn: env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  enableLogs: true,
  sendDefaultPii: true,
});

export default Sentry.withSentry(sentryOptions, {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\//, '').replace(/\/$/, '');

    try {
      if (!path.startsWith('messages/')) {
        return new Response('Not Found', { status: 404 });
      }

      const parts = path.split('/');
      const messageId = parts[1];

      if (!isValidUUID(messageId)) {
        return jsonResponse({ error: 'Invalid message ID format' }, { status: 400 });
      }

      if (!(parts.length === 3 && parts[2] === 'todoist' && request.method === 'POST')) {
        return new Response('Not Found', { status: 404 });
      }

      const todoistToken = (request.headers.get('X-Todoist-Token') || '').trim();
      if (!todoistToken) {
        return jsonResponse({ error: 'Todoist token missing.' }, { status: 400 });
      }

      const message = await DB.getMessage(env.DB, messageId);
      if (!message) return new Response('Message Not Found', { status: 404 });

      const projects = await fetchTodoistProjects(todoistToken);
      const selection = await TodoistProjectSelector.selectProject(
        message,
        projects,
        env.OPENAI_API_KEY,
        env.OPENAI_MODEL
      );

      const inboxProject = findInboxProject(projects);
      const selectedProject = selectProject(projects, selection) || inboxProject || null;
      const messageUrl = resolveMessageUrl(request.headers.get('X-App-Origin'), message.id);

      const payload = buildTodoistTaskPayload(message, messageUrl, selectedProject?.id);
      const task = await createTodoistTask(todoistToken, payload);

      let todoistUpdateWarning = null;
      try {
        await DB.updateTodoistInfo(env.DB, messageId, {
          projectName: selectedProject?.name || null,
          projectUrl: selectedProject?.url || null
        });
      } catch (updateError) {
        todoistUpdateWarning = 'Task created but project metadata was not saved.';
        console.error('Failed to update Todoist metadata:', updateError);
        Sentry.captureException(updateError);
      }

      return jsonResponse({
        ok: true,
        task,
        project: selectedProject
          ? { id: selectedProject.id, name: selectedProject.name, url: selectedProject.url || null }
          : null,
        warning: todoistUpdateWarning
      });
    } catch (error) {
      if (isMissingTableError(error)) {
        return databaseNotInitializedResponse();
      }
      const message = error?.message || 'Todoist request failed.';
      const status = message.includes('Todoist request failed') ? 502 : 500;
      return jsonResponse({ error: message }, { status });
    }
  }
});
