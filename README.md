# 超级飞侠地点探索地图

中文亲子共看的 3D 地球地点探索应用。第一版使用本地 JSON 数据，不接后台、不嵌入视频、不使用官方角色图、Logo 或剧照。

## 运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 数据

地点数据在 `src/data/locations.json`。新增或校对地点时，只需要按 `src/types.ts` 的 `SuperWingsLocation` 结构维护 JSON。

当前 12 条地点是样例数据，用于演示产品体验，不承诺全集准确性。
