<template>
  <div id="app">
    <router-view />
    <ToastNotification ref="toast" />
  </div>
</template>

<script>
import ToastNotification from './components/ToastNotification.vue';
import { init as initTheme } from './services/theme.js';

export default {
  name: 'App',
  components: {
    ToastNotification
  },
  mounted() {
    initTheme();
  }
};
</script>

<style scoped>
#app {
  height: 100vh;
  overflow: hidden;
}
</style>
