# 超级飞侠 3D 地球地图应用计划

## Summary

构建一个中文网页应用，面向亲子共看：用 3D 地球展示《超级飞侠》中出现过的地点，用户点击地点后查看对应动画的集数卡片、地点介绍和探索信息。第一版使用 12 个样例地点，本地 JSON 维护数据，不接后台，不嵌入视频，不使用官方角色素材，整体采用原创旅行探索风格。

## Key Changes

- 新建前端项目，建议使用 `Vite + React + TypeScript`。
- 使用 Three.js 生态的 3D 地球组件展示地点标记、航线和点击交互。
- 首页直接进入地球探索界面，不做营销落地页。
- UI 使用中文，适合亲子共看：大面积地球视图、简洁地点卡片、清晰筛选和动画集数信息。
- 数据放在本地 JSON 文件中，后续可平滑迁移到后台或可视化编辑器。

## Data Model

地点数据使用结构化 JSON，第一版字段固定为：

```ts
type SuperWingsLocation = {
  id: string;
  nameZh: string;
  nameEn?: string;
  countryZh: string;
  region: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  episode: {
    season?: number;
    episode?: number;
    titleZh: string;
    summaryZh: string;
    watchUrl?: string;
  };
  tags: string[];
  funFactZh: string;
};
```

第一版包含 12 个样例地点，数据以“可演示产品体验”为目标，不承诺全集准确性。每条样例数据需要保留可编辑字段，便于后续人工校对。

## Implementation

- 搭建响应式单页应用，桌面优先兼容移动端。
- 主视图包含 3D 地球、地点标记、航线视觉、区域/标签筛选、当前选中地点详情面板。
- 地点卡片展示地点名、国家/地区、对应动画标题、简介、趣味地理信息和可选观看外链。
- 不在站内嵌入动画视频；如未来添加链接，仅作为外部跳转字段 `watchUrl`。
- 视觉素材使用原创地球、航线、图标、地点插画或 CSS/Canvas 效果，不直接抓取或使用官方角色图片。
- 地球真实贴图使用 NASA Earth Observatory 的 Blue Marble: Next Generation（July topography + bathymetry）素材，发布时保留来源说明。
- 保持数据层和 UI 分离：新增地点只需要编辑 JSON，不需要改组件逻辑。

## Test Plan

- 验证桌面和移动端首屏无重叠，地球可旋转、缩放、点击地点。
- 验证 12 个地点都能正确渲染，并能打开对应详情卡片。
- 验证筛选后地点数量、选中状态和详情面板同步正确。
- 验证缺失可选字段时 UI 不崩溃，例如没有 `season`、`episode` 或 `watchUrl`。
- 运行项目构建检查，确保 TypeScript 和生产构建通过。

## Assumptions

- 第一版只做前端网页应用，不做登录、后台、云数据库或管理端。
- 第一版数据为样例数据，后续由人工补充和校对全集地点。
- 动画关联以“集数卡片”为准，不做站内播放。
- 不使用官方《超级飞侠》角色图、Logo 或剧照，除非后续你提供已授权素材。
