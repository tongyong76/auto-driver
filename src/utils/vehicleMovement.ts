import type { IVehicle } from '../types/vehicle';

/**
 * 计算两点之间的方向角（度）
 * @param from 起点 [经度, 纬度]
 * @param to 终点 [经度, 纬度]
 * @returns 角度（0-360，以正北为0，顺时针）
 */
export const calculateHeading = (from: [number, number], to: [number, number]): number => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return angle;
};

/**
 * 更新车辆位置
 * @param vehicle 车辆对象（会被直接修改）
 */
export const updateVehiclePosition = (vehicle: IVehicle): void => {
  const { route, currentPointIndex, progress, speed } = vehicle;
  const from = route[currentPointIndex] as [number, number];
  const to = route[currentPointIndex + 1] as [number, number];

  // 到达终点处理
  if (!to) {
    vehicle.currentPointIndex = 0;
    vehicle.progress = 0;
    vehicle.lng = route![0]![0];
    vehicle.lat = route![0]![1];
    vehicle.heading = calculateHeading(route![0]!, route![1]!);
    return;
  }

  // 计算新进度
  let newProgress = progress + speed;

  if (newProgress >= 1) {
    // 移动到下一段路径
    vehicle.currentPointIndex++;
    vehicle.progress = 0;
    updateVehiclePosition(vehicle); // 递归处理下一段
  } else {
    // 线性插值计算当前位置
    const lng = from[0] + (to[0] - from[0]) * newProgress;
    const lat = from[1] + (to[1] - from[1]) * newProgress;
    vehicle.lng = lng;
    vehicle.lat = lat;
    vehicle.progress = newProgress;
    vehicle.heading = calculateHeading(from, to);
  }
};

/**
 * 批量更新车辆位置
 * @param vehicles 车辆数组
 */
export const updateAllVehiclePositions = (vehicles: IVehicle[]): void => {
  vehicles.forEach((vehicle) => updateVehiclePosition(vehicle));
};
