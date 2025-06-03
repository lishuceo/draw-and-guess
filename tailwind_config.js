/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}", // 确保 Tailwind 扫描你的源文件
      "./public/index.html"
    ],
    theme: {
      extend: {
        colors: { // 根据你的设计文档定义颜色
          primary: '#6366F1', // 紫蓝色
          accentOrange: '#F59E0B', // 橙色
          accentGreen: '#10B981', // 绿色
          backgroundLight: '#F3F4F6', // 浅灰
          backgroundWhite: '#FFFFFF', // 白色
          textDark: '#1F2937',
          textLight: '#6B7280',
        }
      },
    },
    plugins: [],
  }
  