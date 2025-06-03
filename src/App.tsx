import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User, signInWithCustomToken } from 'firebase/auth'; // Added signInWithCustomToken
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, arrayUnion, collection, addDoc, serverTimestamp, DocumentData, Unsubscribe, query, where, getDocs, deleteDoc, writeBatch, setLogLevel, getDoc } from 'firebase/firestore'; // Added getDoc and setLogLevel
import { SketchPicker, ColorResult } from 'react-color';
import { Pen as LucidePen, Eraser as LucideEraser, Trash2 as LucideTrash2, Palette as LucidePalette, Play as LucidePlay, Users as LucideUsers, Plus as LucidePlus, LogIn as LucideLogIn, Eye as LucideEye, MessageSquare as LucideMessageSquare, Send as LucideSend, Crown as LucideCrown, Clock as LucideClock, Paintbrush as LucidePaintbrush, HelpCircle as LucideHelpCircle, Settings as LucideSettings, BarChart as LucideBarChart, UserCircle as LucideUserCircle, Copy as LucideCopy } from 'lucide-react';

// Firebase 配置 (从全局变量获取)
const firebaseConfig = {
    apiKey: "AIzaSyA3LmtV41fMB4hZjfrR4z70oEqh7Xq4KTc",
    authDomain: "taptap-ugc-1.firebaseapp.com",
    projectId: "taptap-ugc-1",
    storageBucket: "taptap-ugc-1.firebasestorage.app",
    messagingSenderId: "624067597389",
    appId: "1:624067597389:web:0dadf33d960e0365a4f804"
  };

// App ID (从全局变量获取)
const appId = firebaseConfig.appId;

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
// setLogLevel('debug'); //取消注释以获取详细的 Firestore 日志

// --- Firestore 路径构造函数 ---
const getRoomsCollectionPath = () => `artifacts/${appId}/public/data/draw_guess_rooms`;
const getRoomDocPath = (roomId: string) => `artifacts/${appId}/public/data/draw_guess_rooms/${roomId}`;


// --- 类型定义 ---
interface Point {
  x: number;
  y: number;
}

interface Path {
  id: string;
  points: Point[];
  color: string;
  width: number;
}

interface Player {
  id: string;
  name: string;
  score: number;
  isDrawer?: boolean;
  isHost?: boolean;
  lastHeartbeat?: number; // 新增：最后心跳时间戳
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: any; // Firestore Timestamp
  isCorrectGuess?: boolean;
}

interface GameRoom {
  id: string;
  name: string;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  currentWord: string;
  wordHint: string;
  currentDrawerId: string | null;
  timeLeft: number;
  currentRound: number;
  maxRounds: number;
  drawingPaths: Path[];
  chatMessages: ChatMessage[];
  status: 'waiting' | 'playing' | 'round_end' | 'game_end';
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: any;
  wordCategory: string;
  guessedPlayerIds: string[];
  usedWords: string[];
  wordLength: number;
}

// --- 颜色常量 (根据设计文档) ---
const COLORS = {
  primary: '#6366F1', // 紫蓝色
  accentOrange: '#F59E0B', // 橙色
  accentGreen: '#10B981', // 绿色
  backgroundLight: '#F3F4F6', // 浅灰
  backgroundWhite: '#FFFFFF', // 白色
  textDark: '#1F2937',
  textLight: '#6B7280',
};

// --- 词库 (示例) ---
const WORD_BANK = {
  easy: [
    {word: "苹果", category: "水果"}, 
    {word: "猫", category: "动物"}, 
    {word: "太阳", category: "自然"}, 
    {word: "书", category: "物品"},
    {word: "狗", category: "动物"},
    {word: "香蕉", category: "水果"},
    {word: "月亮", category: "自然"},
    {word: "花", category: "植物"},
    {word: "鱼", category: "动物"},
    {word: "树", category: "植物"},
    {word: "星星", category: "自然"},
    {word: "球", category: "物品"},
    {word: "鸟", category: "动物"},
    {word: "云", category: "自然"},
    {word: "车", category: "交通工具"},
    {word: "房子", category: "建筑"},
  ],
  medium: [
    {word: "自行车", category: "交通工具"}, 
    {word: "吉他", category: "乐器"}, 
    {word: "大象", category: "动物"}, 
    {word: "电脑", category: "电子产品"},
    {word: "飞机", category: "交通工具"},
    {word: "钢琴", category: "乐器"},
    {word: "熊猫", category: "动物"},
    {word: "手机", category: "电子产品"},
    {word: "火车", category: "交通工具"},
    {word: "小提琴", category: "乐器"},
    {word: "长颈鹿", category: "动物"},
    {word: "相机", category: "电子产品"},
    {word: "轮船", category: "交通工具"},
    {word: "鼓", category: "乐器"},
    {word: "老虎", category: "动物"},
    {word: "眼镜", category: "物品"},
  ],
  hard: [
    {word: "蒙娜丽莎", category: "艺术"}, 
    {word: "望远镜", category: "科学"}, 
    {word: "过山车", category: "娱乐"}, 
    {word: "万里长城", category: "地标"},
    {word: "自由女神像", category: "地标"},
    {word: "显微镜", category: "科学"},
    {word: "摩天轮", category: "娱乐"},
    {word: "埃菲尔铁塔", category: "地标"},
    {word: "宇航员", category: "职业"},
    {word: "金字塔", category: "地标"},
    {word: "恐龙", category: "历史"},
    {word: "海盗船", category: "娱乐"},
    {word: "天安门", category: "地标"},
    {word: "机器人", category: "科技"},
    {word: "旋转木马", category: "娱乐"},
    {word: "兵马俑", category: "历史"},
  ],
};

// --- 工具函数 ---
const getRandomInt = (max: number): number => {
  const timestamp = Date.now();
  const randomValue = (timestamp * 9301 + 49297) % 233280;
  return Math.floor((randomValue / 233280) * max);
};

// 改进的洗牌算法 (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const getWordHint = (word: string): string => {
  if (!word) return "";
  // 不再显示部分字母，只返回下划线
  return word.split('').map(char => char === ' ' ? ' ' : '_').join('');
};


// --- 组件 ---

// 消息提示框
const AlertModal: React.FC<{ message: string; onClose: () => void; type?: 'success' | 'error' | 'info' }> = ({ message, onClose, type = 'info' }) => {
  if (!message) return null;

  let bgColor = 'bg-blue-500';
  if (type === 'success') bgColor = 'bg-green-500';
  if (type === 'error') bgColor = 'bg-red-500';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`p-6 rounded-lg shadow-xl text-white ${bgColor} max-w-sm w-full`}>
        <p className="text-lg mb-4">{message}</p>
        <button
          onClick={onClose}
          className="w-full bg-white text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-200 transition duration-150"
        >
          关闭
        </button>
      </div>
    </div>
  );
};

// 加载指示器
const LoadingSpinner: React.FC<{ text?: string }> = ({ text = "加载中..." }) => (
  <div className="flex flex-col items-center justify-center h-full">
    <svg className="animate-spin h-10 w-10 text-indigo-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <p className="text-indigo-600">{text}</p>
  </div>
);


// 画板组件
const DrawingBoard: React.FC<{
  paths: Path[];
  onDraw: (path: Path) => void;
  currentColor: string;
  currentWidth: number;
  isDrawingDisabled: boolean;
  onClear: () => void;
  currentTool: 'pen' | 'eraser';
}> = ({ paths, onDraw, currentColor, currentWidth, isDrawingDisabled, onClear, currentTool }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPainting, setIsPainting] = useState(false);
  const [currentPathPoints, setCurrentPathPoints] = useState<Point[]>([]); // Renamed to avoid conflict

  const getCoordinates = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point | null => {
    if (!canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('clientX' in event) {
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    } else if (event.touches && event.touches.length > 0) {
      x = event.touches[0].clientX - rect.left;
      y = event.touches[0].clientY - rect.top;
    } else {
      return null;
    }
    return { x, y };
  };

  const startPaint = useCallback((event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (isDrawingDisabled) return;
    const coords = getCoordinates(event);
    if (coords) {
      setIsPainting(true);
      setCurrentPathPoints([{ ...coords }]);
    }
  }, [isDrawingDisabled]);

  const paint = useCallback((event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isPainting || isDrawingDisabled) return;
    const coords = getCoordinates(event);
    if (coords) {
      setCurrentPathPoints(prev => [...prev, { ...coords }]);
    }
    event.preventDefault(); // Prevent scrolling on touch devices
  }, [isPainting, isDrawingDisabled]);

  const endPaint = useCallback(() => {
    if (!isPainting || isDrawingDisabled) return;
    setIsPainting(false);
    if (currentPathPoints.length > 1) {
      onDraw({
        id: crypto.randomUUID(),
        points: currentPathPoints,
        color: currentTool === 'eraser' ? COLORS.backgroundWhite : currentColor,
        width: currentTool === 'eraser' ? 20 : currentWidth,
      });
    }
    setCurrentPathPoints([]);
  }, [isPainting, isDrawingDisabled, currentPathPoints, currentColor, currentWidth, onDraw, currentTool]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Native event handlers for addEventListener
    const handleNativeMouseDown = (event: MouseEvent) => {
      if (isDrawingDisabled) return;
      const rect = canvas.getBoundingClientRect();
      const coords = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      setIsPainting(true);
      setCurrentPathPoints([{ ...coords }]);
    };

    const handleNativeMouseMove = (event: MouseEvent) => {
      if (!isPainting || isDrawingDisabled) return;
      const rect = canvas.getBoundingClientRect();
      const coords = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      setCurrentPathPoints(prev => [...prev, { ...coords }]);
    };

    const handleNativeTouchStart = (event: TouchEvent) => {
      if (isDrawingDisabled || !event.touches.length) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const coords = { 
        x: event.touches[0].clientX - rect.left, 
        y: event.touches[0].clientY - rect.top 
      };
      setIsPainting(true);
      setCurrentPathPoints([{ ...coords }]);
    };

    const handleNativeTouchMove = (event: TouchEvent) => {
      if (!isPainting || isDrawingDisabled || !event.touches.length) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const coords = { 
        x: event.touches[0].clientX - rect.left, 
        y: event.touches[0].clientY - rect.top 
      };
      setCurrentPathPoints(prev => [...prev, { ...coords }]);
    };

    const resizeCanvas = () => {
        const parent = canvas.parentElement;
        if (parent) {
            const rect = parent.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            
            // 设置实际的画布大小（考虑设备像素比）
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            
            // 设置CSS大小
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            
            // 缩放上下文以匹配设备像素比
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.scale(dpr, dpr);
            }
            
            drawAllPathsOnCanvas(); 
        }
    };

    const drawAllPathsOnCanvas = () => { // Renamed to avoid conflict
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr); 
        ctx.fillStyle = COLORS.backgroundWhite;
        ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

        paths.forEach(path => drawSinglePath(ctx, path)); // Renamed to avoid conflict
        if (isPainting && currentPathPoints.length > 0) {
            drawSinglePath(ctx, { // Renamed to avoid conflict
                id: 'current',
                points: currentPathPoints,
                color: currentTool === 'eraser' ? COLORS.backgroundWhite : currentColor,
                width: currentTool === 'eraser' ? 20 : currentWidth,
            });
        }
    };
    
    const drawSinglePath = (ctx: CanvasRenderingContext2D, path: Path) => { // Renamed to avoid conflict
        if (path.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    };
    
    resizeCanvas();
    drawAllPathsOnCanvas();

    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousedown', handleNativeMouseDown);
    canvas.addEventListener('mousemove', handleNativeMouseMove);
    canvas.addEventListener('mouseup', endPaint);
    canvas.addEventListener('mouseleave', endPaint); 

    canvas.addEventListener('touchstart', handleNativeTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
    canvas.addEventListener('touchend', endPaint);
    canvas.addEventListener('touchcancel', endPaint);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousedown', handleNativeMouseDown);
      canvas.removeEventListener('mousemove', handleNativeMouseMove);
      canvas.removeEventListener('mouseup', endPaint);
      canvas.removeEventListener('mouseleave', endPaint);
      canvas.removeEventListener('touchstart', handleNativeTouchStart);
      canvas.removeEventListener('touchmove', handleNativeTouchMove);
      canvas.removeEventListener('touchend', endPaint);
      canvas.removeEventListener('touchcancel', endPaint);
    };
  }, [paths, currentColor, currentWidth, currentTool, isPainting, currentPathPoints, isDrawingDisabled, endPaint]);


  return (
    <div className="w-full h-full bg-white rounded-lg shadow-md relative overflow-hidden">
      <canvas
        ref={canvasRef}
        onMouseDown={startPaint}
        onMouseMove={paint}
        onMouseUp={endPaint}
        onMouseLeave={endPaint}
        onTouchStart={startPaint}
        onTouchMove={paint}
        onTouchEnd={endPaint}
        className="w-full h-full cursor-crosshair block"
        style={{ touchAction: 'none' }}
      />
      {isDrawingDisabled && (
        <div className="absolute inset-0 bg-gray-200 bg-opacity-50 flex items-center justify-center pointer-events-none">
          <p className="text-gray-600 font-semibold">
            {currentTool === 'eraser' ? '橡皮擦模式' : '等待游戏开始...'}
          </p>
        </div>
      )}
    </div>
  );
};

// 工具栏组件
const ToolBar: React.FC<{
  color: string;
  setColor: (color: string) => void;
  width: number;
  setWidth: (width: number) => void;
  onClear: () => void;
  canClear: boolean;
  currentTool: 'pen' | 'eraser';
  setTool: (tool: 'pen' | 'eraser') => void;
}> = ({ color, setColor, width, setWidth, onClear, canClear, currentTool, setTool }) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const brushSizes = [2, 5, 10, 15, 20];

  return (
    <div className={`bg-gray-100 p-2 rounded-lg shadow flex flex-wrap items-center justify-center gap-2 md:gap-3 ${canClear ? '' : 'opacity-50 pointer-events-none'}`}>
      <button
        title="画笔"
        onClick={() => setTool('pen')}
        className={`p-2 rounded-md hover:bg-gray-300 transition-colors ${currentTool === 'pen' ? 'bg-primary text-white' : 'bg-white'}`}
      >
        <LucidePaintbrush size={20} />
      </button>
      <button
        title="橡皮擦"
        onClick={() => setTool('eraser')}
        className={`p-2 rounded-md hover:bg-gray-300 transition-colors ${currentTool === 'eraser' ? 'bg-primary text-white' : 'bg-white'}`}
      >
        <LucideEraser size={20} />
      </button>
      
      <div className="relative">
        <button
          title="颜色"
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="p-2 rounded-md bg-white hover:bg-gray-300 transition-colors"
        >
          <LucidePalette size={20} style={{ color: currentTool === 'pen' ? color : '#000' }} />
        </button>
        {showColorPicker && (
          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 z-10 p-2 bg-white rounded-lg shadow-lg">
            <SketchPicker
              color={color}
              onChangeComplete={(newColor: ColorResult) => setColor(newColor.hex)}
              disableAlpha
              presetColors={[COLORS.primary, COLORS.accentOrange, COLORS.accentGreen, '#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#000000', '#FFFFFF']}
            />
             <button onClick={() => setShowColorPicker(false)} className="mt-2 w-full bg-gray-200 text-sm py-1 rounded">关闭</button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 bg-white p-1 rounded-md">
        <span className="text-xs px-1 text-gray-600">粗细:</span>
        {brushSizes.map(size => (
          <button
            key={size}
            title={`画笔粗细 ${size}px`}
            onClick={() => setWidth(size)}
            className={`w-6 h-6 rounded-full hover:bg-gray-300 flex items-center justify-center transition-all
                        ${width === size && currentTool === 'pen' ? 'bg-primary ring-2 ring-offset-1 ring-primary' : 'bg-gray-200'}`}
          >
            <div className="bg-black rounded-full" style={{ width: `${size * 0.8}px`, height: `${size * 0.8}px`, opacity: currentTool === 'pen' ? 1 : 0.3 }}></div>
          </button>
        ))}
      </div>
      
      <button
        title="清空画板"
        onClick={onClear}
        className="p-2 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
      >
        <LucideTrash2 size={20} />
      </button>
    </div>
  );
};

// 玩家列表组件
const PlayerList: React.FC<{ players: Player[]; currentPlayerId: string | null; currentDrawerId: string | null }> = ({ players, currentPlayerId, currentDrawerId }) => (
  <div className="bg-white p-3 rounded-lg shadow-md h-full overflow-y-auto">
    <h3 className="text-lg font-semibold mb-2 text-primary">玩家列表 ({players.length})</h3>
    <ul>
      {players.map(player => (
        <li key={player.id} className={`flex items-center justify-between p-2 rounded-md mb-1 ${player.id === currentPlayerId ? 'bg-indigo-100' : ''}`}>
          <div className="flex items-center">
            {player.id === currentDrawerId && <LucidePaintbrush size={16} className="mr-2 text-accentOrange" />}
            {player.isHost && <LucideCrown size={16} className="mr-2 text-yellow-500" />}
            <span className="font-medium text-gray-700 truncate max-w-[100px] sm:max-w-[150px]">{player.name} {player.id === currentPlayerId ? "(你)" : ""}</span>
          </div>
          <span className="font-semibold text-primary">{player.score} 分</span>
        </li>
      ))}
    </ul>
  </div>
);

// 聊天框组件
const ChatBox: React.FC<{
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentPlayerId: string | null;
  currentDrawerId: string | null;
}> = ({ messages, onSendMessage, currentPlayerId, currentDrawerId }) => {
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isGuesser = currentPlayerId !== null && currentPlayerId !== currentDrawerId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim() && isGuesser) {
      onSendMessage(messageText.trim());
      setMessageText('');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="bg-white p-3 rounded-lg shadow-md h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-2 text-primary">聊天/猜测</h3>
      <div className="flex-grow overflow-y-auto mb-2 pr-1 space-y-2">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.senderId === currentPlayerId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-2 rounded-lg ${
              msg.isCorrectGuess 
                ? 'bg-accentGreen text-white' 
                : msg.senderId === currentPlayerId 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-200 text-gray-800'
            }`}>
              <span className="text-xs font-semibold block">{msg.senderName}{msg.senderId === currentPlayerId ? " (你)" : ""}</span>
              <p className="text-sm break-words">{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={messageText}
          onChange={e => setMessageText(e.target.value)}
          placeholder={isGuesser ? "输入你的猜测..." : "你是画手，不能猜测"}
          disabled={!isGuesser}
          className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
        />
        <button
          type="submit"
          disabled={!isGuesser || !messageText.trim()}
          className="p-2 rounded-md text-white bg-primary hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
        >
          <LucideSend size={20} />
        </button>
      </form>
    </div>
  );
};

// 游戏信息栏
const GameInfoBar: React.FC<{
  currentWord: string;
  wordHint: string;
  timeLeft: number;
  currentRound: number;
  maxRounds: number;
  isDrawer: boolean;
  wordCategory: string;
  wordLength: number;
}> = ({ currentWord, wordHint, timeLeft, currentRound, maxRounds, isDrawer, wordCategory, wordLength }) => {
  return (
    <div className="bg-white p-3 rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-center gap-2 text-textDark">
      <div className="text-center sm:text-left">
        {isDrawer ? (
          <>
            <p className="text-sm text-gray-500">词汇 ({wordCategory})</p>
            <p className="text-xl font-bold">
              {currentWord}
            </p>
          </>
        ) : (
          wordLength > 0 && (
            <p className="text-lg text-gray-700">
              {wordLength} 个字
            </p>
          )
        )}
      </div>
      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
        timeLeft <= 10 
          ? 'bg-red-100 border-2 border-red-500 shadow-lg animate-pulse-fast' 
          : timeLeft <= 30 
            ? 'bg-yellow-50 border border-yellow-400' 
            : ''
      }`}>
        <LucideClock size={timeLeft <= 10 ? 24 : 20} className={`${
          timeLeft <= 10 ? 'text-red-600' : timeLeft <= 30 ? 'text-yellow-600' : 'text-primary'
        }`} />
        <span className={`font-bold transition-all ${
          timeLeft <= 5 
            ? 'text-3xl text-red-600 animate-bounce' 
            : timeLeft <= 10 
              ? 'text-2xl text-red-600' 
              : timeLeft <= 30 
                ? 'text-xl text-yellow-600' 
                : 'text-lg text-gray-700'
        }`}>
          {timeLeft}
          <span className="text-sm ml-1">秒</span>
        </span>
      </div>
      <div className="text-sm text-gray-500">
        回合: <span className="font-semibold">{currentRound}/{maxRounds}</span>
      </div>
    </div>
  );
};

// 词汇选择模态框
const WordChoiceModal: React.FC<{
  difficulty: 'easy' | 'medium' | 'hard';
  onSelectWord: (word: string, category: string) => void;
  onCancel: () => void;
  usedWords: string[];
}> = ({ difficulty, onSelectWord, onCancel, usedWords }) => {
  const [wordsToChoose, setWordsToChoose] = useState<{word: string, category: string}[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    // 只在第一次渲染时生成词汇
    if (!hasInitialized) {
      const bank = WORD_BANK[difficulty] || WORD_BANK.easy;
      const availableWords = bank.filter(item => !usedWords || !usedWords.includes(item.word));
      
      if (availableWords.length < 3) {
        // 如果可用词汇不足，重置已用词汇
        const shuffled = shuffleArray(bank);
        setWordsToChoose(shuffled.slice(0, 3));
      } else {
        const shuffled = shuffleArray(availableWords);
        setWordsToChoose(shuffled.slice(0, 3));
      }
      setHasInitialized(true);
    }
  }, [difficulty, usedWords, hasInitialized]);

  if (wordsToChoose.length === 0) return <LoadingSpinner text="正在生成词汇..."/>;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md text-textDark">
        <h2 className="text-2xl font-bold mb-4 text-center text-primary">选择一个词汇开始绘画</h2>
        <div className="space-y-3">
          {wordsToChoose.map(({word, category}) => (
            <button
              key={word}
              onClick={() => onSelectWord(word, category)}
              className="w-full p-3 rounded-md text-lg font-semibold border-2 border-primary hover:bg-primary hover:text-white transition-colors"
            >
              {word} <span className="text-sm text-gray-500">({category})</span>
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          className="mt-6 w-full p-2 rounded-md bg-gray-300 hover:bg-gray-400 transition-colors"
        >
          随机选择 (或跳过)
        </button>
      </div>
    </div>
  );
};

// 成功提示组件
const SuccessModal: React.FC<{ 
  playerName: string; 
  onClose: () => void;
  word: string;
}> = ({ playerName, onClose, word }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 cursor-pointer"
      onClick={onClose}
    >
      <div className="bg-white p-8 rounded-2xl shadow-2xl transform animate-bounce">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-accentGreen mb-2">猜对了！</h2>
          <p className="text-xl text-gray-700">{playerName} 猜出了</p>
          <p className="text-2xl font-bold text-primary mt-2">"{word}"</p>
        </div>
      </div>
    </div>
  );
};

// 礼花效果组件
const Confetti: React.FC<{ show: boolean }> = ({ show }) => {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    color: string;
    size: number;
    delay: number;
    duration: number;
  }>>([]);

  useEffect(() => {
    if (!show) {
      setParticles([]);
      return;
    }

    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#FF1493'];
    const newParticles = [];
    
    // 减少粒子数量到30个
    for (let i = 0; i < 30; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100, // 使用百分比
        y: 100, // 从底部开始
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 4,
        delay: Math.random() * 0.5, // 动画延迟
        duration: 2 + Math.random() * 2, // 动画持续时间
      });
    }
    
    setParticles(newParticles);

    // 5秒后清除粒子
    const timeout = setTimeout(() => {
      setParticles([]);
    }, 5000);

    return () => {
      clearTimeout(timeout);
    };
  }, [show]);

  if (!show || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute rounded-full animate-confetti"
          style={{
            left: `${particle.x}%`,
            bottom: '0',
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        />
      ))}
    </div>
  );
};

// 游戏结束/回合结束总结
const SummaryModal: React.FC<{
  title: string;
  players: Player[];
  onNextRound?: () => void;
  onNewGame?: () => void;
  isGameEnd: boolean;
  currentUserId: string | null;
  isHost: boolean;
  onExitRoom?: () => void;
}> = ({ title, players, onNextRound, onNewGame, isGameEnd, currentUserId, isHost, onExitRoom }) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg text-textDark transform scale-100 animate-fade-in">
        <h2 className="text-3xl font-bold mb-6 text-center text-primary">{title}</h2>
        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
          {sortedPlayers.map((player, index) => (
            <div key={player.id} className={`flex justify-between items-center p-3 rounded-md transition-all duration-300 ${
              index === 0 ? 'bg-accentOrange text-white transform scale-105' : 
              index === 1 ? 'bg-indigo-200' : 
              index === 2 ? 'bg-indigo-100' : 'bg-gray-100'
            }`}>
              <span className="font-semibold text-lg">
                {index + 1}. {player.name} {player.id === currentUserId ? "(你)" : ""}
                {index === 0 && <LucideCrown className="inline ml-2 text-yellow-300 animate-pulse" />}
              </span>
              <span className="font-bold text-xl">{player.score} 分</span>
            </div>
          ))}
        </div>
        
        {/* 游戏结束时的操作区域 */}
        {isGameEnd ? (
          <div className="space-y-3">
            {isHost ? (
              <>
                <button
                  onClick={onNewGame}
                  className="w-full p-3 rounded-md text-white bg-primary hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 text-lg font-semibold"
                >
                  再来一局!
                </button>
                <button
                  onClick={onExitRoom}
                  className="w-full p-3 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 transition-all duration-300 text-lg font-semibold"
                >
                  返回大厅
                </button>
              </>
            ) : (
              <>
                <p className="text-center text-gray-600 mb-3">等待房主决定是否再来一局...</p>
                <button
                  onClick={onExitRoom}
                  className="w-full p-3 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 transition-all duration-300 text-lg font-semibold"
                >
                  返回大厅
                </button>
              </>
            )}
          </div>
        ) : (
          // 回合结束时的操作区域
          <>
            {isHost && onNextRound && (
              <button
                onClick={onNextRound}
                className="w-full p-3 rounded-md text-white bg-accentGreen hover:bg-green-700 transition-all duration-300 transform hover:scale-105 text-lg font-semibold"
              >
                开始下一回合
              </button>
            )}
            {!isHost && <p className="text-center text-gray-600">等待房主开始下一回合...</p>}
          </>
        )}
      </div>
    </div>
  );
};


// 游戏房间主组件
const GameRoomScreen: React.FC<{ roomId: string; userId: string; user: User | null; onExitRoom: () => void; initialPlayerName: string; }> = ({ roomId, userId, user, onExitRoom, initialPlayerName }) => {
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentWidth, setCurrentWidth] = useState(5);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');

  const [showWordChoice, setShowWordChoice] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  
  // 新增状态：成功提示和结算画面
  const [showSuccessModal, setShowSuccessModal] = useState<{playerName: string, word: string} | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [pendingSummary, setPendingSummary] = useState(false);

  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null); // 新增：心跳定时器

  const isDrawer = gameRoom?.currentDrawerId === userId;
  const isHost = gameRoom?.hostId === userId;

  // 新增：心跳更新函数
  const updateHeartbeat = useCallback(async () => {
    if (!gameRoom || !userId) return;
    
    const roomDocPath = getRoomDocPath(roomId);
    const roomDocRef = doc(db, roomDocPath);
    
    try {
      const updatedPlayers = gameRoom.players.map(p => 
        p.id === userId 
          ? { ...p, lastHeartbeat: Date.now() }
          : p
      );
      
      await updateDoc(roomDocRef, { players: updatedPlayers });
    } catch (err) {
      console.error("Error updating heartbeat:", err);
    }
  }, [gameRoom, userId, roomId]);

  // 新增：心跳定时器effect
  useEffect(() => {
    // 每30秒更新一次心跳
    if (gameRoom && userId) {
      updateHeartbeat(); // 立即更新一次
      heartbeatTimerRef.current = setInterval(updateHeartbeat, 30000);
    }
    
    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, [updateHeartbeat, gameRoom, userId]);

  // Firestore listener for game room updates
  useEffect(() => {
    const roomDocPath = getRoomDocPath(roomId);
    const roomDocRef = doc(db, roomDocPath);
    const unsubscribe = onSnapshot(roomDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const roomData = docSnap.data() as GameRoom;
        const prevStatus = gameRoom?.status;
        setGameRoom(roomData);
        
        if (roomData.currentDrawerId === userId && !roomData.currentWord && roomData.status === 'playing') {
          setShowWordChoice(true);
        } else {
          setShowWordChoice(false);
        }

        // 检测游戏状态变化到结束
        if (prevStatus === 'playing' && (roomData.status === 'round_end' || roomData.status === 'game_end')) {
            if (gameTimerRef.current) clearInterval(gameTimerRef.current);
            // 如果有成功提示正在显示，等待它结束后再显示结算
            if (showSuccessModal) {
              setPendingSummary(true);
            } else {
              setShowSummaryModal(true);
            }
        }
        
        // 当状态从结束状态变回playing时（新回合开始），重置显示状态
        if ((prevStatus === 'round_end' || prevStatus === 'game_end') && roomData.status === 'playing') {
          setShowSummaryModal(false);
          setPendingSummary(false);
        }

        setLoading(false);
      } else {
        setError("房间不存在或已被删除。");
        setLoading(false);
        onExitRoom(); 
      }
    }, (err) => {
      console.error("Error fetching room:", err);
      setError("无法加载房间数据。");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, userId, onExitRoom, gameRoom?.status, showSuccessModal]);

  // Player joining logic
  useEffect(() => {
    if (!userId || !gameRoom || gameRoom.players.find(p => p.id === userId)) return;

    const joinRoom = async () => {
      const roomDocPath = getRoomDocPath(roomId);
      const roomDocRef = doc(db, roomDocPath);
      const newPlayer: Player = { 
        id: userId, 
        name: initialPlayerName || `玩家${userId.substring(0,4)}`, 
        score: 0, 
        isHost: gameRoom.players.length === 0,
        lastHeartbeat: Date.now() // 新增：初始化心跳时间
      };
      try {
        await updateDoc(roomDocRef, {
          players: arrayUnion(newPlayer)
        });
      } catch (err) {
        console.error("Error joining room:", err);
        setAlertMessage("加入房间失败。");
      }
    };
    if (gameRoom.status === 'waiting' && gameRoom.players.length < gameRoom.maxPlayers) {
        joinRoom();
    } else if (gameRoom.players.length >= gameRoom.maxPlayers && !gameRoom.players.find(p => p.id === userId)) {
        setAlertMessage("房间已满！");
        onExitRoom();
    }

  }, [userId, gameRoom, roomId, initialPlayerName, onExitRoom]);

  // Game Timer Logic (Host driven)
  useEffect(() => {
    if (!gameRoom || gameRoom.status !== 'playing' || !isHost) {
        if (gameTimerRef.current) clearInterval(gameTimerRef.current);
        return;
    }
    
    if (gameRoom.timeLeft <= 0) { 
        if (gameTimerRef.current) clearInterval(gameTimerRef.current);
        const roomDocPath = getRoomDocPath(roomId);
        const roomDocRef = doc(db, roomDocPath);
        updateDoc(roomDocRef, { status: 'round_end', timeLeft: 0 })
            .catch(err => console.error("Error ending round on time up:", err));
        return;
    }

    gameTimerRef.current = setInterval(async () => {
        const roomDocPath = getRoomDocPath(roomId);
        const roomDocRef = doc(db, roomDocPath);
        try {
            const currentRoomSnapshot = await getDoc(roomDocRef);
            if (currentRoomSnapshot.exists()) {
                const currentRoomData = currentRoomSnapshot.data() as GameRoom;
                if (currentRoomData.status === 'playing' && currentRoomData.timeLeft > 0) {
                    await updateDoc(roomDocRef, { timeLeft: currentRoomData.timeLeft - 1 });
                } else if (currentRoomData.timeLeft <= 0 && currentRoomData.status === 'playing') {
                    await updateDoc(roomDocRef, { status: 'round_end' });
                    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
                }
            }
        } catch (err) {
            console.error("Error updating time:", err);
        }
    }, 1000);

    return () => {
        if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    };
  }, [gameRoom, isHost, roomId]);


  const handleDraw = useCallback(async (path: Path) => {
    if (!gameRoom || !isDrawer) return;
    const roomDocPath = getRoomDocPath(roomId);
    const roomDocRef = doc(db, roomDocPath);
    try {
      await updateDoc(roomDocRef, {
        drawingPaths: arrayUnion(path)
      });
    } catch (err) {
      console.error("Error saving draw path:", err);
      setAlertMessage("保存绘画时出错。");
    }
  }, [gameRoom, isDrawer, roomId]);

  const handleClearDrawing = useCallback(async () => {
    if (!gameRoom || !isDrawer) return;
    const roomDocPath = getRoomDocPath(roomId);
    const roomDocRef = doc(db, roomDocPath);
    try {
      await updateDoc(roomDocRef, {
        drawingPaths: []
      });
    } catch (err) {
      console.error("Error clearing drawing:", err);
      setAlertMessage("清空画板时出错。");
    }
  }, [gameRoom, isDrawer, roomId]);

  const handleSendMessage = async (text: string) => {
    if (!gameRoom || !userId || !user) return;
    const roomDocPath = getRoomDocPath(roomId);
    const roomDocRef = doc(db, roomDocPath);
    const currentPlayer = gameRoom.players.find(p => p.id === userId);
    if (!currentPlayer) return;

    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: userId,
      senderName: currentPlayer.name,
      text: text,
      timestamp: Date.now(),
      isCorrectGuess: false,
    };

    let updates: Partial<GameRoom> = { chatMessages: arrayUnion(newMessage) as any };
    let newScore = currentPlayer.score;

    if (gameRoom.currentWord && text.toLowerCase() === gameRoom.currentWord.toLowerCase() && userId !== gameRoom.currentDrawerId && !gameRoom.guessedPlayerIds.includes(userId)) {
      newMessage.isCorrectGuess = true;
      
      const baseScore = 100;
      const orderBonus = Math.max(0, 50 - gameRoom.guessedPlayerIds.length * 20); 
      newScore += baseScore + orderBonus;

      updates.players = gameRoom.players.map(p => 
        p.id === userId ? { ...p, score: newScore } : p
      );
      updates.guessedPlayerIds = arrayUnion(userId) as any;

      if (gameRoom.currentDrawerId) {
        const drawerPoints = 10; 
        updates.players = updates.players!.map(p => 
          p.id === gameRoom.currentDrawerId ? { ...p, score: (p.score || 0) + drawerPoints } : p
        );
      }
      
      // 显示成功提示
      setShowSuccessModal({ playerName: currentPlayer.name, word: gameRoom.currentWord });

      const guessers = gameRoom.players.filter(p => p.id !== gameRoom.currentDrawerId);
      // Ensure guessedPlayerIds is treated as an array for length check
      const currentGuessedCount = Array.isArray(updates.guessedPlayerIds) ? (updates.guessedPlayerIds as string[]).length : (gameRoom.guessedPlayerIds.includes(userId) ? gameRoom.guessedPlayerIds.length : gameRoom.guessedPlayerIds.length + 1) ;

      if (currentGuessedCount >= guessers.length) {
        updates.status = 'round_end';
      }
    }

    try {
      await updateDoc(roomDocRef, updates);
    } catch (err) {
      console.error("Error sending message:", err);
      setAlertMessage("发送消息失败。");
    }
  };

  const handleStartGame = async () => {
    if (!gameRoom || !isHost || gameRoom.players.length < 2) {
      setAlertMessage(gameRoom && gameRoom.players.length < 2 ? "至少需要2名玩家才能开始游戏。" : "只有房主可以开始游戏。");
      return;
    }
    const roomDocPath = getRoomDocPath(roomId);
    const roomDocRef = doc(db, roomDocPath);
    const firstDrawerIndex = getRandomInt(gameRoom.players.length);
    const firstDrawer = gameRoom.players[firstDrawerIndex];
    try {
      await updateDoc(roomDocRef, {
        status: 'playing',
        currentRound: 1,
        currentDrawerId: firstDrawer.id,
        currentWord: '', 
        wordHint: '',
        wordLength: 0,
        timeLeft: 60,  // 改为60秒
        drawingPaths: [],
        chatMessages: arrayUnion({
            id: crypto.randomUUID(),
            senderId: 'system',
            senderName: '系统',
            text: `游戏开始！${firstDrawer.name} 是第一个画手。`,
            timestamp: Date.now(),
        }) as any,
        guessedPlayerIds: [],
        usedWords: gameRoom.usedWords || [],
      });
    } catch (err) {
      console.error("Error starting game:", err);
      setAlertMessage("开始游戏失败。");
    }
  };

  const handleWordSelection = async (word: string, category: string) => {
    if (!gameRoom || !isDrawer) return;
    const roomDocPath = getRoomDocPath(roomId);
    const roomDocRef = doc(db, roomDocPath);
    setShowWordChoice(false);
    
    const wordLength = word.replace(/\s/g, '').length;
    
    try {
      await updateDoc(roomDocRef, {
        currentWord: word,
        wordCategory: category,
        wordHint: getWordHint(word),
        wordLength: wordLength,
        timeLeft: 60,  // 统一改为60秒，不再根据难度区分
        chatMessages: arrayUnion({
            id: crypto.randomUUID(),
            senderId: 'system',
            senderName: '系统',
            text: `${gameRoom.players.find(p=>p.id === gameRoom.currentDrawerId)?.name} 已选择词汇，开始绘画！`,
            timestamp: Date.now(),
        }) as any,
        usedWords: arrayUnion(word) as any,
      });
    } catch (err) {
      console.error("Error selecting word:", err);
      setAlertMessage("选择词汇失败。");
    }
  };

  const handleNextRound = async () => {
    if (!gameRoom || !isHost) return;
    const roomDocPath = getRoomDocPath(roomId);
    const roomDocRef = doc(db, roomDocPath);
    
    if (gameRoom.currentRound >= gameRoom.maxRounds) { 
      try {
        await updateDoc(roomDocRef, { status: 'game_end' });
      } catch (err) {
        console.error("Error ending game:", err);
      }
      return;
    }

    const currentPlayerIndex = gameRoom.players.findIndex(p => p.id === gameRoom.currentDrawerId);
    const nextDrawerIndex = (currentPlayerIndex + 1) % gameRoom.players.length;
    const nextDrawer = gameRoom.players[nextDrawerIndex];

    try {
      await updateDoc(roomDocRef, {
        status: 'playing',
        currentRound: gameRoom.currentRound + 1,
        currentDrawerId: nextDrawer.id,
        currentWord: '',
        wordHint: '',
        wordLength: 0,
        timeLeft: 60,  // 统一改为60秒，不再根据难度区分
        drawingPaths: [],
        chatMessages: arrayUnion({
            id: crypto.randomUUID(),
            senderId: 'system',
            senderName: '系统',
            text: `第 ${gameRoom.currentRound + 1} 回合开始！现在由 ${nextDrawer.name} 来画。`,
            timestamp: Date.now(),
        }) as any,
        guessedPlayerIds: [],
      });
    } catch (err) {
      console.error("Error starting next round:", err);
      setAlertMessage("开始下一回合失败。");
    }
  };
  
  const handleNewGame = async () => {
    if (!gameRoom || !isHost) return;
    const roomDocPath = getRoomDocPath(roomId);
    const roomDocRef = doc(db, roomDocPath);
    try {
        const newPlayersState = gameRoom.players.map(p => ({...p, score: 0})); 
        await updateDoc(roomDocRef, {
            status: 'waiting',
            currentWord: '',
            wordHint: '',
            wordLength: 0,
            currentDrawerId: null,
            timeLeft: 0,
            currentRound: 0,
            drawingPaths: [],
            chatMessages: arrayUnion({
                id: crypto.randomUUID(),
                senderId: 'system',
                senderName: '系统',
                text: `新的一局游戏已由房主 ${gameRoom.players.find(p=>p.id === gameRoom.hostId)?.name} 创建！等待开始...`,
                timestamp: Date.now(),
            }) as any,
            guessedPlayerIds: [],
            usedWords: [],
            players: newPlayersState,
        });
    } catch (err) {
        console.error("Error starting new game:", err);
        setAlertMessage("创建新游戏失败。");
    }
  };

  // 处理成功提示关闭
  const handleSuccessModalClose = () => {
    setShowSuccessModal(null);
    // 如果有待显示的结算画面，显示它
    if (pendingSummary) {
      setPendingSummary(false);
      setShowSummaryModal(true);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-100"><LoadingSpinner text="正在进入房间..." /></div>;
  if (error || !gameRoom) return <div className="p-4 text-red-500 text-center">{error || "无法加载房间信息。"} <button onClick={onExitRoom} className="text-blue-500 underline">返回大厅</button></div>;

  return (
    <div className="flex flex-col h-screen p-2 sm:p-4 bg-gray-100" style={{ backgroundColor: COLORS.backgroundLight }}>
      <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
      
      {/* 游戏胜利礼花效果 */}
      <Confetti show={gameRoom.status === 'game_end' && showSummaryModal} />
      
      {/* 成功提示 */}
      {showSuccessModal && (
        <SuccessModal 
          playerName={showSuccessModal.playerName}
          word={showSuccessModal.word}
          onClose={handleSuccessModalClose}
        />
      )}
      
      {showWordChoice && isDrawer && gameRoom.status === 'playing' && (
        <WordChoiceModal
          difficulty={gameRoom.difficulty}
          onSelectWord={handleWordSelection}
          onCancel={() => { 
            const bank = WORD_BANK[gameRoom.difficulty] || WORD_BANK.easy;
            const availableWords = bank.filter(item => !gameRoom.usedWords.includes(item.word));
            const wordsToUse = availableWords.length > 0 ? availableWords : bank;
            const randomIndex = getRandomInt(wordsToUse.length);
            const randomWord = wordsToUse[randomIndex];
            handleWordSelection(randomWord.word, randomWord.category);
          }}
          usedWords={gameRoom.usedWords || []}
        />
      )}

      {showSummaryModal && (gameRoom.status === 'round_end' || gameRoom.status === 'game_end') && (
        <SummaryModal
          title={gameRoom.status === 'round_end' ? `第 ${gameRoom.currentRound} 回合结束!` : "游戏结束!"}
          players={gameRoom.players}
          onNextRound={isHost ? () => {
            setShowSummaryModal(false);
            handleNextRound();
          } : undefined}
          onNewGame={isHost ? () => {
            setShowSummaryModal(false);
            handleNewGame();
          } : undefined}
          isGameEnd={gameRoom.status === 'game_end'}
          currentUserId={userId}
          isHost={isHost}
          onExitRoom={onExitRoom}
        />
      )}

      <header className="mb-2 sm:mb-4 flex justify-between items-center">
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: COLORS.primary }}>画笔传说 - {gameRoom.name}</h1>
        <button
          onClick={onExitRoom}
          className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
        >
          退出房间
        </button>
      </header>

      {gameRoom.status === 'waiting' && (
        <div className="flex-grow flex flex-col items-center justify-center bg-white rounded-lg shadow-xl p-6">
          <h2 className="text-2xl font-semibold mb-4">等待玩家加入... ({gameRoom.players.length}/{gameRoom.maxPlayers})</h2>
          <p className="text-gray-600 mb-2">房间ID: {roomId} <button onClick={() => {
              navigator.clipboard.writeText(roomId)
                .then(() => setAlertMessage("房间ID已复制!"))
                .catch(err => setAlertMessage("复制失败!"));
            }} className="ml-2 text-sm text-indigo-500 hover:underline"><LucideCopy size={14} className="inline"/> 复制</button></p>
          <p className="mb-6">当前玩家: {gameRoom.players.map(p => p.name).join(', ')}</p>
          {isHost && gameRoom.players.length >= 1 && ( 
            <button
              onClick={handleStartGame}
              className="px-8 py-3 text-lg font-semibold text-white rounded-lg transition-colors bg-accentGreen hover:bg-green-700"
            >
              <LucidePlay className="inline mr-2" /> 开始游戏
            </button>
          )}
          {!isHost && <p className="text-gray-700">等待房主开始游戏...</p>}
           <p className="mt-4 text-sm text-gray-500">你是: {gameRoom.players.find(p=>p.id === userId)?.name || initialPlayerName}</p>
        </div>
      )}

      {gameRoom.status !== 'waiting' && (
        <>
          <GameInfoBar
            currentWord={isDrawer && gameRoom.status === 'playing' ? gameRoom.currentWord : ''}
            wordHint={gameRoom.wordHint}
            timeLeft={gameRoom.timeLeft}
            currentRound={gameRoom.currentRound}
            maxRounds={gameRoom.maxRounds}
            isDrawer={isDrawer}
            wordCategory={gameRoom.wordCategory}
            wordLength={gameRoom.wordLength || 0}
          />

          {/* 手机端竖屏布局 */}
          <main className="flex-grow flex flex-col lg:hidden gap-1 overflow-hidden">
            {/* 画布区域 - 手机端占据主要空间 */}
            <div className="flex-grow min-h-0 bg-gray-100 rounded-lg overflow-hidden">
              <DrawingBoard
                paths={gameRoom.drawingPaths}
                onDraw={handleDraw}
                currentColor={currentColor}
                currentWidth={currentWidth}
                isDrawingDisabled={!isDrawer || showWordChoice || gameRoom.status !== 'playing'}
                onClear={handleClearDrawing}
                currentTool={currentTool}
              />
            </div>
            {isDrawer && gameRoom.status === 'playing' && !showWordChoice && (
              <div className="shrink-0">
                <ToolBar
                  color={currentColor}
                  setColor={setCurrentColor}
                  width={currentWidth}
                  setWidth={setCurrentWidth}
                  onClear={handleClearDrawing}
                  canClear={isDrawer && gameRoom.status === 'playing' && !showWordChoice}
                  currentTool={currentTool}
                  setTool={setCurrentTool}
                />
              </div>
            )}
            
            {/* 聊天区域 - 手机端高度更小 */}
            <div className="h-[140px] sm:h-[160px] shrink-0">
              <ChatBox
                messages={gameRoom.chatMessages}
                onSendMessage={handleSendMessage}
                currentPlayerId={userId}
                currentDrawerId={gameRoom.currentDrawerId}
              />
            </div>
            
            {/* 玩家列表 - 手机端水平滚动，高度更小 */}
            <div className="h-[60px] shrink-0 overflow-x-auto">
              <div className="bg-white p-1 rounded-lg shadow-md h-full">
                <div className="flex gap-2 h-full items-center px-1">
                  {gameRoom.players.map(player => (
                    <div key={player.id} className={`flex flex-col items-center justify-center px-2 py-1 rounded-md whitespace-nowrap ${player.id === userId ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                      <div className="flex items-center">
                        {player.id === gameRoom.currentDrawerId && <LucidePaintbrush size={12} className="mr-1 text-accentOrange" />}
                        {player.isHost && <LucideCrown size={12} className="mr-1 text-yellow-500" />}
                        <span className="text-xs font-medium">{player.name}</span>
                      </div>
                      <span className="text-xs text-primary font-semibold">{player.score}分</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>

          {/* 桌面端布局 - 保持原样 */}
          <main className="hidden lg:grid flex-grow grid-cols-4 gap-2 sm:gap-4 mt-2 sm:mt-4 overflow-hidden">
            <div className="col-span-1 h-full min-h-[200px]">
              <PlayerList players={gameRoom.players} currentPlayerId={userId} currentDrawerId={gameRoom.currentDrawerId} />
            </div>

            <div className="col-span-2 h-full flex flex-col">
              <div className="flex-grow relative">
                <DrawingBoard
                  paths={gameRoom.drawingPaths}
                  onDraw={handleDraw}
                  currentColor={currentColor}
                  currentWidth={currentWidth}
                  isDrawingDisabled={!isDrawer || showWordChoice || gameRoom.status !== 'playing'}
                  onClear={handleClearDrawing}
                  currentTool={currentTool}
                />
              </div>
              {isDrawer && gameRoom.status === 'playing' && !showWordChoice && (
                <div className="mt-2">
                  <ToolBar
                    color={currentColor}
                    setColor={setCurrentColor}
                    width={currentWidth}
                    setWidth={setCurrentWidth}
                    onClear={handleClearDrawing}
                    canClear={isDrawer && gameRoom.status === 'playing' && !showWordChoice}
                    currentTool={currentTool}
                    setTool={setCurrentTool}
                  />
                </div>
              )}
            </div>

            <div className="col-span-1 h-full min-h-[200px]">
              <ChatBox
                messages={gameRoom.chatMessages}
                onSendMessage={handleSendMessage}
                currentPlayerId={userId}
                currentDrawerId={gameRoom.currentDrawerId}
              />
            </div>
          </main>
        </>
      )}
    </div>
  );
};


// 大厅界面组件
const LobbyScreen: React.FC<{
  userId: string | null;
  onJoinRoom: (roomId: string, playerName: string) => void;
  onCreateRoom: (roomName: string, playerName: string, maxPlayers: number, difficulty: 'easy' | 'medium' | 'hard', maxRounds: number) => Promise<string | null>;
  user: User | null;
}> = ({ userId, onJoinRoom, onCreateRoom, user }) => {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [playerName, setPlayerName] = useState(user?.displayName || `玩家${userId ? userId.substring(0,4) : Math.random().toString(36).substring(2,6)}`);
  const [alertMessage, setAlertMessage] = useState('');

  // Fetch available rooms
  useEffect(() => {
    if (!userId) { // Ensure userId is available before querying
        setLoadingRooms(false);
        return;
    }
    const roomsCollectionPath = getRoomsCollectionPath();
    const roomsCollectionRef = collection(db, roomsCollectionPath);
    const q = query(roomsCollectionRef, where("status", "==", "waiting"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedRooms: GameRoom[] = [];
      querySnapshot.forEach((doc) => {
        fetchedRooms.push({ id: doc.id, ...doc.data() } as GameRoom);
      });
      setRooms(fetchedRooms);
      setLoadingRooms(false);
    }, (error) => {
      console.error("Error fetching rooms: ", error);
      setAlertMessage("获取房间列表失败。请检查 Firestore 安全规则和路径。");
      setLoadingRooms(false);
    });

    return () => unsubscribe();
  }, [userId]); // Add userId as a dependency
  
  const handleCreateRoom = async (roomName: string, maxPlayers: number, difficulty: 'easy' | 'medium' | 'hard', maxRounds: number) => {
    if (!playerName.trim()) {
        setAlertMessage("请输入你的昵称。");
        return;
    }
    const newRoomId = await onCreateRoom(roomName, playerName, maxPlayers, difficulty, maxRounds);
    if (newRoomId) {
      setShowCreateRoomModal(false);
      onJoinRoom(newRoomId, playerName); 
    } else {
      setAlertMessage("创建房间失败。");
    }
  };

  const handleJoinRoom = () => {
    if (!joinRoomId.trim()) {
      setAlertMessage("请输入房间ID。");
      return;
    }
    if (!playerName.trim()) {
        setAlertMessage("请输入你的昵称。");
        return;
    }
    onJoinRoom(joinRoomId.trim(), playerName);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4 sm:p-8 flex flex-col items-center">
       <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
      <header className="text-center mb-8 sm:mb-12 animate-fade-in">
        <h1 className="text-5xl sm:text-6xl font-bold text-white drop-shadow-lg animate-bounce">画笔传说</h1>
        <p className="text-xl text-indigo-100 mt-2">你画我猜，欢乐无限！</p>
      </header>

      {userId ? (
        <div className="w-full max-w-3xl bg-white p-6 sm:p-8 rounded-xl shadow-2xl animate-fade-in">
          <div className="mb-6">
            <label htmlFor="playerName" className="block text-sm font-medium text-gray-700 mb-1">你的昵称:</label>
            <input
              type="text"
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="例如：绘画小天才"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-300"
            />
          </div>
        
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <button
              onClick={() => setShowCreateRoomModal(true)}
              className="w-full py-4 px-6 text-lg font-semibold text-white rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105 bg-primary hover:bg-indigo-700 duration-300"
            >
              <LucidePlus className="inline mr-2" /> 创建房间
            </button>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                placeholder="输入房间ID加入"
                className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-300"
              />
              <button
                onClick={handleJoinRoom}
                disabled={!joinRoomId.trim()}
                className="py-3 px-5 text-lg font-semibold text-white rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105 bg-accentOrange hover:bg-orange-600 disabled:bg-gray-400 disabled:transform-none disabled:shadow-none duration-300"
              >
                <LucideLogIn className="inline mr-1 sm:mr-2" /> 加入
              </button>
            </div>
          </div>

          <h2 className="text-2xl font-semibold mb-4 text-gray-800">公开房间列表</h2>
          {loadingRooms ? (
            <LoadingSpinner text="正在加载房间列表..." />
          ) : rooms.length === 0 ? (
            <p className="text-gray-600 text-center py-4 animate-pulse">目前没有公开的房间，快去创建一个吧！</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {rooms.map((room, index) => (
                <div 
                  key={room.id} 
                  className="bg-gray-50 p-4 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 transition-all duration-300 hover:shadow-md hover:bg-gray-100 transform hover:-translate-y-1"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div>
                    <h3 className="text-lg font-semibold text-indigo-700">{room.name}</h3>
                    <p className="text-sm text-gray-500">
                      房主: {room.players.find(p => p.id === room.hostId)?.name || '未知'} | 
                      难度: { {easy: '简单', medium: '中等', hard: '困难'}[room.difficulty] } |
                      回合: {room.maxRounds}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                     <p className="text-sm text-gray-600 font-medium whitespace-nowrap bg-indigo-100 px-2 py-1 rounded-full self-start sm:self-center">
                        <LucideUsers size={16} className="inline mr-1" /> {room.players.length}/{room.maxPlayers}
                     </p>
                    <button
                      onClick={() => {
                        if (!playerName.trim()) { setAlertMessage("请输入你的昵称才能加入房间。"); return; }
                        onJoinRoom(room.id, playerName);
                      }}
                      className="w-full sm:w-auto py-2 px-4 font-semibold text-white rounded-md shadow hover:shadow-md transition-all duration-300 bg-accentGreen hover:bg-green-700 transform hover:scale-105"
                    >
                      <LucidePlay className="inline mr-1" /> 加入
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="animate-fade-in">
          <LoadingSpinner text="正在连接..." />
        </div>
      )}

      {showCreateRoomModal && (
        <CreateRoomModal
          onClose={() => setShowCreateRoomModal(false)}
          onCreate={handleCreateRoom}
        />
      )}
       <footer className="mt-auto pt-8 text-center text-indigo-200 text-sm animate-fade-in">
            <p>当前用户ID: {userId || "未登录"}</p>
            <p>App ID: {appId}</p>
            <p>&copy; {new Date().getFullYear()} 画笔传说. </p>
        </footer>
    </div>
  );
};

// 创建房间模态框
const CreateRoomModal: React.FC<{
  onClose: () => void;
  onCreate: (roomName: string, maxPlayers: number, difficulty: 'easy' | 'medium' | 'hard', maxRounds: number) => void;
}> = ({ onClose, onCreate }) => {
  const [roomName, setRoomName] = useState(`欢乐绘画房 ${getRandomInt(10000)}`);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [maxRounds, setMaxRounds] = useState(5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    onCreate(roomName.trim(), maxPlayers, difficulty, maxRounds);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md animate-bounce-once">
        <h2 className="text-2xl font-bold mb-6 text-center text-primary">创建新房间</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-1">房间名称:</label>
            <input
              type="text"
              id="roomName"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-700 mb-1">最大玩家数 (2-8):</label>
            <input
              type="number"
              id="maxPlayers"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Math.max(2, Math.min(8, parseInt(e.target.value))))}
              min="2"
              max="8"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-1">词汇难度:</label>
            <select 
              id="difficulty" 
              value={difficulty} 
              onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">困难</option>
            </select>
          </div>
          <div>
            <label htmlFor="maxRounds" className="block text-sm font-medium text-gray-700 mb-1">总回合数 (1-10):</label>
            <input
              type="number"
              id="maxRounds"
              value={maxRounds}
              onChange={(e) => setMaxRounds(Math.max(1, Math.min(10, parseInt(e.target.value))))}
              min="1"
              max="10"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 text-white rounded-md transition-colors bg-primary hover:bg-indigo-700"
            >
              创建房间
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// 主应用组件
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'lobby' | 'room'>('lobby');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentPlayerName, setCurrentPlayerName] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setUserId(firebaseUser.uid);
        setIsAuthReady(true);
        console.log("User is signed in:", firebaseUser.uid);
      } else {
        // Try to sign in with custom token or anonymously
        // @ts-ignore
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        if (initialAuthToken) {
          try {
            console.log("Attempting to sign in with custom token...");
            const userCredential = await signInWithCustomToken(auth, initialAuthToken);
            setUser(userCredential.user);
            setUserId(userCredential.user.uid);
            console.log("Signed in with custom token:", userCredential.user.uid);
          } catch (error) {
            console.error("Error signing in with custom token, falling back to anonymous:", error);
            try {
              console.log("Attempting to sign in anonymously...");
              const userCredential = await signInAnonymously(auth);
              setUser(userCredential.user);
              setUserId(userCredential.user.uid);
              console.log("Signed in anonymously:", userCredential.user.uid);
            } catch (anonError) {
              console.error("Error signing in anonymously:", anonError);
              setAlertMessage("匿名登录失败，部分功能可能受限。");
            }
          }
        } else {
          try {
            console.log("No custom token, attempting to sign in anonymously...");
            const userCredential = await signInAnonymously(auth);
            setUser(userCredential.user);
            setUserId(userCredential.user.uid);
            console.log("Signed in anonymously:", userCredential.user.uid);
          } catch (error) {
            console.error("Error signing in anonymously:", error);
            setAlertMessage("匿名登录失败，部分功能可能受限。");
          }
        }
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleCreateRoom = async (roomName: string, playerName: string, maxPlayers: number, difficulty: 'easy' | 'medium' | 'hard', maxRounds: number): Promise<string | null> => {
    if (!userId) {
      setAlertMessage("用户未登录，无法创建房间。");
      return null;
    }
    const hostPlayer: Player = { 
      id: userId, 
      name: playerName, 
      score: 0, 
      isHost: true,
      lastHeartbeat: Date.now() // 新增：初始化房主心跳
    };
    const newRoomData: Omit<GameRoom, 'id' | 'drawingPaths' | 'chatMessages' | 'guessedPlayerIds' | 'usedWords' | 'wordLength'> = {
      name: roomName,
      hostId: userId,
      players: [hostPlayer],
      maxPlayers: maxPlayers,
      currentWord: '',
      wordHint: '',
      currentDrawerId: null,
      timeLeft: 0,
      currentRound: 0,
      maxRounds: maxRounds,
      status: 'waiting',
      difficulty: difficulty,
      createdAt: Date.now(),
      wordCategory: '',
    };
    try {
      const roomsCollectionPath = getRoomsCollectionPath();
      const roomDocRef = await addDoc(collection(db, roomsCollectionPath), {
        ...newRoomData,
        drawingPaths: [], 
        chatMessages: [],
        guessedPlayerIds: [],
        usedWords: [],
        wordLength: 0,
      });
      setCurrentPlayerName(playerName);
      return roomDocRef.id;
    } catch (err) {
      console.error("Error creating room:", err);
      setAlertMessage("创建房间失败，请稍后再试。");
      return null;
    }
  };

  const handleJoinRoom = (roomId: string, playerName: string) => {
    if (!userId) {
      setAlertMessage("用户未登录，无法加入房间。");
      return;
    }
    setCurrentRoomId(roomId);
    setCurrentPlayerName(playerName);
    setCurrentScreen('room');
  };

  const handleExitRoom = async () => {
    if (userId && currentRoomId) {
        const roomDocPath = getRoomDocPath(currentRoomId);
        const roomDocRef = doc(db, roomDocPath);
        try {
            const roomSnap = await getDoc(roomDocRef); // Make sure getDoc is imported
            if (roomSnap.exists()) {
                let roomData = roomSnap.data() as GameRoom;
                const remainingPlayers = roomData.players.filter(p => p.id !== userId);

                if (remainingPlayers.length === 0) {
                    await deleteDoc(roomDocRef);
                    console.log(`Room ${currentRoomId} deleted as last player left.`);
                } else {
                    let updates: Partial<GameRoom> = { players: remainingPlayers };
                    if (roomData.hostId === userId && remainingPlayers.length > 0) {
                        updates.hostId = remainingPlayers[0].id;
                        updates.players = remainingPlayers.map((p, index) => ({
                            ...p,
                            isHost: index === 0 
                        }));
                        updates.chatMessages = arrayUnion({
                            id: crypto.randomUUID(),
                            senderId: 'system',
                            senderName: '系统',
                            text: `${roomData.players.find(p=>p.id === userId)?.name} (房主) 已离开房间。新房主是 ${remainingPlayers[0].name}。`,
                            timestamp: Date.now(),
                        }) as any;
                    }
                    await updateDoc(roomDocRef, updates);
                }
            }
        } catch (err) {
            console.error("Error updating room on player exit:", err);
        }
    }
    setCurrentRoomId(null);
    setCurrentScreen('lobby');
  };


  if (!isAuthReady) {
    return <div className="flex items-center justify-center h-screen bg-gray-100"><LoadingSpinner text="正在初始化应用..." /></div>;
  }

  return (
    <div className="font-sans antialiased">
      <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
      {currentScreen === 'lobby' && userId && (
        <LobbyScreen
          userId={userId}
          user={user}
          onJoinRoom={handleJoinRoom}
          onCreateRoom={handleCreateRoom}
        />
      )}
      {currentScreen === 'room' && currentRoomId && userId && (
        <GameRoomScreen
          roomId={currentRoomId}
          userId={userId}
          user={user}
          onExitRoom={handleExitRoom}
          initialPlayerName={currentPlayerName}
        />
      )}
       {!userId && isAuthReady && (
         <div className="flex flex-col items-center justify-center h-screen bg-gray-100 p-4 text-center">
            <LucideHelpCircle size={48} className="text-red-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">身份验证失败</h2>
            <p className="text-gray-700 mb-4">无法连接到游戏服务。请检查你的网络连接或Firebase配置，并刷新页面重试。</p>
            <p className="text-sm text-gray-500">如果问题持续，请联系应用管理员。确保 Firebase 控制台中已正确设置安全规则，并允许匿名或经过身份验证的用户访问 `artifacts/{appId}/public/data/draw_guess_rooms` 路径。</p>
         </div>
       )}
    </div>
  );
};

export default App;

