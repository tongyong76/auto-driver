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
// 全局补丁：当未显式指定时，为 2D Canvas 上下文设置 willReadFrequently=true
// 这样能改善频繁使用 getImageData 的第三方库（例如热力图插件）的性能警告
(() => {
  try {
    const _getContext = (HTMLCanvasElement.prototype as any).getContext;
    (HTMLCanvasElement.prototype as any).getContext = function (this: HTMLCanvasElement, type: string, options?: any) {
      if (type === '2d') {
        if (!options || options.willReadFrequently === undefined) {
          const opts = options ? Object.assign({}, options) : {};
          opts.willReadFrequently = true;
          return _getContext.call(this, type, opts);
        }
      }
      return _getContext.call(this, type, options);
    };
  } catch (e) {
    // 若运行环境不支持或被安全策略限制，忽略补丁以保持兼容性
  }
})();

app.mount("#app");
