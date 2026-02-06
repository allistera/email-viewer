<template>
  <div class="calendar-view">
    <header class="calendar-header">
      <button type="button" class="nav-btn" aria-label="Previous month" @click="prevMonth">&larr;</button>
      <h2 class="calendar-title">{{ monthYear }}</h2>
      <button type="button" class="nav-btn" aria-label="Next month" @click="nextMonth">&rarr;</button>
    </header>
    <div class="calendar-body">
      <div class="weekday-headers">
        <span v-for="d in weekdays" :key="d" class="weekday">{{ d }}</span>
      </div>
      <div class="days-grid">
        <div
          v-for="(day, i) in days"
          :key="i"
          class="day-cell"
          :class="{
            'other-month': !day.isCurrentMonth,
            'today': day.isToday,
            'empty': day.isEmpty
          }"
        >
          <span v-if="!day.isEmpty" class="day-num">{{ day.date }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CalendarView',
  data() {
    return {
      current: new Date(),
      weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    };
  },
  computed: {
    monthYear() {
      return this.current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    },
    days() {
      const year = this.current.getFullYear();
      const month = this.current.getMonth();
      const first = new Date(year, month, 1);
      const last = new Date(year, month + 1, 0);
      const startPad = first.getDay();
      const daysInMonth = last.getDate();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = [];

      for (let i = 0; i < startPad; i++) {
        const d = new Date(year, month, -startPad + i + 1);
        result.push({
          date: d.getDate(),
          isCurrentMonth: false,
          isToday: false,
          isEmpty: false
        });
      }

      for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        d.setHours(0, 0, 0, 0);
        result.push({
          date: i,
          isCurrentMonth: true,
          isToday: d.getTime() === today.getTime(),
          isEmpty: false
        });
      }

      const remaining = 42 - result.length;
      for (let i = 0; i < remaining; i++) {
        const d = new Date(year, month + 1, i + 1);
        result.push({
          date: d.getDate(),
          isCurrentMonth: false,
          isToday: false,
          isEmpty: false
        });
      }

      return result;
    }
  },
  methods: {
    prevMonth() {
      this.current = new Date(this.current.getFullYear(), this.current.getMonth() - 1);
    },
    nextMonth() {
      this.current = new Date(this.current.getFullYear(), this.current.getMonth() + 1);
    }
  }
};
</script>

<style scoped>
.calendar-view {
  grid-column: 3 / 4;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--color-bg);
}

.calendar-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
}

.calendar-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.nav-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 18px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.nav-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-primary);
}

.calendar-body {
  flex: 1;
  padding: 24px;
  overflow: auto;
}

.weekday-headers {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 12px;
}

.weekday {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: center;
  padding: 8px 0;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.day-cell {
  aspect-ratio: 1;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--color-bg-secondary);
  transition: background 0.15s;
}

.day-cell:hover:not(.empty) {
  background: var(--color-bg-hover);
}

.day-cell.other-month .day-num {
  color: var(--color-text-secondary);
  opacity: 0.5;
}

.day-cell.today {
  background: var(--color-primary);
  color: white;
}

.day-cell.today .day-num {
  color: white;
  font-weight: 600;
}

.day-num {
  font-size: 14px;
  color: var(--color-text);
}
</style>
