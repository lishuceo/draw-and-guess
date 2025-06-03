import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // 导入全局样式和 Tailwind CSS
import App from './App';
// import reportWebVitals from './reportWebVitals'; // 如果需要，可以取消注释

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 如果你想开始测量应用的性能，可以传递一个函数
// 来记录结果 (例如: reportWebVitals(console.log))
// 或者发送到一个分析端点。了解更多: https://bit.ly/CRA-vitals
// reportWebVitals();
