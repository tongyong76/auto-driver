import { type IGeoFence, FenceType } from '../types/vehicle';

/**
 * 计算两点之间的距离（米）- 使用 Haversine 公式
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371000; // 地球半径（米）
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * 判断点是否在圆形围栏内
 */
export const isPointInCircle = (
  point: { lng: number; lat: number },
  center: { lng: number; lat: number },
  radius: number
): boolean => {
  const distance = calculateDistance(point.lat, point.lng, center.lat, center.lng);
  return distance <= radius;
};

/**
 * 判断点是否在矩形围栏内
 */
export const isPointInRectangle = (
  point: { lng: number; lat: number },
  southWest: { lng: number; lat: number },
  northEast: { lng: number; lat: number }
): boolean => {
  return (
    point.lng >= southWest.lng &&
    point.lng <= northEast.lng &&
    point.lat >= southWest.lat &&
    point.lat <= northEast.lat
  );
};

/**
 * 检查车辆是否越界
 */
export const checkBoundary = (
  position: { lng: number; lat: number },
  fence: IGeoFence
): boolean => {
  if (fence.type === FenceType.CIRCLE && fence.center && fence.radius) {
    return !isPointInCircle(position, fence.center, fence.radius);
  }

  if (fence.type === FenceType.RECTANGLE && fence.bounds) {
    return !isPointInRectangle(position, fence.bounds.southWest, fence.bounds.northEast);
  }

  return false;
};
