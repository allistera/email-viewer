<template>
  <div class="virtual-scroller" @scroll.passive="handleScroll" ref="scroller">
    <!-- Spacer to force scroll height equal to total items height -->
    <div class="virtual-spacer" :style="{ height: totalHeight + 'px' }"></div>

    <!-- Footer rendered after spacer in normal flow (e.g. Load More button) -->
    <div class="virtual-footer">
      <slot name="footer"></slot>
    </div>

    <!-- Visible items rendered absolutely over the spacer -->
    <div class="virtual-content" :style="{ transform: `translateY(${offsetY}px)` }">
      <div
        v-for="(item, index) in visibleItems"
        :key="item.id || startIndex + index"
        class="virtual-item"
        :style="{ height: itemHeight + 'px' }"
      >
        <slot :item="item" :index="startIndex + index"></slot>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'VirtualList',
  props: {
    items: {
      type: Array,
      required: true
    },
    itemHeight: {
      type: Number,
      required: true
    },
    buffer: {
      type: Number,
      default: 5
    }
  },
  data() {
    return {
      scrollTop: 0,
      viewportHeight: 800, // Default to a reasonable height to avoid initial flash
      ticking: false
    };
  },
  computed: {
    totalHeight() {
      return this.items.length * this.itemHeight;
    },
    visibleCount() {
      if (!this.viewportHeight) return 0;
      return Math.ceil(this.viewportHeight / this.itemHeight) + 2 * this.buffer;
    },
    startIndex() {
      const start = Math.floor(this.scrollTop / this.itemHeight) - this.buffer;
      return Math.max(0, start);
    },
    endIndex() {
      const end = this.startIndex + this.visibleCount;
      return Math.min(this.items.length, end);
    },
    visibleItems() {
      return this.items.slice(this.startIndex, this.endIndex);
    },
    offsetY() {
      return this.startIndex * this.itemHeight;
    }
  },
  mounted() {
    this.updateViewport();
    window.addEventListener('resize', this.updateViewport);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.updateViewport);
  },
  methods: {
    handleScroll() {
      if (!this.ticking) {
        window.requestAnimationFrame(() => {
          if (this.$refs.scroller) {
            this.scrollTop = this.$refs.scroller.scrollTop;
          }
          this.ticking = false;
        });
        this.ticking = true;
      }
    },
    updateViewport() {
      if (this.$refs.scroller) {
        this.viewportHeight = this.$refs.scroller.clientHeight;
        // Also update scrollTop in case it changed
        this.scrollTop = this.$refs.scroller.scrollTop;
      }
    },
    scrollToIndex(index) {
      if (index >= 0 && index < this.items.length) {
        const top = index * this.itemHeight;
        this.$refs.scroller.scrollTo({ top, behavior: 'smooth' });
      }
    }
  }
};
</script>

<style scoped>
.virtual-scroller {
  overflow-y: auto;
  height: 100%;
  position: relative;
  contain: strict;
  will-change: scroll-position;
}

.virtual-spacer {
  width: 1px; /* Minimal width */
  float: left; /* Float to avoid collapsing margins? No, regular block is fine */
}

.virtual-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  /* Ensure it doesn't block clicks to footer if empty? No, height matches visible items */
}

.virtual-footer {
  clear: both; /* In case spacer is floated */
  width: 100%;
}
</style>
