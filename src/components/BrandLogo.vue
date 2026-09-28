<script setup lang="ts">
defineProps<{ compact?: boolean; light?: boolean }>()
</script>

<template>
  <div class="brand-logo" :class="{ 'brand-logo--compact': compact, 'brand-logo--light': light }">
    <span class="brand-logo__mark"><i></i><i></i><i></i></span>
    <span v-if="!compact" class="brand-logo__copy">
      <strong>Helpdesk Agent</strong>
      <small>管理控制台</small>
    </span>
  </div>
</template>

