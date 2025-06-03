import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// 初始化Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// 配置参数
const HEARTBEAT_TIMEOUT = 2 * 60 * 1000; // 2分钟无心跳视为离线
const ROOM_CLEANUP_INTERVAL = "*/5 * * * *"; // 每5分钟运行一次

// App ID - 请确保与前端保持一致
const APP_ID = '1:624067597389:web:0dadf33d960e0365a4f804';

// 获取房间集合路径
const getRoomsCollectionPath = () => `artifacts/${APP_ID}/public/data/draw_guess_rooms`;

interface Player {
  id: string;
  name: string;
  score: number;
  isHost?: boolean;
  lastHeartbeat?: number;
}

interface GameRoom {
  id: string;
  hostId: string;
  players: Player[];
  status: 'waiting' | 'playing' | 'round_end' | 'game_end';
  createdAt: any;
}

/**
 * 定期清理无活动的房间
 * 使用 Cloud Scheduler 每5分钟运行一次
 * 部署到亚洲东南区 (新加坡)
 */
export const cleanupInactiveRooms = onSchedule({
  schedule: ROOM_CLEANUP_INTERVAL,
  timeZone: "Asia/Shanghai", // 设置时区
  region: "asia-southeast1", // 部署到新加坡区域
}, async (event) => {
  logger.info('开始清理无活动的房间...');
  
  const now = Date.now();
  const roomsRef = db.collection(getRoomsCollectionPath());
  
  try {
    // 获取所有房间
    const roomsSnapshot = await roomsRef.get();
    
    if (roomsSnapshot.empty) {
      logger.info('没有找到任何房间');
      return;
    }
    
    const deletePromises: Promise<any>[] = [];
    
    roomsSnapshot.forEach((doc) => {
      const room = doc.data() as GameRoom;
      const roomId = doc.id;
      
      // 检查房主是否在线
      const host = room.players.find(p => p.id === room.hostId);
      
      if (!host) {
        // 房主不存在，删除房间
        logger.info(`房间 ${roomId} 的房主不存在，删除房间`);
        deletePromises.push(doc.ref.delete());
      } else if (host.lastHeartbeat) {
        // 检查房主心跳
        const timeSinceLastHeartbeat = now - host.lastHeartbeat;
        
        if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
          logger.info(`房间 ${roomId} 的房主已离线 ${Math.floor(timeSinceLastHeartbeat / 1000)}秒，删除房间`);
          deletePromises.push(doc.ref.delete());
        }
      } else {
        // 如果没有心跳时间戳，检查房间创建时间
        // createdAt 可能是数字时间戳或 Firestore Timestamp
        let createdAtMillis = 0;
        if (room.createdAt) {
          if (typeof room.createdAt === 'number') {
            createdAtMillis = room.createdAt;
          } else if (room.createdAt.toMillis) {
            createdAtMillis = room.createdAt.toMillis();
          }
        }
        const roomAge = now - createdAtMillis;
        
        // 如果房间超过10分钟且没有心跳数据，删除
        if (roomAge > 10 * 60 * 1000) {
          logger.info(`房间 ${roomId} 超过10分钟没有心跳数据，删除房间`);
          deletePromises.push(doc.ref.delete());
        }
      }
    });
    
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
      logger.info(`成功删除 ${deletePromises.length} 个无活动的房间`);
    } else {
      logger.info('没有需要清理的房间');
    }
  } catch (error) {
    logger.error('清理房间时出错:', error);
    throw error;
  }
});

/**
 * 手动触发房间清理的HTTP函数（用于测试）
 * 部署到亚洲东南区 (新加坡)
 */
export const manualCleanupRooms = onRequest({
  region: "asia-southeast1", // 部署到新加坡区域
}, async (req, res) => {
  logger.info('手动触发房间清理...');
  
  const now = Date.now();
  const roomsRef = db.collection(getRoomsCollectionPath());
  
  try {
    const roomsSnapshot = await roomsRef.get();
    const results = {
      totalRooms: roomsSnapshot.size,
      deletedRooms: 0,
      activeRooms: 0,
      roomDetails: [] as any[]
    };
    
    const deletePromises: Promise<any>[] = [];
    
    roomsSnapshot.forEach((doc) => {
      const room = doc.data() as GameRoom;
      const roomId = doc.id;
      const host = room.players.find(p => p.id === room.hostId);
      
      const roomInfo = {
        id: roomId,
        hostId: room.hostId,
        playerCount: room.players.length,
        status: room.status,
        hostHeartbeat: host?.lastHeartbeat,
        shouldDelete: false,
        reason: ''
      };
      
      if (!host) {
        roomInfo.shouldDelete = true;
        roomInfo.reason = '房主不存在';
        deletePromises.push(doc.ref.delete());
      } else if (host.lastHeartbeat) {
        const timeSinceLastHeartbeat = now - host.lastHeartbeat;
        roomInfo.reason = `房主心跳: ${Math.floor(timeSinceLastHeartbeat / 1000)}秒前`;
        
        if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
          roomInfo.shouldDelete = true;
          deletePromises.push(doc.ref.delete());
        }
      } else {
        // 如果没有心跳时间戳，检查房间创建时间
        // createdAt 可能是数字时间戳或 Firestore Timestamp
        let createdAtMillis = 0;
        if (room.createdAt) {
          if (typeof room.createdAt === 'number') {
            createdAtMillis = room.createdAt;
          } else if (room.createdAt.toMillis) {
            createdAtMillis = room.createdAt.toMillis();
          }
        }
        const roomAge = now - createdAtMillis;
        
        roomInfo.reason = `房间年龄: ${Math.floor(roomAge / 1000)}秒`;
        
        if (roomAge > 10 * 60 * 1000) {
          roomInfo.shouldDelete = true;
          deletePromises.push(doc.ref.delete());
        }
      }
      
      if (roomInfo.shouldDelete) {
        results.deletedRooms++;
      } else {
        results.activeRooms++;
      }
      
      results.roomDetails.push(roomInfo);
    });
    
    await Promise.all(deletePromises);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error) {
    logger.error('手动清理房间时出错:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}); 