<template>
  <div class="map-view">
    <baidu-map
      ref="mapRef"
      class="map"
      :center="center"
      :zoom="zoom"
      :scroll-wheel-zoom="true"
      @ready="handleMapReady"
    >
      <!-- 地图控件 -->
      <bm-navigation anchor="BMAP_ANCHOR_TOP_RIGHT"></bm-navigation>
      <bm-map-type
        :map-types="['BMAP_NORMAL_MAP', 'BMAP_SATELLITE_MAP']"
        anchor="BMAP_ANCHOR_TOP_LEFT"
      ></bm-map-type>
    </baidu-map>

    <!-- 热力图控制按钮 -->
    <button class="heatmap-toggle" @click="toggleHeatmap">
      {{ isHeatmapVisible ? '隐藏热力图' : '显示热力图' }}
    </button>
  </div>
</template>

<script setup lang="ts">
  import { ref, onUnmounted } from 'vue';
  import { mockWS } from '@/services/mockWebSocket';
  import { useHeatmap } from '../composables/useHeatmap';
  import type { IPoint, IBaiduMapInstance } from '@/types/map';
  import {
    type IVehicle,
    VehicleStatus,
    type IWebSocketMessage,
    type IGeoFence,
    type ITrajectoryPoint,
    FenceType
  } from '@/types/vehicle';

  const emits = defineEmits<{
    (e: 'resetDrawMode'): void;
  }>();

  // 百度地图初始化参数
  const center: IPoint = { lng: 121.4737, lat: 31.2304 };
  const zoom = ref<number>(14);
  const mapRef = ref<IBaiduMapInstance | null>(null);

  let map: any = null;
  let BMap: any = null;
  let drawingManager: any = null;
  const markers = new Map<string, any>(); // 存储车辆Marker
  const markerCache = new Map<string, string>(); // 缓存车辆图标标识
  const fenceOverlays = new Map<string, any>(); // 围栏覆盖物
  let currentDrawCallback: ((fence: Omit<IGeoFence, 'id' | 'createdAt'>) => void) | null = null;

  // heatmap
  const { isHeatmapVisible, initHeatmap, updateHeatmapData, toggleHeatmap } = useHeatmap();

  // 当前车辆数据（用于热力图更新）
  let currentVehicles: IVehicle[] = [];
  let animationFrameId: number | null = null;
  let pendingVehicles: IVehicle[] | null = null;
  let trajectoryLine: any = null;
  let trajectoryMarker: any = null;
  let trajectoryIcon: any = null;

  const clearTrajectory = (): void => {
    if (trajectoryLine && map) {
      map.removeOverlay(trajectoryLine);
      trajectoryLine = null;
    }
    if (trajectoryMarker && map) {
      map.removeOverlay(trajectoryMarker);
      trajectoryMarker = null;
    }
    trajectoryIcon = null;
  };

  const createTrajectoryIcon = (): any => {
    if (!BMap) return null;
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.fillStyle = '#3B82F6';
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    const url = canvas.toDataURL();
    return new BMap.Icon(url, new BMap.Size(size, size));
  };

  const moveTrajectoryMarker = (point: ITrajectoryPoint): void => {
    if (!map || !BMap) return;
    const position = new BMap.Point(point.lng, point.lat);
    if (!trajectoryMarker) {
      trajectoryIcon = createTrajectoryIcon();
      trajectoryMarker = new BMap.Marker(position, {
        icon: trajectoryIcon
      });
      map.addOverlay(trajectoryMarker);
    } else {
      trajectoryMarker.setPosition(position);
    }
    //map.panTo(position);
  };

  /**
   * 根据状态获取图标颜色
   */
  const getStatusColor = (status: VehicleStatus): string => {
    switch (status) {
      case 'sweeping':
        return '#10B981'; // 绿色-作业中
      case 'idle':
        return '#F59E0B'; // 橙色-闲置
      case 'fault':
        return '#EF4444'; // 红色-故障
      case 'charging':
        return '#3B82F6'; // 蓝色-充电
      default:
        return '#6B7280';
    }
  };

  /**
   * 获取状态中文文本
   */
  const getStatusText = (status: VehicleStatus): string => {
    const statusMap: Record<VehicleStatus, string> = {
      sweeping: '作业中',
      idle: '闲置',
      fault: '故障',
      charging: '充电中'
    };
    return statusMap[status];
  };

  /**
   * 创建车辆图标（带方向角）
   */
  const createVehicleIcon = (vehicle: IVehicle): any => {
    const color = getStatusColor(vehicle.status);
    const size = 32;

    // 创建 canvas 绘制图标
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      throw new Error('无法获取 Canvas 上下文');
    }

    ctx.clearRect(0, 0, size, size);

    // 绘制圆底
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, 2 * Math.PI);
    ctx.fill();

    // 白色边框
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, 2 * Math.PI);
    ctx.stroke();

    // 绘制方向箭头
    ctx.fillStyle = 'white';
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate((vehicle.heading * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-4, 4);
    ctx.lineTo(4, 4);
    ctx.fill();
    ctx.restore();

    // 中心点
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 3, 0, 2 * Math.PI);
    ctx.fill();

    // 转换为图片（避免直接使用 data: scheme，改用 Blob URL）
    let url: string;
    try {
      url = canvas.toDataURL();
    } catch (e) {
      console.warn('canvas.toDataURL 失败，回退到静态占位图', e);
      // 使用 public 下的 favicon 作为占位图（Vite 将其作为根路径静态资源）
      url = '/favicon.ico';
    }
    return new mapRef.value!.BMap.Icon(url, new mapRef.value!.BMap.Size(size, size));
  };

  /**
   * 更新所有车辆Marker
   */
  const updateVehicleMarkers = (vehicles: IVehicle[]): void => {
    if (!map) {
      console.warn('地图实例未准备好，无法更新车辆Marker');
      return;
    }

    vehicles.forEach((vehicle) => {
      const point = new BMap.Point(vehicle.lng, vehicle.lat);
      let marker = markers.get(vehicle.id);

      if (marker) {
        // 更新位置
        marker.setPosition(point);

        // 更新图标（如果方向或状态变化）
        const iconKey = `${vehicle.id}_${vehicle.heading}_${vehicle.status}`;
        if (markerCache.get(vehicle.id) !== iconKey) {
          const newIcon = createVehicleIcon(vehicle);
          marker.setIcon(newIcon);
          markerCache.set(vehicle.id, iconKey);
        }
      } else {
        // 创建新Marker
        const icon = createVehicleIcon(vehicle);
        marker = new BMap.Marker(point, { icon: icon });

        // 创建信息窗口
        const infoContent = `
        <div style="padding: 8px; min-width: 160px;">
          <div style="font-weight: bold; margin-bottom: 8px;">${vehicle.id}</div>
          <div>速度: ${vehicle.speedKmh.toFixed(1)} km/h</div>
          <div>电量: ${vehicle.battery.toFixed(0)}%</div>
          <div>状态: ${getStatusText(vehicle.status)}</div>
          ${vehicle.faultCode ? `<div style="color: #EF4444;">故障码: ${vehicle.faultCode}</div>` : ''}
        </div>
      `;
        const infoWindow = new BMap.InfoWindow(infoContent, {
          width: 200,
          height: 120
        });

        // 添加点击事件
        marker.addEventListener('click', () => {
          map.openInfoWindow(infoWindow, point);
        });

        map.addOverlay(marker);
        markers.set(vehicle.id, marker);
        markerCache.set(vehicle.id, `${vehicle.id}_${vehicle.heading}_${vehicle.status}`);
      }
    });

    // 移除不存在的车辆
    const existingIds = new Set(vehicles.map((v) => v.id));
    for (const [id, marker] of markers) {
      if (!existingIds.has(id)) {
        map.removeOverlay(marker);
        markers.delete(id);
        markerCache.delete(id);
      }
    }
  };

  // ---------- 围栏绘制管理 ----------
  /**
   * 确保 DrawingManager 扩展库已加载
   */
  const ensureDrawingManagerLib = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).BMapLib && (window as any).BMapLib.DrawingManager) {
        resolve();
        return;
      }
      const src = 'https://api.map.baidu.com/library/DrawingManager/1.4/src/DrawingManager_min.js';
      if (document.querySelector(`script[src="${src}"]`)) {
        const check = () => {
          if ((window as any).BMapLib && (window as any).BMapLib.DrawingManager) resolve();
          else setTimeout(check, 100);
        };
        check();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => {
        resolve();
      };
      s.onerror = (e) => {
        reject(e);
      };
      document.head.appendChild(s);
    });
  };

  const initDrawingManager = () => {
    if (!map || !BMap || !window.BMapLib) return;
    const BMapLib = window.BMapLib;
    drawingManager = new BMapLib.DrawingManager(map, {
      isOpen: false,
      enableDrawingTool: false,
      drawingToolOptions: { anchor: 'BMAP_ANCHOR_TOP_LEFT', offset: new BMap.Size(10, 60) },
      circleOptions: {
        strokeColor: '#10B981',
        fillColor: '#10B981',
        strokeWeight: 2,
        fillOpacity: 0.2
      },
      rectangleOptions: {
        strokeColor: '#10B981',
        fillColor: '#10B981',
        strokeWeight: 2,
        fillOpacity: 0.2
      }
    });
    if (!drawingManager) {
      console.error('绘制管理器未初始化');
    } else {
      console.log('绘制管理器初始化成功');
    }
    drawingManager.addEventListener('circlecomplete', (circle: any) => {
      const center = circle.getCenter();
      const radius = circle.getRadius();
      if (currentDrawCallback) {
        currentDrawCallback({
          name: `圆形围栏_${Date.now()}`,
          type: FenceType.CIRCLE,
          center: { lng: center.lng, lat: center.lat },
          radius
        });
        currentDrawCallback = null;
      }
      map.removeOverlay(circle);
      drawingManager.close();
      emits('resetDrawMode');
    });
    drawingManager.addEventListener('rectanglecomplete', (rectangle: any) => {
      console.log('rectanglecomplete');
      const bounds = rectangle.getBounds();
      const sw = bounds.getSouthWest(),
        ne = bounds.getNorthEast();
      if (currentDrawCallback) {
        currentDrawCallback({
          name: `矩形围栏_${Date.now()}`,
          type: FenceType.RECTANGLE,
          center: { lng: (sw.lng + ne.lng) / 2, lat: (sw.lat + ne.lat) / 2 },
          bounds: {
            southWest: { lng: sw.lng, lat: sw.lat },
            northEast: { lng: ne.lng, lat: ne.lat }
          }
        });
        currentDrawCallback = null;
      }
      map.removeOverlay(rectangle);
      drawingManager.close();
      emits('resetDrawMode');
    });
  };

  const startDraw = (
    type: 'rectangle' | 'circle',
    callback: (fence: Omit<IGeoFence, 'id' | 'createdAt'>) => void
  ) => {
    if (!drawingManager) {
      console.error('绘制管理器未初始化');
      return;
    }
    currentDrawCallback = callback;
    drawingManager.open();
    const lib = (window as any).BMapLib;
    const drawEnum = lib && lib.DrawingManager;
    if (!drawEnum) {
      console.error('BMapLib.DrawingManager 未就绪，无法设置绘制模式');
      return;
    }
    if (type === 'rectangle') {
      console.log('设置绘制模式为矩形');
      drawingManager.setDrawingMode(FenceType.RECTANGLE);
      console.log('绘制模式已设置为矩形');
    } else if (type === 'circle') {
      drawingManager.setDrawingMode(FenceType.CIRCLE);
    }
  };

  // 添加/移除/清除围栏覆盖物（用于展示已保存的围栏）
  const addFenceOverlay = (fence: IGeoFence) => {
    console.log('addFenceOverlay');
    if (!map) return;
    let overlay: any;
    if (fence.type === FenceType.RECTANGLE && fence.bounds) {
      const sw = fence.bounds.southWest,
        ne = fence.bounds.northEast;
      const points = [
        new BMap.Point(sw.lng, sw.lat),
        new BMap.Point(ne.lng, sw.lat),
        new BMap.Point(ne.lng, ne.lat),
        new BMap.Point(sw.lng, ne.lat)
      ];
      overlay = new BMap.Polygon(points, {
        strokeColor: '#10B981',
        fillColor: '#10B981',
        strokeWeight: 2,
        fillOpacity: 0.2
      });
    } else if (fence.type === FenceType.CIRCLE && fence.center && fence.radius) {
      overlay = new BMap.Circle(new BMap.Point(fence.center.lng, fence.center.lat), fence.radius, {
        strokeColor: '#10B981',
        fillColor: '#10B981',
        strokeWeight: 2,
        fillOpacity: 0.2
      });
    }

    if (overlay) {
      map.addOverlay(overlay);
      fenceOverlays.set(fence.id, overlay);
    }
  };

  /**
   * 绘制矩形围栏
   */
  const drawRectangle = (bounds: {
    southWest: { lng: number; lat: number };
    northEast: { lng: number; lat: number };
  }): void => {
    if (!map) return;

    const points = [
      new BMap.Point(bounds.southWest.lng, bounds.southWest.lat),
      new BMap.Point(bounds.northEast.lng, bounds.southWest.lat),
      new BMap.Point(bounds.northEast.lng, bounds.northEast.lat),
      new BMap.Point(bounds.southWest.lng, bounds.northEast.lat)
    ];

    const polygon = new BMap.Polygon(points, {
      strokeColor: '#10B981',
      fillColor: '#10B981',
      strokeWeight: 2,
      fillOpacity: 0.2
    });

    map.addOverlay(polygon);
    return polygon;
  };

  /**
   * 绘制圆形围栏
   */
  const drawCircle = (center: { lng: number; lat: number }, radius: number): void => {
    if (!map) return;

    const circle = new BMap.Circle(new BMap.Point(center.lng, center.lat), radius, {
      strokeColor: '#10B981',
      fillColor: '#10B981',
      strokeWeight: 2,
      fillOpacity: 0.2
    });

    map.addOverlay(circle);
    return circle;
  };

  const removeFenceOverlay = (fenceId: string) => {
    const overlay = fenceOverlays.get(fenceId);
    if (overlay && map) map.removeOverlay(overlay);
    fenceOverlays.delete(fenceId);
    console.log('remain fence', fenceOverlays);
  };

  const clearFences = () => {
    fenceOverlays.forEach((overlay, id) => {
      map?.removeOverlay(overlay);
    });
    fenceOverlays.clear();
  };

  // 地图加载完成回调
  const handleMapReady = ({ BMap: BMapInstance, map: mapInstance }: IBaiduMapInstance): void => {
    map = mapInstance;
    BMap = BMapInstance;
    // mapRef.value = { map: mapInstance, BMap: BMapInstance };
    setTimeout(async () => {
      initHeatmap(map, BMap);
      console.log('initHeatmap complete');
      try {
        await ensureDrawingManagerLib();
      } catch (e) {
        console.error('确保 DrawingManager 加载失败', e);
      }
      initDrawingManager();
    }, 500);
    console.log('地图加载完成');

    // 启动 WebSocket 模拟
    mockWS.start();

    // 测试监听事件
    mockWS.on('test', (msg: { type: string }) => {
      console.log('收到消息222:', msg);
    });

    // 监听车辆数据更新
    mockWS.on('message', (msg: IWebSocketMessage) => {
      if (msg.type === 'vehicles_update') {
        currentVehicles = msg.data;
        updateVehicleMarkers(currentVehicles);
        updateHeatmapData(currentVehicles); // 更新热力图
      }
    });
  };

  /**
   * 暴露地图实例供父组件调用
   */
  const flyToVehicle = (vehicle: IVehicle): void => {
    if (map) {
      const point = new BMap.Point(vehicle.lng, vehicle.lat);
      map.panTo(point);
      map.setZoom(16);
    }
  };

  /**
   * 播放轨迹点
   */
  const playTrajectory = (points: ITrajectoryPoint[] | ITrajectoryPoint): void => {
    if (!map || !BMap) {
      console.warn('地图未就绪，无法播放轨迹');
      return;
    }

    if (!points) {
      clearTrajectory();
      return;
    }

    if (Array.isArray(points)) {
      clearTrajectory();
      if (points.length === 0) {
        return;
      }
      const path = points.map((p) => new BMap.Point(p.lng, p.lat));
      trajectoryLine = new BMap.Polyline(path, {
        strokeColor: '#3B82F6',
        strokeWeight: 4,
        strokeOpacity: 0.8
      });
      map.addOverlay(trajectoryLine);
      moveTrajectoryMarker(points[0]!);
      return;
    }

    moveTrajectoryMarker(points);
  };

  // 暴露方法给父组件
  defineExpose({
    map,
    flyToVehicle,
    drawRectangle,
    drawCircle,
    startDraw,
    addFenceOverlay,
    removeFenceOverlay,
    clearFences,
    playTrajectory
  });

  onUnmounted(() => {
    console.log('组件卸载，清理资源');
    // 停止动画
    // 停止ws
    mockWS.stop();
    // 清除地图实例
  });
</script>

<style lang="scss" scoped>
  .map-view {
    width: 100%;
    height: 100%;
    position: relative;
    .map {
      width: 100%;
      height: 100%;
    }
  }
  .button {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 1000;
    button {
      padding: 8px 12px;
      background-color: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      &:hover {
        background-color: #2563eb;
      }
    }
  }

  .heatmap-toggle {
    position: absolute;
    bottom: 20px;
    right: 20px;
    z-index: 10;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    &:hover {
      background: #10b981;
      border-color: #10b981;
    }
  }
</style>
