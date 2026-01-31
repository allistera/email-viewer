# PR #26 Review - Required Fixes

## Quick Summary
3 issues found: 2 critical, 1 medium priority

---

## 🔴 CRITICAL FIX #1: Missing await in error handler

**File**: `src/todoist.js` line 78  
**Current code**:
```javascript
return response.text();  // Missing await
```

**Fixed code**:
```javascript
return await response.text();
```

**Why**: Without await, the function returns a Promise instead of a string, causing error messages to display as "[object Promise]" instead of the actual error.

---

## 🔴 CRITICAL FIX #2: XSS vulnerability in HTML sanitization

**File**: `web/src/components/MessageDetail.vue` lines 260-263  
**Current code**:
```javascript
.replace(/on\w+="[^"]*"/gi, '')  // Only removes double-quoted event handlers
```

**Fixed code (Option 1 - Better regex)**:
```javascript
.replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
```

**Fixed code (Option 2 - Use DOMPurify - RECOMMENDED)**:
```bash
npm install dompurify
```
```javascript
import DOMPurify from 'dompurify';

sanitizedHtml() {
  if (!this.message || !this.message.htmlBody) return '';
  return DOMPurify.sanitize(this.message.htmlBody, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'a', 'img', 'table', 'tr', 'td'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title']
  });
}
```

**Why**: Current regex doesn't catch unquoted or single-quoted event handlers like `<img src=x onerror=alert(1)>`. While iframe sandbox currently prevents execution, this violates defense-in-depth.

**Test cases that bypass current sanitization**:
```html
<img src=x onerror=alert(1)>         <!-- NOT SANITIZED -->
<img src=x onerror='alert(1)'>      <!-- NOT SANITIZED -->
```

---

## 🟡 MEDIUM FIX #3: Handle database update failure gracefully

**File**: `src/worker-todoist.js` lines 100-106  
**Problem**: If Todoist task creation succeeds but database update fails, user sees error and may retry, creating duplicate tasks.

**Suggested fix**:
```javascript
const payload = buildTodoistTaskPayload(message, messageUrl, selectedProject?.id);
const task = await createTodoistTask(todoistToken, payload);

// Wrap database update separately to handle failure gracefully
try {
  await DB.updateTodoistInfo(env.DB, messageId, {
    projectName: selectedProject?.name || null,
    projectUrl: selectedProject?.url || null
  });
} catch (dbError) {
  console.error('Database update failed after Todoist task creation:', dbError);
  // Task was created successfully, so return success with warning
  return jsonResponse({
    ok: true,
    task,
    project: selectedProject ? { 
      id: selectedProject.id, 
      name: selectedProject.name, 
      url: selectedProject.url || null 
    } : null,
    warning: 'Task created but metadata update failed'
  });
}

// Both operations succeeded
return jsonResponse({
  ok: true,
  task,
  project: selectedProject ? { 
    id: selectedProject.id, 
    name: selectedProject.name, 
    url: selectedProject.url || null 
  } : null
});
```

**Why**: This prevents duplicate task creation on retry while still informing the user of partial success.

---

## Estimated time to fix: 30-45 minutes

1. Fix #1: 2 minutes (add one word)
2. Fix #2: 15-30 minutes (depending on DOMPurify vs regex approach)
3. Fix #3: 10 minutes (restructure error handling)

---

See `PR_26_REVIEW.md` for complete analysis and additional recommendations.
