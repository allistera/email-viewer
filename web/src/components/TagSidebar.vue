<template>
  <aside class="tag-sidebar">
    <div class="tag-header">
      <h2>Tags</h2>
    </div>
    <ul class="tag-list">
      <li v-for="tag in tags" :key="tag" class="tag-item">
        <span class="tag-dot"></span>
        <span class="tag-label">{{ tag }}</span>
      </li>
    </ul>
  </aside>
</template>

<script>
export default {
  name: 'TagSidebar',
  data() {
    return {
      tags: ['Spam', 'Marketing', 'Recruitment', 'Personal', 'Finance', 'Support', 'Other']
    };
  }
};
</script>

<style scoped>
.tag-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg);
  border-right: 1px solid var(--color-border);
}

.tag-header {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.tag-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--color-text);
}

.tag-list {
  list-style: none;
  margin: 0;
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  font-size: 14px;
  color: var(--color-text);
  cursor: pointer;
}

.tag-item:hover {
  background: var(--color-bg-secondary);
}

.tag-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
}

.tag-label {
  text-transform: capitalize;
}
</style>
