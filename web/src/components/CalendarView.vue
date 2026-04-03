<template>
  <div class="calendar-view">
    <!-- Header -->
    <div class="calendar-header">
      <div class="calendar-nav">
        <button class="nav-btn" title="Previous" @click="navigate(-1)">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="nav-btn today-btn" @click="goToday">Today</button>
        <button class="nav-btn" title="Next" @click="navigate(1)">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <h2 class="calendar-title">{{ headerTitle }}</h2>
      <div class="view-tabs">
        <button
          v-for="v in views"
          :key="v.key"
          class="view-tab"
          :class="{ active: viewMode === v.key }"
          @click="viewMode = v.key"
        >{{ v.label }}</button>
      </div>
    </div>

    <!-- Weekly View -->
    <div v-if="viewMode === 'week'" class="week-view">
      <div class="week-header">
        <div class="time-gutter-header"></div>
        <div
          v-for="day in weekDays"
          :key="day.key"
          class="week-day-header"
          :class="{ today: day.isToday }"
        >
          <span class="day-name">{{ day.name }}</span>
          <span class="day-number" :class="{ 'today-badge': day.isToday }">{{ day.date }}</span>
        </div>
      </div>
      <div class="week-body" ref="weekBody">
        <div class="week-grid">
          <div class="time-gutter">
            <div v-for="hour in 24" :key="hour" class="time-slot-label">
              {{ formatHour(hour - 1) }}
            </div>
          </div>
          <div
            v-for="day in weekDays"
            :key="day.key"
            class="day-column"
            :class="{ today: day.isToday }"
            @click="handleDayColumnClick($event, day)"
          >
            <div v-for="hour in 24" :key="hour" class="time-slot"></div>
            <div
              v-for="ev in getEventsForDay(day.dateObj)"
              :key="ev.id"
              class="event-block"
              :style="getEventStyle(ev, day.dateObj)"
              :title="ev.title"
              @click.stop="editEvent(ev)"
            >
              <span class="event-time">{{ formatEventTime(ev) }}</span>
              <span class="event-title">{{ ev.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Monthly View -->
    <div v-if="viewMode === 'month'" class="month-view">
      <div class="month-header">
        <div v-for="name in dayNames" :key="name" class="month-day-name">{{ name }}</div>
      </div>
      <div class="month-grid">
        <div
          v-for="day in monthDays"
          :key="day.key"
          class="month-cell"
          :class="{ 'other-month': !day.currentMonth, today: day.isToday }"
          @click="handleMonthCellClick(day)"
        >
          <span class="cell-date" :class="{ 'today-badge': day.isToday }">{{ day.date }}</span>
          <div class="cell-events">
            <div
              v-for="ev in getEventsForDay(day.dateObj).slice(0, 3)"
              :key="ev.id"
              class="month-event"
              :style="{ borderLeftColor: ev.color || 'var(--color-primary)' }"
              :title="ev.title"
              @click.stop="editEvent(ev)"
            >
              {{ ev.title }}
            </div>
            <div
              v-if="getEventsForDay(day.dateObj).length > 3"
              class="more-events"
            >
              +{{ getEventsForDay(day.dateObj).length - 3 }} more
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Yearly View -->
    <div v-if="viewMode === 'year'" class="year-view">
      <div
        v-for="month in yearMonths"
        :key="month.index"
        class="year-month"
        @click="jumpToMonth(month.index)"
      >
        <h3 class="year-month-title">{{ month.name }}</h3>
        <div class="mini-month-header">
          <span v-for="d in miniDayNames" :key="d">{{ d }}</span>
        </div>
        <div class="mini-month-grid">
          <div
            v-for="day in month.days"
            :key="day.key"
            class="mini-day"
            :class="{
              'other-month': !day.currentMonth,
              today: day.isToday,
              'has-events': getEventsForDay(day.dateObj).length > 0
            }"
          >
            {{ day.date }}
          </div>
        </div>
      </div>
    </div>

    <!-- Event Modal -->
    <div v-if="showEventModal" class="modal-overlay" @click.self="closeModal">
      <div class="event-modal">
        <h3>{{ editingEvent ? 'Edit Event' : 'New Event' }}</h3>
        <form @submit.prevent="saveEvent">
          <div class="form-group">
            <label>Title</label>
            <input
              v-model="eventForm.title"
              type="text"
              required
              placeholder="Event title"
              ref="titleInput"
            />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea
              v-model="eventForm.description"
              placeholder="Description (optional)"
              rows="3"
            ></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Start</label>
              <input
                v-model="eventForm.startDate"
                type="date"
                required
              />
              <input
                v-if="!eventForm.allDay"
                v-model="eventForm.startTime"
                type="time"
                required
              />
            </div>
            <div class="form-group">
              <label>End</label>
              <input
                v-model="eventForm.endDate"
                type="date"
                required
              />
              <input
                v-if="!eventForm.allDay"
                v-model="eventForm.endTime"
                type="time"
                required
              />
            </div>
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input v-model="eventForm.allDay" type="checkbox" />
              All day
            </label>
          </div>
          <div class="form-group">
            <label>Color</label>
            <div class="color-picker">
              <button
                v-for="c in colorOptions"
                :key="c"
                type="button"
                class="color-swatch"
                :class="{ active: eventForm.color === c }"
                :style="{ background: c }"
                @click="eventForm.color = c"
              ></button>
            </div>
          </div>
          <div class="modal-actions">
            <button
              v-if="editingEvent"
              type="button"
              class="btn btn-danger"
              @click="deleteEvent"
            >Delete</button>
            <div class="modal-actions-right">
              <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                {{ saving ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent
} from '../services/api.js';

export default {
  name: 'CalendarView',
  data() {
    return {
      viewMode: 'month',
      currentDate: new Date(),
      events: [],
      showEventModal: false,
      editingEvent: null,
      saving: false,
      eventForm: this.emptyForm(),
      views: [
        { key: 'week', label: 'Week' },
        { key: 'month', label: 'Month' },
        { key: 'year', label: 'Year' }
      ],
      colorOptions: [
        '#5865f2', '#23a559', '#f0b232', '#f23f43',
        '#e879a0', '#9b59b6', '#1abc9c', '#e67e22'
      ],
      dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      miniDayNames: ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    };
  },
  computed: {
    headerTitle() {
      const d = this.currentDate;
      if (this.viewMode === 'week') {
        const start = this.getWeekStart(d);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        if (start.getMonth() === end.getMonth()) {
          return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
        }
        return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()} – ${end.toLocaleDateString('en-US', { month: 'short' })} ${end.getDate()}, ${end.getFullYear()}`;
      }
      if (this.viewMode === 'month') {
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      return String(d.getFullYear());
    },
    weekDays() {
      const start = this.getWeekStart(this.currentDate);
      const today = new Date();
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        return {
          key: date.toISOString(),
          name: date.toLocaleDateString('en-US', { weekday: 'short' }),
          date: date.getDate(),
          dateObj: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          isToday: this.isSameDay(date, today)
        };
      });
    },
    monthDays() {
      const d = this.currentDate;
      const year = d.getFullYear();
      const month = d.getMonth();
      const firstDay = new Date(year, month, 1);
      const startOffset = firstDay.getDay();
      const today = new Date();
      const days = [];

      // Days from previous month
      for (let i = startOffset - 1; i >= 0; i--) {
        const date = new Date(year, month, -i);
        days.push({
          key: `prev-${i}`,
          date: date.getDate(),
          dateObj: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          currentMonth: false,
          isToday: this.isSameDay(date, today)
        });
      }

      // Days in current month
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        days.push({
          key: `cur-${i}`,
          date: i,
          dateObj: new Date(year, month, i),
          currentMonth: true,
          isToday: this.isSameDay(date, today)
        });
      }

      // Fill remaining cells to complete grid
      const remaining = 42 - days.length;
      for (let i = 1; i <= remaining; i++) {
        const date = new Date(year, month + 1, i);
        days.push({
          key: `next-${i}`,
          date: i,
          dateObj: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          currentMonth: false,
          isToday: this.isSameDay(date, today)
        });
      }

      return days;
    },
    yearMonths() {
      const year = this.currentDate.getFullYear();
      const today = new Date();
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      return monthNames.map((name, index) => {
        const firstDay = new Date(year, index, 1);
        const startOffset = firstDay.getDay();
        const daysInMonth = new Date(year, index + 1, 0).getDate();
        const days = [];

        for (let i = 0; i < startOffset; i++) {
          const date = new Date(year, index, -startOffset + i + 1);
          days.push({
            key: `${index}-prev-${i}`,
            date: date.getDate(),
            dateObj: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
            currentMonth: false,
            isToday: false
          });
        }

        for (let i = 1; i <= daysInMonth; i++) {
          const date = new Date(year, index, i);
          days.push({
            key: `${index}-${i}`,
            date: i,
            dateObj: new Date(year, index, i),
            currentMonth: true,
            isToday: this.isSameDay(date, today)
          });
        }

        // Fill to complete rows
        const totalCells = Math.ceil(days.length / 7) * 7;
        for (let i = days.length; i < totalCells; i++) {
          const dayNum = i - startOffset - daysInMonth + 1;
          const date = new Date(year, index + 1, dayNum);
          days.push({
            key: `${index}-next-${i}`,
            date: date.getDate(),
            dateObj: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
            currentMonth: false,
            isToday: false
          });
        }

        return { name, index, days };
      });
    }
  },
  watch: {
    viewMode() {
      this.loadEvents();
    },
    currentDate() {
      this.loadEvents();
    }
  },
  mounted() {
    this.loadEvents();
    this.$nextTick(() => {
      this.scrollToCurrentTime();
    });
  },
  methods: {
    emptyForm() {
      const now = new Date();
      const start = new Date(now);
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 1);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);
      return {
        title: '',
        description: '',
        startDate: this.toDateString(start),
        startTime: this.toTimeString(start),
        endDate: this.toDateString(end),
        endTime: this.toTimeString(end),
        allDay: false,
        color: '#5865f2'
      };
    },

    toDateString(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    toTimeString(d) {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },

    isSameDay(a, b) {
      return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
    },

    getWeekStart(d) {
      const date = new Date(d);
      date.setDate(date.getDate() - date.getDay());
      date.setHours(0, 0, 0, 0);
      return date;
    },

    formatHour(h) {
      if (h === 0) return '12 AM';
      if (h < 12) return `${h} AM`;
      if (h === 12) return '12 PM';
      return `${h - 12} PM`;
    },

    formatEventTime(ev) {
      const d = new Date(ev.start_time);
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    },

    getViewRange() {
      const d = this.currentDate;
      if (this.viewMode === 'week') {
        const start = this.getWeekStart(d);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        return { start: start.getTime(), end: end.getTime() };
      }
      if (this.viewMode === 'month') {
        // Include padding days
        const year = d.getFullYear();
        const month = d.getMonth();
        const firstDay = new Date(year, month, 1);
        const startOffset = firstDay.getDay();
        const start = new Date(year, month, 1 - startOffset);
        const end = new Date(year, month + 1, 14); // buffer
        return { start: start.getTime(), end: end.getTime() };
      }
      // Year
      const start = new Date(d.getFullYear(), 0, 1);
      const end = new Date(d.getFullYear() + 1, 0, 1);
      return { start: start.getTime(), end: end.getTime() };
    },

    async loadEvents() {
      try {
        const range = this.getViewRange();
        this.events = await getCalendarEvents(range.start, range.end);
      } catch (e) {
        console.error('Failed to load calendar events:', e);
      }
    },

    getEventsForDay(dateObj) {
      const dayStart = dateObj.getTime();
      const dayEnd = dayStart + 86400000;
      return this.events.filter(ev => ev.start_time < dayEnd && ev.end_time > dayStart);
    },

    getEventStyle(ev, dayDateObj) {
      const dayStart = dayDateObj.getTime();
      const evStart = Math.max(ev.start_time, dayStart);
      const evEnd = Math.min(ev.end_time, dayStart + 86400000);
      const startMinutes = (evStart - dayStart) / 60000;
      const durationMinutes = (evEnd - evStart) / 60000;
      const top = (startMinutes / 60) * 60; // 60px per hour
      const height = Math.max((durationMinutes / 60) * 60, 20);
      return {
        top: `${top}px`,
        height: `${height}px`,
        background: ev.color || 'var(--color-primary)',
        opacity: 0.9
      };
    },

    navigate(dir) {
      const d = new Date(this.currentDate);
      if (this.viewMode === 'week') {
        d.setDate(d.getDate() + dir * 7);
      } else if (this.viewMode === 'month') {
        d.setMonth(d.getMonth() + dir);
      } else {
        d.setFullYear(d.getFullYear() + dir);
      }
      this.currentDate = d;
    },

    goToday() {
      this.currentDate = new Date();
      this.$nextTick(() => this.scrollToCurrentTime());
    },

    jumpToMonth(monthIndex) {
      this.currentDate = new Date(this.currentDate.getFullYear(), monthIndex, 1);
      this.viewMode = 'month';
    },

    scrollToCurrentTime() {
      if (this.viewMode === 'week' && this.$refs.weekBody) {
        const now = new Date();
        const scrollTop = (now.getHours() - 1) * 60;
        this.$refs.weekBody.scrollTop = Math.max(0, scrollTop);
      }
    },

    handleDayColumnClick(event, day) {
      const rect = event.currentTarget.getBoundingClientRect();
      const y = event.clientY - rect.top + (this.$refs.weekBody?.scrollTop || 0);
      const hour = Math.floor(y / 60);
      const clampedHour = Math.max(0, Math.min(23, hour));

      const startDate = new Date(day.dateObj);
      startDate.setHours(clampedHour, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setHours(clampedHour + 1);

      this.eventForm = {
        ...this.emptyForm(),
        startDate: this.toDateString(startDate),
        startTime: this.toTimeString(startDate),
        endDate: this.toDateString(endDate),
        endTime: this.toTimeString(endDate)
      };
      this.editingEvent = null;
      this.showEventModal = true;
      this.$nextTick(() => this.$refs.titleInput?.focus());
    },

    handleMonthCellClick(day) {
      const startDate = new Date(day.dateObj);
      const now = new Date();
      startDate.setHours(now.getHours() + 1, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);

      this.eventForm = {
        ...this.emptyForm(),
        startDate: this.toDateString(startDate),
        startTime: this.toTimeString(startDate),
        endDate: this.toDateString(endDate),
        endTime: this.toTimeString(endDate)
      };
      this.editingEvent = null;
      this.showEventModal = true;
      this.$nextTick(() => this.$refs.titleInput?.focus());
    },

    editEvent(ev) {
      const start = new Date(ev.start_time);
      const end = new Date(ev.end_time);
      this.eventForm = {
        title: ev.title,
        description: ev.description || '',
        startDate: this.toDateString(start),
        startTime: this.toTimeString(start),
        endDate: this.toDateString(end),
        endTime: this.toTimeString(end),
        allDay: ev.all_day === 1,
        color: ev.color || '#5865f2'
      };
      this.editingEvent = ev;
      this.showEventModal = true;
      this.$nextTick(() => this.$refs.titleInput?.focus());
    },

    closeModal() {
      this.showEventModal = false;
      this.editingEvent = null;
      this.eventForm = this.emptyForm();
    },

    buildTimestamps() {
      const f = this.eventForm;
      let startTime, endTime;
      if (f.allDay) {
        startTime = new Date(`${f.startDate}T00:00:00`).getTime();
        endTime = new Date(`${f.endDate}T23:59:59`).getTime() + 1000;
      } else {
        startTime = new Date(`${f.startDate}T${f.startTime}:00`).getTime();
        endTime = new Date(`${f.endDate}T${f.endTime}:00`).getTime();
      }
      return { startTime, endTime };
    },

    async saveEvent() {
      this.saving = true;
      try {
        const { startTime, endTime } = this.buildTimestamps();
        const payload = {
          title: this.eventForm.title,
          description: this.eventForm.description || null,
          startTime,
          endTime,
          allDay: this.eventForm.allDay,
          color: this.eventForm.color
        };

        if (this.editingEvent) {
          await updateCalendarEvent(this.editingEvent.id, payload);
        } else {
          await createCalendarEvent(payload);
        }

        this.closeModal();
        await this.loadEvents();
      } catch (e) {
        console.error('Failed to save event:', e);
      } finally {
        this.saving = false;
      }
    },

    async deleteEvent() {
      if (!this.editingEvent) return;
      this.saving = true;
      try {
        await deleteCalendarEvent(this.editingEvent.id);
        this.closeModal();
        await this.loadEvents();
      } catch (e) {
        console.error('Failed to delete event:', e);
      } finally {
        this.saving = false;
      }
    }
  }
};
</script>

<style scoped>
.calendar-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  color: var(--color-text);
  overflow: hidden;
}

/* Header */
.calendar-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.calendar-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-btn {
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 13px;
}

.nav-btn:hover {
  background: var(--color-bg-hover);
}

.today-btn {
  padding: 6px 12px;
  font-weight: 500;
}

.calendar-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
}

.view-tabs {
  display: flex;
  gap: 2px;
  margin-left: auto;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 2px;
}

.view-tab {
  padding: 5px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.view-tab.active {
  background: var(--color-bg);
  color: var(--color-text);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.view-tab:hover:not(.active) {
  color: var(--color-text);
}

/* Week View */
.week-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.week-header {
  display: grid;
  grid-template-columns: 60px repeat(7, 1fr);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.time-gutter-header {
  border-right: 1px solid var(--color-border);
}

.week-day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  gap: 2px;
  border-right: 1px solid var(--color-border);
}

.week-day-header:last-child {
  border-right: none;
}

.day-name {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.day-number {
  font-size: 22px;
  font-weight: 300;
  line-height: 1.2;
}

.today-badge {
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 500;
}

.week-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.week-grid {
  display: grid;
  grid-template-columns: 60px repeat(7, 1fr);
  position: relative;
}

.time-gutter {
  border-right: 1px solid var(--color-border);
}

.time-slot-label {
  height: 60px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 0 8px;
  font-size: 11px;
  color: var(--color-text-secondary);
  transform: translateY(-7px);
}

.day-column {
  position: relative;
  border-right: 1px solid var(--color-border);
  cursor: pointer;
}

.day-column:last-child {
  border-right: none;
}

.day-column.today {
  background: color-mix(in srgb, var(--color-primary) 4%, transparent);
}

.time-slot {
  height: 60px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
}

.event-block {
  position: absolute;
  left: 2px;
  right: 2px;
  border-radius: 4px;
  padding: 2px 6px;
  color: white;
  font-size: 11px;
  overflow: hidden;
  cursor: pointer;
  z-index: 1;
  line-height: 1.3;
}

.event-block:hover {
  opacity: 1 !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.event-time {
  font-weight: 500;
  display: block;
}

.event-title {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Month View */
.month-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.month-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.month-day-name {
  padding: 8px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, 1fr);
  flex: 1;
  min-height: 0;
}

.month-cell {
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  padding: 4px;
  min-height: 0;
  overflow: hidden;
  cursor: pointer;
}

.month-cell:nth-child(7n) {
  border-right: none;
}

.month-cell:hover {
  background: var(--color-bg-hover);
}

.month-cell.other-month {
  opacity: 0.4;
}

.month-cell.today {
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
}

.cell-date {
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.cell-date.today-badge {
  background: var(--color-primary);
  color: white;
}

.cell-events {
  margin-top: 2px;
}

.month-event {
  font-size: 11px;
  padding: 1px 4px;
  margin-bottom: 1px;
  border-radius: 2px;
  border-left: 3px solid;
  background: var(--color-bg-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.month-event:hover {
  background: var(--color-bg-hover);
}

.more-events {
  font-size: 10px;
  color: var(--color-text-secondary);
  padding: 0 4px;
}

/* Year View */
.year-view {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 16px;
  overflow-y: auto;
}

.year-month {
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.15s;
}

.year-month:hover {
  background: var(--color-bg-secondary);
}

.year-month-title {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 6px;
}

.mini-month-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 10px;
  color: var(--color-text-secondary);
  margin-bottom: 2px;
}

.mini-month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
}

.mini-day {
  font-size: 11px;
  padding: 2px 0;
  border-radius: 50%;
  line-height: 1.6;
}

.mini-day.other-month {
  opacity: 0.3;
}

.mini-day.today {
  background: var(--color-primary);
  color: white;
  font-weight: 600;
}

.mini-day.has-events {
  font-weight: 700;
  color: var(--color-primary);
}

.mini-day.today.has-events {
  color: white;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.event-modal {
  background: var(--color-bg);
  border-radius: 12px;
  padding: 24px;
  width: 420px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.event-modal h3 {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--color-text-secondary);
}

.form-group input[type="text"],
.form-group input[type="date"],
.form-group input[type="time"],
.form-group textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-secondary);
  color: var(--color-text);
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-row .form-group input[type="time"] {
  margin-top: 4px;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text);
}

.checkbox-group input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.color-picker {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}

.color-swatch:hover {
  transform: scale(1.15);
}

.color-swatch.active {
  border-color: var(--color-text);
  box-shadow: 0 0 0 2px var(--color-bg);
}

.modal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}

.modal-actions-right {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-bg-hover);
}

.btn-danger {
  background: var(--color-danger);
  color: white;
}

.btn-danger:hover {
  opacity: 0.9;
}
</style>
