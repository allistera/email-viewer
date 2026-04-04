import { test, expect } from '@playwright/test';

// Helper to generate mock events - uses current date to ensure events
// appear in the current month/week view
function mockEvent(overrides = {}) {
  const today = new Date();
  today.setHours(10, 0, 0, 0);
  const now = today.getTime();
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    title: 'Team Meeting',
    description: 'Weekly sync',
    start_time: now,
    end_time: now + 3600000,
    all_day: 0,
    color: '#5865f2',
    created_at: now,
    updated_at: now,
    ...overrides
  };
}

async function setupCommonRoutes(page) {
  await page.addInitScript(() => {
    localStorage.setItem('email_api_token', 'test-token');
  });

  // Mock SSE stream to prevent stalling EventSource connections
  await page.route('**/api/stream*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: ':ok\n\n'
    });
  });

  // Mock messages/counts (register before messages to avoid glob overlap)
  await page.route('**/api/messages/counts', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ inbox: 0, archive: 0, spam: 0, sent: 0, tags: {} })
    });
  });

  await page.route('**/api/messages?*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], nextBefore: null })
    });
  });

  // Mock tags - handle all methods to prevent stalls
  await page.route('**/api/tags**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'spam-id', name: 'Spam' }])
      });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
  });
}

async function navigateToCalendar(page) {
  await page.goto('/');
  await expect(page.locator('.discord-sidebar')).toBeVisible({ timeout: 10000 });
  await page.click('button[aria-label="Calendar"]');
  await expect(page.locator('.calendar-view')).toBeVisible({ timeout: 5000 });
}

// Route handler that handles ALL methods to prevent request stalls
function calendarEventsRoute(events, options = {}) {
  return async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events })
      });
    } else if (method === 'POST') {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'new-event-id',
          ...body,
          created_at: Date.now(),
          updated_at: Date.now()
        })
      });
    } else if (method === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'updated', updated_at: Date.now() })
      });
    } else if (method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    } else {
      await route.fulfill({ status: 405, body: 'Method not allowed' });
    }
  };
}

test.describe('Calendar View', () => {
  test.beforeEach(async ({ page }) => {
    await setupCommonRoutes(page);
    await page.route('**/api/calendar/events**', calendarEventsRoute([mockEvent()]));
    await navigateToCalendar(page);
  });

  test('should show calendar view when calendar button is clicked', async ({ page }) => {
    await expect(page.locator('.calendar-view')).toBeVisible();
    await expect(page.locator('.calendar-header')).toBeVisible();
  });

  test('should default to month view', async ({ page }) => {
    await expect(page.locator('.month-view')).toBeVisible();
    await expect(page.locator('.view-tab.active')).toHaveText('Month');
  });

  test('should switch between view modes', async ({ page }) => {
    await page.click('.view-tab:has-text("Week")');
    await expect(page.locator('.week-view')).toBeVisible();
    await expect(page.locator('.month-view')).toBeHidden();

    await page.click('.view-tab:has-text("Year")');
    await expect(page.locator('.year-view')).toBeVisible();
    await expect(page.locator('.week-view')).toBeHidden();

    await page.click('.view-tab:has-text("Month")');
    await expect(page.locator('.month-view')).toBeVisible();
  });

  test('should display header title for month view', async ({ page }) => {
    const title = page.locator('.calendar-title');
    await expect(title).toBeVisible();
    const text = await title.textContent();
    expect(text).toMatch(/\w+ \d{4}/);
  });

  test('should navigate to previous and next month', async ({ page }) => {
    const title = page.locator('.calendar-title');
    const initialTitle = await title.textContent();

    await page.click('button[title="Next"]');
    const nextTitle = await title.textContent();
    expect(nextTitle).not.toBe(initialTitle);

    await page.click('button[title="Previous"]');
    await page.click('button[title="Previous"]');
    const prevTitle = await title.textContent();
    expect(prevTitle).not.toBe(initialTitle);
  });

  test('should return to today when Today button is clicked', async ({ page }) => {
    const title = page.locator('.calendar-title');
    const initialTitle = await title.textContent();

    await page.click('button[title="Next"]');
    await page.click('button[title="Next"]');
    await page.click('button[title="Next"]');

    await page.click('.today-btn');
    const todayTitle = await title.textContent();
    expect(todayTitle).toBe(initialTitle);
  });

  test('should display day names in month header', async ({ page }) => {
    const dayNames = page.locator('.month-day-name');
    await expect(dayNames).toHaveCount(7);
    await expect(dayNames.first()).toHaveText('Sun');
  });

  test('should display month grid with cells', async ({ page }) => {
    const cells = page.locator('.month-cell');
    await expect(cells).toHaveCount(42); // 6 rows * 7 days
  });

  test('should highlight today in month view', async ({ page }) => {
    const todayBadge = page.locator('.month-cell.today .today-badge');
    await expect(todayBadge).toBeVisible();
    const todayDate = new Date().getDate();
    await expect(todayBadge).toHaveText(String(todayDate));
  });

  test('should display events in month view', async ({ page }) => {
    const monthEvents = page.locator('.month-event');
    await expect(monthEvents.first()).toBeVisible({ timeout: 5000 });
    await expect(monthEvents.first()).toContainText('Team Meeting');
  });
});

test.describe('Calendar Week View', () => {
  test.beforeEach(async ({ page }) => {
    await setupCommonRoutes(page);
    await page.route('**/api/calendar/events**', calendarEventsRoute([mockEvent()]));
    await navigateToCalendar(page);
    await page.click('.view-tab:has-text("Week")');
    await expect(page.locator('.week-view')).toBeVisible();
  });

  test('should display 7 day columns', async ({ page }) => {
    const dayHeaders = page.locator('.week-day-header');
    await expect(dayHeaders).toHaveCount(7);
  });

  test('should display time gutter with 24 hours', async ({ page }) => {
    const timeLabels = page.locator('.time-slot-label');
    await expect(timeLabels).toHaveCount(24);
    await expect(timeLabels.first()).toHaveText('12 AM');
  });

  test('should display event blocks in week view', async ({ page }) => {
    const eventBlocks = page.locator('.event-block');
    await expect(eventBlocks.first()).toBeVisible({ timeout: 5000 });
    await expect(eventBlocks.first()).toContainText('Team Meeting');
  });

  test('should navigate weeks with previous/next buttons', async ({ page }) => {
    const title = page.locator('.calendar-title');
    const initialTitle = await title.textContent();

    await page.click('button[title="Next"]');
    const nextTitle = await title.textContent();
    expect(nextTitle).not.toBe(initialTitle);
  });
});

test.describe('Calendar Year View', () => {
  test.beforeEach(async ({ page }) => {
    await setupCommonRoutes(page);
    await page.route('**/api/calendar/events**', calendarEventsRoute([]));
    await navigateToCalendar(page);
    await page.click('.view-tab:has-text("Year")');
    await expect(page.locator('.year-view')).toBeVisible();
  });

  test('should display all 12 months', async ({ page }) => {
    const months = page.locator('.year-month');
    await expect(months).toHaveCount(12);
  });

  test('should show year in header title', async ({ page }) => {
    const title = page.locator('.calendar-title');
    const currentYear = new Date().getFullYear();
    await expect(title).toHaveText(String(currentYear));
  });

  test('should display month names', async ({ page }) => {
    await expect(page.locator('.year-month-title').first()).toHaveText('January');
    await expect(page.locator('.year-month-title').last()).toHaveText('December');
  });

  test('should switch to month view when clicking a month', async ({ page }) => {
    await page.locator('.year-month').nth(5).click(); // June
    await expect(page.locator('.month-view')).toBeVisible();
    await expect(page.locator('.calendar-title')).toContainText('June');
  });

  test('should navigate years with previous/next buttons', async ({ page }) => {
    const title = page.locator('.calendar-title');
    const currentYear = new Date().getFullYear();
    await expect(title).toHaveText(String(currentYear));

    await page.click('button[title="Next"]');
    await expect(title).toHaveText(String(currentYear + 1));

    await page.click('button[title="Previous"]');
    await expect(title).toHaveText(String(currentYear));
  });
});

test.describe('Calendar Event Creation', () => {
  test.beforeEach(async ({ page }) => {
    await setupCommonRoutes(page);
    await page.route('**/api/calendar/events**', calendarEventsRoute([]));
    await navigateToCalendar(page);
  });

  test('should open event modal when clicking a month cell', async ({ page }) => {
    const currentMonthCell = page.locator('.month-cell:not(.other-month)').first();
    await currentMonthCell.click();

    await expect(page.locator('.event-modal')).toBeVisible();
    await expect(page.locator('.event-modal h3')).toHaveText('New Event');
  });

  test('should show all form fields in the event modal', async ({ page }) => {
    await page.locator('.month-cell:not(.other-month)').first().click();
    const modal = page.locator('.event-modal');

    await expect(modal.locator('input[placeholder="Event title"]')).toBeVisible();
    await expect(modal.locator('textarea[placeholder="Description (optional)"]')).toBeVisible();
    await expect(modal.locator('input[type="date"]').first()).toBeVisible();
    await expect(modal.locator('input[type="time"]').first()).toBeVisible();
    await expect(modal.locator('.color-picker')).toBeVisible();
  });

  test('should close modal when Cancel is clicked', async ({ page }) => {
    await page.locator('.month-cell:not(.other-month)').first().click();
    await expect(page.locator('.event-modal')).toBeVisible();

    await page.click('.btn-secondary:has-text("Cancel")');
    await expect(page.locator('.event-modal')).toBeHidden();
  });

  test('should close modal when clicking overlay', async ({ page }) => {
    await page.locator('.month-cell:not(.other-month)').first().click();
    await expect(page.locator('.event-modal')).toBeVisible();

    await page.locator('.modal-overlay').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.event-modal')).toBeHidden();
  });

  test('should create a new event via the form', async ({ page }) => {
    await page.locator('.month-cell:not(.other-month)').first().click();

    const postRequestPromise = page.waitForRequest(
      req => req.url().includes('/api/calendar/events') && req.method() === 'POST',
      { timeout: 5000 }
    );

    await page.fill('input[placeholder="Event title"]', 'New Test Event');
    await page.fill('textarea[placeholder="Description (optional)"]', 'Test description');

    await page.click('.btn-primary:has-text("Save")');

    const postRequest = await postRequestPromise;
    const body = postRequest.postDataJSON();
    expect(body.title).toBe('New Test Event');
    expect(body.description).toBe('Test description');
    expect(body.startTime).toBeDefined();
    expect(body.endTime).toBeDefined();

    await expect(page.locator('.event-modal')).toBeHidden();
  });

  test('should toggle all-day checkbox and hide time inputs', async ({ page }) => {
    await page.locator('.month-cell:not(.other-month)').first().click();

    await expect(page.locator('input[type="time"]').first()).toBeVisible();

    await page.locator('.checkbox-group input[type="checkbox"]').check();

    await expect(page.locator('input[type="time"]')).toHaveCount(0);
  });

  test('should select a color from the color picker', async ({ page }) => {
    await page.locator('.month-cell:not(.other-month)').first().click();

    const swatches = page.locator('.color-swatch');
    await swatches.nth(2).click();

    await expect(swatches.nth(2)).toHaveClass(/active/);
  });
});

test.describe('Calendar Event Editing', () => {
  test.beforeEach(async ({ page }) => {
    await setupCommonRoutes(page);

    const existingEvent = mockEvent({
      id: 'edit-event-id',
      title: 'Existing Event',
      description: 'Existing description'
    });

    await page.route('**/api/calendar/events**', async route => {
      const method = route.request().method();
      const url = route.request().url();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ events: [existingEvent] })
        });
      } else if (method === 'PUT' && url.includes(existingEvent.id)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: existingEvent.id, updated_at: Date.now() })
        });
      } else if (method === 'DELETE' && url.includes(existingEvent.id)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
    });

    await navigateToCalendar(page);
  });

  test('should open edit modal when clicking an event', async ({ page }) => {
    const event = page.locator('.month-event').first();
    await expect(event).toBeVisible({ timeout: 5000 });
    await event.click();

    await expect(page.locator('.event-modal')).toBeVisible();
    await expect(page.locator('.event-modal h3')).toHaveText('Edit Event');
    await expect(page.locator('input[placeholder="Event title"]')).toHaveValue('Existing Event');
  });

  test('should show delete button when editing an event', async ({ page }) => {
    await page.locator('.month-event').first().click();
    await expect(page.locator('.btn-danger:has-text("Delete")')).toBeVisible();
  });

  test('should update an event', async ({ page }) => {
    await page.locator('.month-event').first().click();

    const putRequestPromise = page.waitForRequest(
      req => req.url().includes('/api/calendar/events/') && req.method() === 'PUT',
      { timeout: 5000 }
    );

    await page.fill('input[placeholder="Event title"]', 'Updated Event Title');
    await page.click('.btn-primary:has-text("Save")');

    const putRequest = await putRequestPromise;
    const body = putRequest.postDataJSON();
    expect(body.title).toBe('Updated Event Title');

    await expect(page.locator('.event-modal')).toBeHidden();
  });

  test('should delete an event', async ({ page }) => {
    await page.locator('.month-event').first().click();

    const deleteRequestPromise = page.waitForRequest(
      req => req.url().includes('/api/calendar/events/') && req.method() === 'DELETE',
      { timeout: 5000 }
    );

    await page.click('.btn-danger:has-text("Delete")');

    await deleteRequestPromise;
    await expect(page.locator('.event-modal')).toBeHidden();
  });
});

test.describe('Calendar Navigation Rail', () => {
  test.beforeEach(async ({ page }) => {
    await setupCommonRoutes(page);
    await page.route('**/api/calendar/events**', calendarEventsRoute([]));
  });

  test('should show calendar button in right sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.discord-sidebar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button[aria-label="Calendar"]')).toBeVisible();
  });

  test('should toggle between email and calendar views', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.discord-sidebar')).toBeVisible({ timeout: 10000 });

    await page.click('button[aria-label="Calendar"]');
    await expect(page.locator('.calendar-view')).toBeVisible();

    await page.click('button[aria-label="Email"]');
    await expect(page.locator('.calendar-view')).toBeHidden();
  });

  test('calendar button should show active state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.discord-sidebar')).toBeVisible({ timeout: 10000 });

    await page.click('button[aria-label="Calendar"]');
    const calendarBtn = page.locator('button[aria-label="Calendar"]');
    await expect(calendarBtn).toHaveAttribute('data-active', 'true');
  });
});
