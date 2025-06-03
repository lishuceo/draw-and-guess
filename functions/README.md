# 画笔传说 - 云函数

## 概述

这个目录包含了画笔传说游戏的 Firebase Cloud Functions。所有函数都配置为部署到 `asia-southeast1`（新加坡）区域，以优化亚洲地区的访问延迟。

## 函数列表

### 1. cleanupInactiveRooms

- **类型**: 定时触发（Scheduled Function）
- **频率**: 每5分钟运行一次
- **功能**: 自动清理无活动的房间
- **清理条件**:
  - 房主不存在
  - 房主超过2分钟没有心跳
  - 房间创建超过10分钟且没有心跳数据

### 2. manualCleanupRooms

- **类型**: HTTP触发
- **功能**: 手动触发房间清理（用于测试和维护）
- **返回**: 详细的清理报告，包括房间状态和删除情况

## 部署指南

### 前置要求

1. 安装 Firebase CLI：
   ```bash
   npm install -g firebase-tools
   ```

2. 登录 Firebase：
   ```bash
   firebase login
   ```

### 部署步骤

1. 编译 TypeScript 代码：
   ```bash
   npm run build
   ```

2. 部署所有函数：
   ```bash
   firebase deploy --only functions
   ```

3. 部署特定函数：
   ```bash
   firebase deploy --only functions:cleanupInactiveRooms
   firebase deploy --only functions:manualCleanupRooms
   ```

### 测试手动清理函数

部署后，您可以通过以下方式测试手动清理函数：

```bash
# 使用 curl
curl https://asia-southeast1-taptap-ugc-1.cloudfunctions.net/manualCleanupRooms

# 或直接在浏览器中访问该URL
```

## 配置说明

### 区域配置

所有函数都配置为部署到 `asia-southeast1`（新加坡）区域：

```typescript
export const functionName = onSchedule({
  region: "asia-southeast1",
  // ... 其他配置
});
```

### 可用的亚洲区域

如果需要更改部署区域，可以选择以下亚洲区域之一：

- `asia-southeast1` - 新加坡（当前配置）
- `asia-southeast2` - 雅加达
- `asia-south1` - 孟买
- `asia-east1` - 台湾
- `asia-east2` - 香港
- `asia-northeast1` - 东京
- `asia-northeast2` - 大阪
- `asia-northeast3` - 首尔

### 修改部署区域

要更改部署区域，编辑 `src/index.ts` 文件中的 `region` 配置：

```typescript
region: "asia-southeast1", // 修改为您需要的区域
```

## 开发命令

- `npm run build` - 编译 TypeScript 代码
- `npm run serve` - 本地运行函数模拟器
- `npm run shell` - 启动函数 shell
- `npm run deploy` - 部署函数到 Firebase
- `npm run logs` - 查看函数日志

## 注意事项

1. 确保 Firebase 项目的计费计划支持云函数（需要 Blaze 计划）
2. 定时函数使用 Cloud Scheduler，可能产生少量费用
3. 函数部署到特定区域后，该区域不能更改，除非删除并重新创建函数
4. 心跳超时时间设置为2分钟，可根据需要在 `index.ts` 中调整

## 监控和日志

部署后，可以通过以下方式监控函数：

1. Firebase 控制台 - Functions 部分
2. Google Cloud Console - Cloud Functions
3. 使用 Firebase CLI 查看日志：
   ```bash
   firebase functions:log
   ``` 