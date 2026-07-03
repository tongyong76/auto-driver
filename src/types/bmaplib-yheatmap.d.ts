// bmaplib.heatmap 的类型声明
declare module 'bmaplib.heatmap' {
  export interface HeatmapOverlayOptions {
    radius?: number; // 热力图半径，默认 50
    opacity?: number; // 透明度，默认 0.6
    gradient?: Record<number, string>; // 颜色渐变
    visible?: boolean; // 是否可见
  }

  export interface HeatmapDataSet {
    data: Array<{
      lng: number;
      lat: number;
      count: number;
    }>;
    max?: number; // 最大权重值
  }

  export class HeatmapOverlay {
    constructor(options?: HeatmapOverlayOptions);
    setDataSet(dataSet: HeatmapDataSet): void;
    show(): void;
    hide(): void;
  }
}
