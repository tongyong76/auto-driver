import {
  type IVehicle,
  type IWebSocketMessage,
  VehicleStatus,
  FAULT_CODES,
  MAX_TRAJECTORY_POINTS
} from '@/types/vehicle';
import { generateVehicles, updateVehicleTrajectory } from '@/models/vehicle';
import { updateVehiclePosition } from '@/utils/vehicleMovement';

type MessageCallback = (message: IWebSocketMessage) => void;
type StatusCallback = (status: 'connected' | 'disconnected' | 'reconnecting') => void;

class MockWebSocket {
  private listeners: Map<string, MessageCallback[]> = new Map();
  private statusListeners: Map<string, StatusCallback[]> = new Map();
  private vehicles: IVehicle[];
  private interval: number | null = null;
  private isConnected = true;
  private simulateDisconnect = false;

  constructor() {
    this.vehicles = generateVehicles();
  }

  /**
   * 启动模拟数据推送
   */
  public start(): void {
    // 这里的清空定时器包括stop里的清空定时器都是无效的，原因待查
    if (this.interval) {
      clearInterval(this.interval);
    }

    console.log('MockWebSocket started', this.interval);

    this.interval = window.setInterval(() => {
      if (!this.simulateDisconnect && this.isConnected) {
        this.updateVehicles();
        this.emitMessage();
      }
    }, 1000);
  }

  /**
   * 停止模拟数据推送
   */
  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isConnected = false;
    this.emitStatus('disconnected');
  }

  /**
   * 更新所有车辆状态
   */
  private updateVehicles(): void {
    this.vehicles.forEach((vehicle: IVehicle) => {
      // 更新位置
      updateVehiclePosition(vehicle);
      updateVehicleTrajectory(vehicle);

      // 模拟随机故障产生（千分之一概率）
      if (Math.random() < 0.001 && vehicle.status !== VehicleStatus.FAULT) {
        vehicle.status = VehicleStatus.FAULT;
        vehicle.faultCode = FAULT_CODES[Math.floor(Math.random() * FAULT_CODES.length)] as string;
      }

      // 模拟故障恢复（百分之二概率）
      if (vehicle.status === VehicleStatus.FAULT && Math.random() < 0.02) {
        vehicle.status = VehicleStatus.SWEEPING;
        vehicle.faultCode = null;
      }

      // 随机变化速度（±2 km/h，限制范围 5-25）
      vehicle.speedKmh = Math.max(5, Math.min(25, vehicle.speedKmh + (Math.random() - 0.5) * 2));

      // 随机变化电量（±0.5%，限制范围 0-100）
      vehicle.battery = Math.max(0, Math.min(100, vehicle.battery + (Math.random() - 0.5) * 0.5));
    });
  }

  /**
   * 触发消息事件
   */
  private emitMessage(): void {
    const message: IWebSocketMessage = {
      type: 'vehicles_update',
      data: [...this.vehicles], // 返回副本
      timestamp: Date.now()
    };

    const callbacks = this.listeners.get('message') || [];
    callbacks.forEach((cb) => cb(message));
  }

  /**
   * 触发连接状态事件
   */
  private emitStatus(status: 'connected' | 'disconnected' | 'reconnecting'): void {
    const callbacks = this.statusListeners.get('status') || [];
    callbacks.forEach((cb) => cb(status));
  }

  /**
   * 监听消息事件
   * @param event 事件名
   * @param callback 回调函数
   */
  public on(event: string, callback: MessageCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * 监听连接状态事件
   */
  public onStatus(callback: StatusCallback): void {
    if (!this.statusListeners.has('status')) {
      this.statusListeners.set('status', []);
    }
    this.statusListeners.get('status')!.push(callback);
  }

  /**
   * 移除事件监听
   * @param event 事件名
   * @param callback 回调函数
   */
  public off(event: string, callback: MessageCallback): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 获取当前车辆数据
   */
  public getVehicles(): IVehicle[] {
    return [...this.vehicles];
  }

  /**
   * 获取指定车辆的轨迹
   */
  public getVehicleTrajectory(vehicleId: string): IVehicle['trajectory'] | null {
    const vehicle = this.vehicles.find((v) => v.id === vehicleId);
    return vehicle ? [...vehicle.trajectory] : null;
  }
}

// 全局键，避免因模块重复加载而创建多个实例
const GLOBAL_KEY = '__AUTO_DRIVER_MOCK_WEBSOCKET_INSTANCE__';

if (!(globalThis as any)[GLOBAL_KEY]) {
  (globalThis as any)[GLOBAL_KEY] = new MockWebSocket();
}

// 单例导出（从 globalThis 读取，确保全局唯一）
export const mockWS: MockWebSocket = (globalThis as any)[GLOBAL_KEY];
