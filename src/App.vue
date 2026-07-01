<template>
  <div class="app">
    <MapView ref="mapViewRef" @reset="resetDrawMode" />
    <InfoPanel
      :vehicles="vehicles"
      @select-vehicle="onSelectVehicle"
      @replay-vehicle="onReplayVehicle"
    />
    <TrajectoryPlayer
      :visible="playerVisible"
      :selected-vehicle="selectedVehicle"
      :trajectory-points="trajectoryPoints"
      @close="closePlayer"
      @play-point="onPlayPoint"
    />
    <FenceManager
      ref="fenceManagerRef"
      :visible="fenceVisible"
      :vehicles="vehicles"
      @close="closeFence"
      @draw-start="onDrawStart"
      @add-fence="onAddFence"
      @bind-fence="onBindFence"
      @clear-fences="onClearFences"
      @delete-fence="onDeleteFence"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import MapView from './components/MapView.vue';
  import InfoPanel from './components/InfoPanel.vue';
  import TrajectoryPlayer from './components/TrajectoryPlayer.vue';
  import FenceManager from './components/FenceManager.vue';
  import { mockWS } from './services/mockWebSocket';
  import { type IVehicle, type ITrajectoryPoint, type IGeoFence, FenceType } from './types/vehicle';
  import { checkBoundary } from '@/utils/geoFence';

  const mapViewRef = ref<InstanceType<typeof MapView> | null>(null);
  const fenceManagerRef = ref<InstanceType<typeof FenceManager> | null>(null);
  const vehicles = ref<IVehicle[]>([]);
  const playerVisible = ref(false);
  const selectedVehicle = ref<IVehicle | null>(null);
  const trajectoryPoints = ref<ITrajectoryPoint[]>([]);
  let BMap: any = null;

  // 电子围栏状态
  const fenceVisible = ref(true);
  let drawMode: FenceType | null = null;
  let fences: IGeoFence[] = [];

  /**
   * 选中车辆时，地图定位到车辆位置
   */
  const onSelectVehicle = (vehicle: IVehicle): void => {
    if (mapViewRef.value && mapViewRef.value.flyToVehicle) {
      mapViewRef.value.flyToVehicle(vehicle);
    }
  };

  const onReplayVehicle = (v: IVehicle) => {
    console.log('onReplayVehicle', v);
    const traj = mockWS.getVehicleTrajectory(v.id);
    console.log('获取到轨迹点', traj);
    if (traj?.length) {
      selectedVehicle.value = v;
      trajectoryPoints.value = traj;
      playerVisible.value = true;
      mapViewRef.value?.playTrajectory(traj);
    }
  };

  const closePlayer = () => {
    playerVisible.value = false;
    selectedVehicle.value = null;
    trajectoryPoints.value = [];
    mapViewRef.value?.playTrajectory([]);
  };

  const onPlayPoint = (point: ITrajectoryPoint) => {
    mapViewRef.value?.playTrajectory(point);
  };

  /**
   * 电子围栏相关方法
   */
  const toggleFence = (): void => {
    fenceVisible.value = !fenceVisible.value;
  };

  const closeFence = (): void => {
    fenceVisible.value = false;
    drawMode = null;
  };

  const onDrawStart = (type: FenceType): void => {
    // drawMode = type;
    // // 这里需要实现地图上的绘制交互
    // // 简化版：直接创建演示围栏
    // createDemoFence();
    if (mapViewRef.value?.startDraw) {
      try {
        mapViewRef.value.startDraw(type, (fenceData) => {
          const newFence: IGeoFence = {
            ...fenceData,
            id: `fence_${Date.now()}`,
            createdAt: Date.now()
          } as IGeoFence;
          fences.push(newFence);
          fenceManagerRef.value?.addFence(newFence);
          mapViewRef.value?.addFenceOverlay(newFence);
        });
      } catch (e) {
        console.error('调用 mapViewRef.startDraw 时发生错误', e);
      }
    }
  };

  // const createDemoFence = (): void => {
  //   const newFence: IGeoFence = {
  //     id: `fence_${Date.now()}`,
  //     name: `围栏_${fences.length + 1}`,
  //     type: FenceType.RECTANGLE,
  //     center: { lng: 121.455, lat: 31.23 },
  //     bounds: {
  //       southWest: { lng: 121.45, lat: 31.225 },
  //       northEast: { lng: 121.46, lat: 31.235 }
  //     },
  //     createdAt: Date.now()
  //   };
  //   fences.push(newFence);
  //   console.log('新建围栏:', fences);
  //   fenceManagerRef.value?.addFence(newFence);
  //   mapViewRef.value?.addFenceOverlay(newFence);
  //   drawMode = null;
  // };

  const onAddFence = (fence: Omit<IGeoFence, 'id' | 'createdAt'>): void => {
    console.log('end draw fence:', fence);
    const newFence: IGeoFence = {
      ...fence,
      id: `fence_${Date.now()}`,
      createdAt: Date.now(),
      boundVehicleIds: []
    } as IGeoFence;
    fences.push(newFence);
    mapViewRef.value?.addFenceOverlay(newFence);
  };

  const onClearFences = (): void => {
    fences = [];
    mapViewRef.value?.clearFences();
  };

  const onDeleteFence = (fenceId: string): void => {
    fences = fences.filter((f) => f.id !== fenceId);
    mapViewRef.value?.removeFenceOverlay(fenceId);
  };

  const onBindFence = (payload: { fenceId: string; boundVehicleIds: string[] }): void => {
    const fence = fences.find((f) => f.id === payload.fenceId);
    if (fence) {
      fence.boundVehicleIds = payload.boundVehicleIds;
    }
  };

  const checkBoundaries = () => {
    fences.forEach((f) => {
      const targetVehicles = f.boundVehicleIds?.length
        ? vehicles.value.filter((v) => f.boundVehicleIds?.includes(v.id))
        : vehicles.value;
      targetVehicles.forEach((v) => {
        if (checkBoundary({ lng: v.lng, lat: v.lat }, f))
          fenceManagerRef.value?.addAlert(v.id, f, { lng: v.lng, lat: v.lat });
      });
    });
  };

  const resetDrawMode = (): void => {
    fenceManagerRef.value?.resetDrawMode();
  };

  onMounted(() => {
    // 监听车辆数据更新
    mockWS.on('message', (msg) => {
      if (msg.type === 'vehicles_update') {
        vehicles.value = msg.data;
        // 检查围栏越界（每秒检查一次）
        checkBoundaries();
      }
    });
  });
</script>

<style lang="scss" scoped>
  .app {
    width: 100%;
    height: 100%;
    position: relative;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }
</style>
