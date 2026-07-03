import { ref } from 'vue';
import type { IVehicle } from '../types/vehicle';

// 声明全局的 BMapLib 类型
declare global {
  interface Window {
    BMapLib: any;
  }
}

// 热力图数据点
export interface IHeatmapPoint {
  lng: number;
  lat: number;
  count: number; // 作业密度权重
}

export function useHeatmap() {
  const heatmapOverlay = ref<any>(null);
  const isHeatmapVisible = ref(true);

  const loadHeatmapLib = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.BMapLib && window.BMapLib.HeatmapOverlay) {
        resolve();
        return;
      }

      const src = 'https://api.map.baidu.com/library/Heatmap/2.0/src/Heatmap_min.js';
      if (document.querySelector(`script[src="${src}"]`)) {
        const check = () => {
          if (window.BMapLib && window.BMapLib.HeatmapOverlay) resolve();
          else setTimeout(check, 100);
        };
        check();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        if (window.BMapLib && window.BMapLib.HeatmapOverlay) {
          resolve();
        } else {
          reject(new Error('HeatmapOverlay 加载后未找到 BMapLib.HeatmapOverlay'));
        }
      };
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
      console.log('加载热力图插件脚本 start');
    });
  };

  const initHeatmap = async (map: any, BMap: any) => {
    if (!map) {
      console.warn('地图实例未传入');
      return;
    }

    try {
      await loadHeatmapLib();
      console.log('加载热力图插件脚本 complete');
    } catch (error) {
      console.error('加载热力图插件失败：', error);
      return;
    }

    if (!window.BMapLib || !window.BMapLib.HeatmapOverlay) {
      console.warn('BMapLib.HeatmapOverlay 未就绪');
      return;
    }

    heatmapOverlay.value = new window.BMapLib.HeatmapOverlay({
      radius: 50,
      opacity: 0.6,
      gradient: {
        0.2: 'rgb(0, 255, 0)',
        0.4: 'rgb(0, 255, 255)',
        0.6: 'rgb(255, 255, 0)',
        0.8: 'rgb(255, 128, 0)',
        1.0: 'rgb(255, 0, 0)'
      }
    });

    map.addOverlay(heatmapOverlay.value);
    console.log('热力图初始化完成');
  };

  const updateHeatmapData = (vehicles: IVehicle[]) => {
    if (!heatmapOverlay.value) return;

    // 筛选出作业中的车辆
    const sweepingVehicles = vehicles.filter((v) => v.status === 'sweeping');

    // 构建热力图数据点
    const points: IHeatmapPoint[] = sweepingVehicles.map((vehicle) => ({
      lng: vehicle.lng,
      lat: vehicle.lat,
      count: Math.min(10, Math.floor(vehicle.speedKmh / 5) + 1)
    }));

    // 更新热力图
    const dataSet: { data: IHeatmapPoint[]; max: number } = {
      data: points,
      max: 10 // 最大权重值，用于归一化颜色
    };
    heatmapOverlay.value.setDataSet(dataSet);
  };

  const toggleHeatmap = (): void => {
    if (!heatmapOverlay.value) return;

    if (isHeatmapVisible.value) {
      heatmapOverlay.value.hide();
    } else {
      heatmapOverlay.value.show();
    }
    isHeatmapVisible.value = !isHeatmapVisible.value;
  };

  // /**
  //  * 显示热力图
  //  */
  // const showHeatmap = (): void => {
  //   if (heatmapOverlay.value) {
  //     heatmapOverlay.value.show();
  //     isHeatmapVisible.value = true;
  //   }
  // };

  // /**
  //  * 隐藏热力图
  //  */
  // const hideHeatmap = (): void => {
  //   if (heatmapOverlay.value) {
  //     heatmapOverlay.value.hide();
  //     isHeatmapVisible.value = false;
  //   }
  // };

  return {
    heatmapOverlay,
    isHeatmapVisible,
    initHeatmap,
    updateHeatmapData,
    toggleHeatmap
    // showHeatmap,
    // hideHeatmap
  };
}
