<template>
  <div class="trajectory-player" v-if="visible">
    <div class="player-header">
      <span class="title">🎬 轨迹回放</span>
      <button class="close-btn" @click="close">✕</button>
    </div>

    <div class="player-content">
      <div class="vehicle-info">
        <span class="label">当前车辆：</span>
        <span class="value">{{ selectedVehicle?.id || '未选择' }}</span>
      </div>

      <div class="time-range" v-if="trajectoryPoints.length > 0">
        <span class="label">时间范围：</span>
        <span class="value">{{ formatTime(startTime) }} ~ {{ formatTime(endTime) }}</span>
      </div>

      <!-- 进度条 -->
      <div class="slider-container">
        <input
          type="range"
          v-model.number="currentIndex"
          :min="0"
          :max="maxIndex"
          class="timeline-slider"
          @input="onSliderChange"
        />
      </div>

      <!-- 控制按钮 -->
      <div class="controls">
        <button class="control-btn" @click="play" :disabled="isPlaying"> ▶ 播放 </button>
        <button class="control-btn" @click="pause" :disabled="!isPlaying"> ⏸ 暂停 </button>
        <button class="control-btn" @click="reset"> 🔄 重置 </button>
        <select v-model="playSpeed" class="speed-select">
          <option :value="0.5">0.5x</option>
          <option :value="1">1x</option>
          <option :value="2">2x</option>
          <option :value="4">4x</option>
        </select>
      </div>

      <div class="progress-info">
        <span>{{ currentIndex + 1 }} / {{ trajectoryPoints.length }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onUnmounted } from 'vue';
  import type { ITrajectoryPoint, IVehicle } from '../types/vehicle';

  const props = defineProps<{
    visible: boolean;
    selectedVehicle: IVehicle | null;
    trajectoryPoints: ITrajectoryPoint[];
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'play-point', point: ITrajectoryPoint): void;
  }>();

  const currentIndex = ref(0);
  const isPlaying = ref(false);
  const playSpeed = ref(1);
  let playInterval: number | null = null;

  const maxIndex = computed(() => Math.max(0, props.trajectoryPoints.length - 1));
  const startTime = computed(() => props.trajectoryPoints[0]?.timestamp || 0);
  const endTime = computed(
    () => props.trajectoryPoints[props.trajectoryPoints.length - 1]?.timestamp || 0
  );

  /**
   * 格式化时间
   */
  const formatTime = (timestamp: number): string => {
    if (!timestamp) return '--:--:--';
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };

  /**
   * 播放
   */
  const play = (): void => {
    if (isPlaying.value) return;
    if (currentIndex.value >= maxIndex.value) {
      reset();
    }

    isPlaying.value = true;
    playInterval = window.setInterval(() => {
      if (currentIndex.value < maxIndex.value) {
        currentIndex.value++;
        const point = props.trajectoryPoints[currentIndex.value];
        if (point) {
          emit('play-point', point);
        }
      } else {
        pause();
      }
    }, 1000 / playSpeed.value);
  };

  /**
   * 暂停
   */
  const pause = (): void => {
    isPlaying.value = false;
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
    }
  };

  /**
   * 重置
   */
  const reset = (): void => {
    pause();
    currentIndex.value = 0;
    if (props.trajectoryPoints[0]) {
      emit('play-point', props.trajectoryPoints[0]);
    }
  };

  /**
   * 滑块变化
   */
  const onSliderChange = (): void => {
    const point = props.trajectoryPoints[currentIndex.value];
    if (point) {
      emit('play-point', point);
    }
  };

  /**
   * 关闭面板
   */
  const close = (): void => {
    pause();
    emit('close');
  };

  // 监听播放速度变化
  watch(playSpeed, () => {
    if (isPlaying.value) {
      pause();
      play();
    }
  });

  // 监听轨迹点变化，重置索引
  watch(
    () => props.trajectoryPoints,
    (newPoints) => {
      if (newPoints.length > 0) {
        currentIndex.value = newPoints.length - 1;
      }
    },
    { deep: true }
  );

  onUnmounted(() => {
    if (playInterval) {
      clearInterval(playInterval);
    }
  });
</script>

<style scoped>
  .trajectory-player {
    position: absolute;
    bottom: 20px;
    left: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 16px;
    color: white;
    z-index: 20;
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 14px;
  }

  .player-header {
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
    padding: 0 4px;
  }

  .close-btn:hover {
    color: #ef4444;
  }

  .player-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .vehicle-info,
  .time-range {
    display: flex;
    gap: 8px;
    font-size: 12px;
  }

  .label {
    color: rgba(255, 255, 255, 0.6);
  }

  .value {
    color: #10b981;
    font-weight: bold;
  }

  .slider-container {
    width: 100%;
  }

  .timeline-slider {
    width: 100%;
    height: 4px;
    -webkit-appearance: none;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .timeline-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    background: #10b981;
    border-radius: 50%;
    cursor: pointer;
  }

  .controls {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }

  .control-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    padding: 6px 16px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
    font-size: 12px;
  }

  .control-btn:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.5);
  }

  .control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .speed-select {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }

  .speed-select option {
    color: rgba(0, 0, 0, 0.9);
  }

  .progress-info {
    text-align: center;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
  }
</style>
