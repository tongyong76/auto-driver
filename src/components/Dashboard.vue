<template>
  <div class="dashboard" :class="{ collapsed }">
    <div class="dashboard-header" @click="toggleCollapse">
      <span class="title">📊 运营指挥中心大屏</span>
      <button class="collapse-btn">{{ collapsed ? '▼' : '▲' }}</button>
    </div>

    <div class="dashboard-content" v-show="!collapsed">
      <!-- 第一行：核心指标卡片 -->
      <div class="stats-row">
        <div class="stat-card-lg">
          <div class="stat-value">{{ formatNumber(totalDistance) }}</div>
          <div class="stat-label">今日总里程 (km)</div>
          <div class="stat-trend" :class="{ up: distanceTrend > 0, down: distanceTrend < 0 }">
            {{ distanceTrend > 0 ? '↑' : '↓' }} {{ Math.abs(distanceTrend).toFixed(1) }}%
          </div>
        </div>
        <div class="stat-card-lg">
          <div class="stat-value">{{ onlineRate }}%</div>
          <div class="stat-label">在线率</div>
          <div class="stat-sub">在线: {{ onlineCount }} / 总: {{ totalVehicles }}</div>
        </div>
        <div class="stat-card-lg">
          <div class="stat-value">{{ avgSpeed }}</div>
          <div class="stat-label">平均速度 (km/h)</div>
          <div class="stat-sub">最高: {{ maxSpeed }} km/h</div>
        </div>
        <div class="stat-card-lg">
          <div class="stat-value">{{ avgBattery }}%</div>
          <div class="stat-label">平均电量</div>
          <div class="stat-sub">低电量: {{ lowBatteryCount }} 辆</div>
        </div>
      </div>

      <!-- 第二行：图表区域 -->
      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-title">车辆状态分布</div>
          <div ref="statusChartRef" class="chart"></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">速度分布</div>
          <div ref="speedChartRef" class="chart"></div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-title">电池电量分布</div>
          <div ref="batteryChartRef" class="chart"></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">故障统计</div>
          <div ref="faultChartRef" class="chart"></div>
        </div>
      </div>

      <!-- 第三行：车辆列表表格 -->
      <div class="vehicle-table">
        <div class="table-title">车辆实时状态</div>
        <div class="table-container">
          <table>
            <thead>
              <tr><th>车辆ID</th><th>速度</th><th>电量</th><th>状态</th><th>故障码</th></tr>
            </thead>
            <tbody>
              <tr
                v-for="vehicle in vehicles"
                :key="vehicle.id"
                @click="emit('select-vehicle', vehicle)"
              >
                <td>{{ vehicle.id }}</td>
                <td>{{ vehicle.speedKmh.toFixed(1) }} km/h</td>
                <td>
                  <div class="battery-cell">
                    <div
                      class="battery-bar-mini"
                      :style="{
                        width: vehicle.battery + '%',
                        background: getBatteryColor(vehicle.battery)
                      }"
                    ></div>
                    <span>{{ vehicle.battery.toFixed(0) }}%</span>
                  </div>
                </td>
                <td>
                  <span class="status-badge" :class="vehicle.status">
                    {{ getStatusText(vehicle.status) }}
                  </span>
                </td>
                <td>{{ vehicle.faultCode || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, onMounted, onUnmounted } from 'vue';
  import * as echarts from 'echarts';
  import type { Vehicle, VehicleStatus } from '../types/vehicle';

  const props = defineProps<{
    vehicles: Vehicle[];
  }>();

  const emit = defineEmits<{
    (e: 'select-vehicle', vehicle: Vehicle): void;
  }>();

  // UI 状态
  const collapsed = ref(false);

  // 图表实例
  const statusChartRef = ref<HTMLElement>();
  const speedChartRef = ref<HTMLElement>();
  const batteryChartRef = ref<HTMLElement>();
  const faultChartRef = ref<HTMLElement>();

  let statusChart: echarts.ECharts | null = null;
  let speedChart: echarts.ECharts | null = null;
  let batteryChart: echarts.ECharts | null = null;
  let faultChart: echarts.ECharts | null = null;

  // 统计数据
  const totalVehicles = ref(0);
  const onlineCount = ref(0);
  const onlineRate = ref(0);
  const avgSpeed = ref(0);
  const maxSpeed = ref(0);
  const avgBattery = ref(0);
  const lowBatteryCount = ref(0);
  const totalDistance = ref(0);
  let previousDistance = ref(0);
  const distanceTrend = ref(0);

  // 累积里程（模拟，每秒增加）
  let distanceInterval: number | null = null;

  /**
   * 获取状态文本
   */
  const getStatusText = (status: VehicleStatus): string => {
    const map: Record<VehicleStatus, string> = {
      sweeping: '作业',
      idle: '闲置',
      fault: '故障',
      charging: '充电'
    };
    return map[status];
  };

  /**
   * 获取电池颜色
   */
  const getBatteryColor = (battery: number): string => {
    if (battery >= 70) return '#10B981';
    if (battery >= 30) return '#F59E0B';
    return '#EF4444';
  };

  /**
   * 格式化数字
   */
  const formatNumber = (num: number): string => {
    return num.toFixed(1);
  };

  /**
   * 更新统计数据
   */
  const updateStats = (): void => {
    const v = props.vehicles;
    totalVehicles.value = v.length;
    onlineCount.value = v.filter((v) => v.status !== 'fault').length;
    onlineRate.value = Math.round((onlineCount.value / totalVehicles.value) * 100);

    const speedSum = v.reduce((sum, v) => sum + v.speedKmh, 0);
    avgSpeed.value = parseFloat((speedSum / v.length).toFixed(1));
    maxSpeed.value = Math.max(...v.map((v) => v.speedKmh), 0);

    const batterySum = v.reduce((sum, v) => sum + v.battery, 0);
    avgBattery.value = Math.round(batterySum / v.length);
    lowBatteryCount.value = v.filter((v) => v.battery < 30).length;
  };

  /**
   * 更新状态分布图
   */
  const updateStatusChart = (): void => {
    if (!statusChart) return;

    const statusCount = {
      sweeping: props.vehicles.filter((v) => v.status === 'sweeping').length,
      idle: props.vehicles.filter((v) => v.status === 'idle').length,
      fault: props.vehicles.filter((v) => v.status === 'fault').length,
      charging: props.vehicles.filter((v) => v.status === 'charging').length
    };

    statusChart.setOption({
      series: [
        {
          type: 'pie',
          radius: '55%',
          data: [
            { name: '作业中', value: statusCount.sweeping, itemStyle: { color: '#10B981' } },
            { name: '闲置', value: statusCount.idle, itemStyle: { color: '#F59E0B' } },
            { name: '故障', value: statusCount.fault, itemStyle: { color: '#EF4444' } },
            { name: '充电', value: statusCount.charging, itemStyle: { color: '#3B82F6' } }
          ],
          label: { color: 'white' },
          labelLine: { lineStyle: { color: 'rgba(255,255,255,0.3)' } }
        }
      ]
    });
  };

  /**
   * 更新速度分布图
   */
  const updateSpeedChart = (): void => {
    if (!speedChart) return;

    const speeds = props.vehicles.map((v) => v.speedKmh);
    const bins = [0, 5, 10, 15, 20, 25, 30];
    const counts = bins.map((_, i) => {
      if (i === bins.length - 1) return speeds.filter((s) => s >= bins[i]).length;
      return speeds.filter((s) => s >= bins[i] && s < bins[i + 1]).length;
    });

    speedChart.setOption({
      xAxis: {
        type: 'category',
        data: ['0-5', '5-10', '10-15', '15-20', '20-25', '25+'],
        axisLabel: { color: 'rgba(255,255,255,0.7)' }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: 'rgba(255,255,255,0.7)' }
      },
      series: [
        {
          type: 'bar',
          data: counts.slice(0, -1),
          itemStyle: { color: '#10B981', borderRadius: [4, 4, 0, 0] }
        }
      ]
    });
  };

  /**
   * 更新电池分布图
   */
  const updateBatteryChart = (): void => {
    if (!batteryChart) return;

    const batteries = props.vehicles.map((v) => v.battery);
    const bins = [0, 20, 40, 60, 80, 100];
    const counts = bins.map((_, i) => {
      if (i === bins.length - 1) return batteries.filter((b) => b >= bins[i]).length;
      return batteries.filter((b) => b >= bins[i] && b < bins[i + 1]).length;
    });

    batteryChart.setOption({
      xAxis: {
        type: 'category',
        data: ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'],
        axisLabel: { color: 'rgba(255,255,255,0.7)' }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: 'rgba(255,255,255,0.7)' }
      },
      series: [
        {
          type: 'bar',
          data: counts,
          itemStyle: {
            color: (params: any) => {
              const colors = ['#EF4444', '#F59E0B', '#FBBF24', '#10B981', '#10B981'];
              return colors[params.dataIndex];
            },
            borderRadius: [4, 4, 0, 0]
          }
        }
      ]
    });
  };

  /**
   * 更新故障统计图
   */
  const updateFaultChart = (): void => {
    if (!faultChart) return;

    const faultVehicles = props.vehicles.filter((v) => v.status === 'fault');
    const faultCounts: Record<string, number> = {};
    faultVehicles.forEach((v) => {
      if (v.faultCode) {
        faultCounts[v.faultCode] = (faultCounts[v.faultCode] || 0) + 1;
      }
    });

    const faultData = Object.entries(faultCounts).map(([code, count]) => ({
      name: code,
      value: count
    }));

    if (faultData.length === 0) {
      faultChart.setOption({
        title: {
          text: '暂无故障',
          left: 'center',
          top: 'center',
          textStyle: { color: 'rgba(255,255,255,0.5)' }
        }
      });
    } else {
      faultChart.setOption({
        series: [
          {
            type: 'pie',
            radius: '55%',
            data: faultData,
            label: { color: 'white' }
          }
        ]
      });
    }
  };

  /**
   * 更新所有图表
   */
  const updateAllCharts = (): void => {
    updateStats();
    updateStatusChart();
    updateSpeedChart();
    updateBatteryChart();
    updateFaultChart();
  };

  /**
   * 切换折叠状态
   */
  const toggleCollapse = (): void => {
    collapsed.value = !collapsed.value;
    // 折叠后延迟触发图表自适应
    setTimeout(() => {
      statusChart?.resize();
      speedChart?.resize();
      batteryChart?.resize();
      faultChart?.resize();
    }, 300);
  };

  /**
   * 初始化模拟里程累计
   */
  const initDistanceSimulation = (): void => {
    if (distanceInterval) clearInterval(distanceInterval);

    distanceInterval = window.setInterval(() => {
      const increment = (Math.random() * 5 + 2) / 10; // 每秒增加 0.2-0.7 km
      previousDistance.value = totalDistance.value;
      totalDistance.value += increment;

      if (previousDistance.value > 0) {
        distanceTrend.value = (increment / previousDistance.value) * 100;
      }
    }, 1000);
  };

  onMounted(() => {
    // 初始化图表
    if (statusChartRef.value) {
      statusChart = echarts.init(statusChartRef.value);
      statusChart.setOption({ backgroundColor: 'transparent' });
    }
    if (speedChartRef.value) {
      speedChart = echarts.init(speedChartRef.value);
      speedChart.setOption({ backgroundColor: 'transparent', grid: { containLabel: true } });
    }
    if (batteryChartRef.value) {
      batteryChart = echarts.init(batteryChartRef.value);
      batteryChart.setOption({ backgroundColor: 'transparent', grid: { containLabel: true } });
    }
    if (faultChartRef.value) {
      faultChart = echarts.init(faultChartRef.value);
      faultChart.setOption({ backgroundColor: 'transparent' });
    }

    initDistanceSimulation();
  });

  onUnmounted(() => {
    if (distanceInterval) clearInterval(distanceInterval);
    statusChart?.dispose();
    speedChart?.dispose();
    batteryChart?.dispose();
    faultChart?.dispose();
  });

  // 监听车辆数据变化，更新图表
  watch(
    () => props.vehicles,
    () => {
      updateAllCharts();
    },
    { deep: true }
  );
</script>

<style scoped>
  .dashboard {
    position: absolute;
    bottom: 20px;
    left: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    z-index: 15;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
  }

  .dashboard.collapsed {
    bottom: auto;
    top: 20px;
    right: 20px;
    left: auto;
    min-width: 200px;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    cursor: pointer;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .title {
    font-weight: bold;
    font-size: 16px;
    color: white;
  }

  .collapse-btn {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 14px;
  }

  .dashboard-content {
    padding: 16px;
  }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 20px;
  }

  .stat-card-lg {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 12px;
    text-align: center;
  }

  .stat-value {
    font-size: 28px;
    font-weight: bold;
    color: #10b981;
  }

  .stat-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 4px;
  }

  .stat-trend {
    font-size: 11px;
    margin-top: 6px;
  }

  .stat-trend.up {
    color: #10b981;
  }
  .stat-trend.down {
    color: #ef4444;
  }

  .stat-sub {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 4px;
  }

  .charts-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-bottom: 16px;
  }

  .chart-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 12px;
  }

  .chart-title {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 12px;
  }

  .chart {
    height: 200px;
  }

  .vehicle-table {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 12px;
    margin-top: 16px;
  }

  .table-title {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 12px;
  }

  .table-container {
    max-height: 250px;
    overflow-y: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  th,
  td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  th {
    color: rgba(255, 255, 255, 0.7);
    font-weight: normal;
  }

  td {
    color: white;
    cursor: pointer;
  }

  tr:hover td {
    background: rgba(16, 185, 129, 0.1);
  }

  .battery-cell {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 80px;
  }

  .battery-bar-mini {
    height: 6px;
    background: #10b981;
    border-radius: 3px;
  }

  .status-badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
  }

  .status-badge.sweeping {
    background: #10b981;
  }
  .status-badge.idle {
    background: #f59e0b;
  }
  .status-badge.fault {
    background: #ef4444;
  }
  .status-badge.charging {
    background: #3b82f6;
  }

  .table-container::-webkit-scrollbar {
    width: 4px;
  }

  .table-container::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  .table-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
  }
</style>
