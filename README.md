# 无人驾驶车云端监控演示平台

## 项目简介

基于 Vue 3 + TypeScript + 百度地图 API 的环卫车车队监控演示系统，实现车辆实时定位、轨迹回放、电子围栏、热力图、远程指令下发等功能。

## 技术栈

- **框架**: Vue 3 + TypeScript + Vite
- **地图**: 百度地图 API v3.0 + vue-baidu-map-next
- **状态**: WebSocket (Mock)
- **类型安全**: 完整的 TypeScript 类型定义
- **图表**: ECharts

## 功能特性

- ✅ 10辆模拟环卫车实时定位与方向角渲染
- ✅ 车辆状态分类（作业/闲置/故障）
- ✅ 车队统计面板（速度/电量/在线率）
- ✅ 5分钟历史轨迹存储与回放
- ✅ 电子围栏绘制（矩形/圆形）与越界告警
- ✅ 作业热力图（基于车辆密度）
- ✅ ECharts 仪表盘（状态分布、速度分布、电池分布、故障统计）
- ✅ 远程指令模拟（降速/恢复/紧急停车）
- ✅ WebSocket 断线重连 + 心跳检测

## 项目结构

src/
├── types/ # TypeScript 类型定义
│ ├── vehicle.ts # 车辆数据类型
│ └── baidu-map.d.ts # 百度地图类型声明
├── models/ # 数据模型
│ └── vehicle.ts # 车辆生成器
├── services/ # 服务层
│ └── mockWebSocket.ts # WebSocket 模拟服务
├── utils/ # 工具函数
│ └── vehicleMovement.ts # 车辆移动逻辑
├── components/ # Vue 组件
│ ├── MapView.vue # 地图组件
│ └── InfoPanel.vue # 信息面板
├── App.vue
├── main.ts
└── env.d.ts # 环境变量类型

## TypeScript 特性

- ✅ 完整的类型定义
- ✅ 接口和枚举
- ✅ 泛型约束
- ✅ 类型守卫
- ✅ 模块化导出

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
# 复制 .env.example 为 .env 并填入百度地图 AK

# 开发模式
npm run dev

# 生产构建
npm run build

# 预览构建结果
npm run preview
```
