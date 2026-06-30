<template>
  <div class="fence-manager" v-if="visible">
    <div class="fence-header">
      <span class="title">🛡️ 电子围栏管理</span>
      <button class="close-btn" @click="close">✕</button>
    </div>

    <div class="fence-tools">
      <button
        type="button"
        class="tool-btn"
        :class="{ active: drawMode === FenceType.RECTANGLE }"
        @click="startDrawRectangle"
      >
        📐 矩形围栏
      </button>
      <button
        type="button"
        class="tool-btn"
        :class="{ active: drawMode === FenceType.CIRCLE }"
        @click="startDrawCircle"
      >
        ⭕ 圆形围栏
      </button>
      <button class="tool-btn" @click="clearAllFences">🗑️ 清空全部</button>
    </div>

    <div class="fence-list" v-if="fences.length > 0">
      <div class="list-header">已绘制的围栏</div>
      <div v-for="fence in fences" :key="fence.id" class="fence-item">
        <div class="fence-info">
          <span class="fence-name">{{ fence.name }}</span>
          <span class="fence-type">{{ fence.type === 'rectangle' ? '矩形' : '圆形' }}</span>
        </div>
        <button class="delete-btn" @click="deleteFence(fence.id)">删除</button>
      </div>
    </div>

    <div class="alert-list" v-if="alerts.length > 0">
      <div class="list-header">⚠️ 越界告警</div>
      <div v-for="alert in alerts" :key="alert.id" class="alert-item">
        <span class="alert-vehicle">{{ alert.vehicleId }}</span>
        <span class="alert-fence">越界 {{ alert.fenceName }}</span>
        <span class="alert-time">{{ formatTime(alert.timestamp) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onUnmounted } from 'vue';
  import { type IGeoFence, type IBoundaryAlert, FenceType } from '@/types/vehicle';
  import { calculateDistance } from '@/utils/geoFence';

  const props = defineProps<{
    visible: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'draw-start', type: FenceType): void;
    (e: 'draw-end', fence: Omit<IGeoFence, 'id' | 'createdAt'>): void;
    (e: 'add-fence', fence: Omit<IGeoFence, 'id' | 'createdAt'>): void;
    (e: 'clear-fences'): void;
    (e: 'delete-fence', fenceId: string): void;
  }>();

  const fences = ref<IGeoFence[]>([]);
  const alerts = ref<IBoundaryAlert[]>([]);
  let alertId = 0;
  const drawMode = ref<FenceType | null>(null);

  const startDraw = (type: FenceType) => emit('draw-start', type);

  let alertIdCounter = 0;

  /**
   * 格式化时间
   */
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };

  /**
   * 开始绘制矩形
   */
  const startDrawRectangle = (): void => {
    drawMode.value = FenceType.RECTANGLE;
    console.log('startDrawRectangle: drawMode', drawMode.value);
    emit('draw-start', FenceType.RECTANGLE);
  };

  /**
   * 开始绘制圆形
   */
  const startDrawCircle = (): void => {
    drawMode.value = FenceType.CIRCLE;
    emit('draw-start', FenceType.CIRCLE);
  };

  /**
   * 添加围栏
   */
  const addFence = (fence: IGeoFence): void => {
    fences.value.push(fence);
  };

  /**
   * 删除围栏
   */
  const deleteFence = (fenceId: string): void => {
    fences.value = fences.value.filter((f) => f.id !== fenceId);
    emit('delete-fence', fenceId);
  };

  /**
   * 清空所有围栏
   */
  const clearAllFences = (): void => {
    fences.value = [];
    alerts.value = [];
    emit('clear-fences');
  };

  /**
   * 重置DrawMode
   */
  const resetDrawMode = () => {
    drawMode.value = null;
  };

  /**
   * 添加越界告警
   */
  const addAlert = (
    vehicleId: string,
    fence: IGeoFence,
    position: { lng: number; lat: number }
  ): void => {
    const alert: IBoundaryAlert = {
      id: `alert_${Date.now()}_${alertIdCounter++}`,
      vehicleId,
      fenceId: fence.id,
      fenceName: fence.name,
      timestamp: Date.now(),
      position
    };
    alerts.value.unshift(alert);
    // 只保留最近20条告警
    if (alerts.value.length > 20) {
      alerts.value.pop();
    }
  };

  /**
   * 关闭面板
   */
  const close = () => emit('close');

  // 暴露方法给父组件
  defineExpose({
    addFence,
    addAlert,
    fences,
    alerts,
    resetDrawMode
  });

  onUnmounted(() => {
    close();
  });
</script>

<style scoped>
  .fence-manager {
    position: absolute;
    top: 20px;
    left: 20px;
    width: 280px;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 16px;
    color: white;
    z-index: 20;
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 13px;
    max-height: 80vh;
    overflow-y: auto;
  }

  .fence-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .title {
    font-weight: bold;
    font-size: 14px;
  }

  .close-btn {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 18px;
  }

  .close-btn:hover {
    color: #ef4444;
  }

  .fence-tools {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .tool-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .tool-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .tool-btn.active {
    background: #10b981;
    color: white;
  }

  .fence-list,
  .alert-list {
    margin-top: 16px;
  }

  .list-header {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .fence-item,
  .alert-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    margin-bottom: 6px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    font-size: 12px;
  }

  .fence-info {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .fence-name {
    font-weight: bold;
  }

  .fence-type {
    font-size: 10px;
    padding: 2px 6px;
    background: rgba(16, 185, 129, 0.3);
    border-radius: 4px;
  }

  .delete-btn {
    background: rgba(239, 68, 68, 0.3);
    border: none;
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
  }

  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.6);
  }

  .alert-item {
    background: rgba(239, 68, 68, 0.15);
    border-left: 2px solid #ef4444;
  }

  .alert-vehicle {
    font-weight: bold;
    color: #ef4444;
  }

  .alert-fence {
    color: rgba(255, 255, 255, 0.7);
  }

  .alert-time {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
  }
</style>
