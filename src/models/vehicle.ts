import {
  type IVehicle,
  VehicleStatus,
  BASE_ROUTES,
  FAULT_CODES,
  MAX_TRAJECTORY_POINTS,
  type ITrajectoryPoint,
  type RouteConfig
} from '../types/vehicle';

/**
 * 生成随机状态
 */
const getRandomStatus = (): VehicleStatus => {
  const statuses = [
    VehicleStatus.SWEEPING,
    VehicleStatus.SWEEPING,
    VehicleStatus.SWEEPING,
    VehicleStatus.IDLE,
    VehicleStatus.FAULT
  ];
  return statuses[Math.floor(Math.random() * statuses.length)] as VehicleStatus;
};

/**
 * 生成随机速度
 */
const getRandomSpeed = (): number => {
  return 10 + Math.random() * 15;
};

/**
 * 生成随机电量
 */
const getRandomBattery = (): number => {
  return 60 + Math.random() * 35;
};

/**
 * 初始化轨迹数组（用起始点填充）
 */
const initTrajectory = (
  lng: number,
  lat: number,
  heading: number,
  speed: number
): ITrajectoryPoint[] => {
  const now = Date.now();
  const trajectory: ITrajectoryPoint[] = [];
  for (let i = 0; i < MAX_TRAJECTORY_POINTS; i++) {
    trajectory.push({
      lng,
      lat,
      heading,
      speed,
      timestamp: now - (MAX_TRAJECTORY_POINTS - i) * 1000
    });
  }
  return trajectory;
};

/**
 * 生成10辆模拟车辆
 */
export const generateVehicles = (): IVehicle[] => {
  const vehicles: IVehicle[] = [];

  for (let i = 0; i < 10; i++) {
    const routeIndex = i % BASE_ROUTES.length;
    const route = BASE_ROUTES[routeIndex] as RouteConfig;
    const status = getRandomStatus();
    const startLng = route!.points?.[0]?.[0];
    const startLat = route!.points?.[0]?.[1];
    const startSpeed = getRandomSpeed();

    vehicles.push({
      id: `S${String(i + 1).padStart(3, '0')}`,
      route: route.points,
      currentPointIndex: 0,
      progress: 0,
      speed: route.speed,
      lng: startLng!,
      lat: startLat!,
      heading: 0,
      speedKmh: startSpeed,
      battery: getRandomBattery(),
      status: status,
      faultCode:
        status === VehicleStatus.FAULT
          ? FAULT_CODES[Math.floor(Math.random() * FAULT_CODES.length)]!
          : null,
      trajectory: initTrajectory(startLng!, startLat!, 0, startSpeed)
    });
  }

  return vehicles;
};

/**
 * 更新车辆轨迹
 */
export const updateVehicleTrajectory = (vehicle: IVehicle): void => {
  const newPoint: ITrajectoryPoint = {
    lng: vehicle.lng,
    lat: vehicle.lat,
    heading: vehicle.heading,
    speed: vehicle.speedKmh,
    timestamp: Date.now()
  };

  vehicle.trajectory.push(newPoint);

  // 保持最多 MAX_TRAJECTORY_POINTS 个点
  while (vehicle.trajectory.length > MAX_TRAJECTORY_POINTS) {
    vehicle.trajectory.shift();
  }
};
