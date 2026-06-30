import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import BaiduMap from 'vue-baidu-map-next'

const app = createApp(App);
// 注册百度地图组件
app.use(BaiduMap, {
  ak: (import.meta as any).env.VITE_BAIDU_MAP_AK, // 使用环境变量
  v: "3.0", // API 版本
});
app.mount("#app");
