<div align="center">
  <h1>🤖 Screenpipe AI 任务管理助手</h1>
  <p>
    <strong>基于 Screenpipe 的本地 AI 记忆核心与任务管理工具</strong>
  </p>
  
  <!-- 🔴 请在此处拖拽上传您的演示视频文件 (.mp4 / .mov) -->
  <!-- 上传成功后，GitHub 会自动生成视频链接，请保留该链接 -->
  
  <p>
    <a href="#核心功能">核心功能</a> •
    <a href="#快速开始">快速开始</a> •
    <a href="#技术架构">技术架构</a> •
    <a href="#隐私说明">隐私说明</a>
  </p>
</div>

---
## 项目介绍视频

[【Chronicle，你的AI智能助手，帮你记录一天的电脑操作，智能分析潜在任务，周报日报再也不愁！-哔哩哔哩】 https://b23.tv/3N4zM4z]
欢迎大家给我一键三连！！多多支持！！
## 📖 项目介绍

**Screenpipe AI 任务管理助手** (原名 GeminiTask "Memory Core") 是一个智能的任务管理与工作分析平台。它集成了 **[Screenpipe](https://github.com/mediar-ai/screenpipe)**（开源屏幕/音频数据捕获工具）和 **Google Gemini AI**，旨在从"手动记录任务"进化为"自动感知工作"。

通过全天候记录您的屏幕活动（OCR文本、应用使用情况），AI 能够自动分析您的工作内容，生成任务建议、工作日报，并提供可视化的时间线回溯功能。所有数据均优先在本地处理，确保隐私安全。

## ✨ 核心功能

### 1. ⏳ 智能时间线 (Timeline)
*   **全天候回溯**: 自动记录并展示您一天的所有屏幕活动。
*   **可视化展示**: 每一小时的关键活动截图缩略图和 OCR 关键词。
*   **AI 分析**: 自动识别每个时间段的活动类型（工作、会议、摸鱼）。

### 2. 🤖 AI 任务建议 (Auto-Task Drafts)
*   **自动提取**: AI 分析过去 4 小时的屏幕数据，自动识别潜在的未完成任务。
*   **智能过滤**: 自动过滤娱乐应用（如 B站、Twitter）和非工作内容。
*   **一键添加**: 将识别出的任务一键添加到看板中。

### 3. 📊 自动化日报 (Auto-Reporting)
*   **一键生成**: 基于真实屏幕证据，一键生成 Markdown 格式的每日工作总结。
*   **结构化输出**: 自动分类为 "🚀 开发进度"、"💬 会议沟通"、"📚 调研阅读"。
*   **真实准确**: 告别凭记忆写周报的痛苦，数据来源真实可靠。

### 4. 📈 效率洞察 (Insights)
*   **工作习惯分析**: 分析代码编写、会议沟通、专注度等维度的时长。
*   **RPG 角色卡**: 根据您的行为数据生成趣味性的 "RPG 角色"（如 "暗夜代码法师"）。

## 🚀 快速开始

### 前置要求
*   **Node.js** (v18+)
*   **Rust** (用于 Tauri)
*   **[Screenpipe](https://github.com/mediar-ai/screenpipe)** (必须在本地运行)

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
复制 `.env.example`（如果没有则新建）到 `.env.local`，并填入您的 Gemini API Key：

```bash
# .env.local
VITE_GEMINI_API_KEY=your_google_gemini_api_key_here
```

### 3. 启动 Screenpipe
确保 Screenpipe 在后台运行（默认端口 3030）：
```bash
screenpipe
```

### 4. 运行应用
```bash
npm run tauri dev
```

## 🛠 技术架构

*   **前端框架**: React 19 + Vite + TypeScript
*   **桌面封装**: Tauri v2
*   **数据源**: Screenpipe Local API (localhost:3030)
*   **AI 模型**: Google Gemini 1.5 Flash
*   **UI 组件**: Tailwind CSS + Radix UI

## 🔒 隐私与安全

*   **本地优先**: 所有 Screenpipe 数据的读取和初步处理均在本地环境中进行。
*   **数据最小化**: 发送给 Gemini AI 的数据仅限于经过筛选的文本摘要，不会发送原始屏幕截图。
*   **用户控制**: 您可以随时断开 Screenpipe 连接或清空本地缓存。

---

## 💬 联系与支持

如果您觉得这个项目对您有帮助，欢迎请作者喝杯咖啡 ☕️，或者添加微信一起交流新功能！

<div align="center">
  <table>
    <tr>
      <td align="center" width="200">
        <img src="assets/wechat-friend.jpg" alt="添加微信好友" width="200" />
        <br />
        <strong>加好友交流</strong>
      </td>
      <td align="center" width="200">
        <img src="assets/wechat-pay.jpg" alt="微信赞赏" width="200" />
        <br />
        <strong>请我喝咖啡</strong>
      </td>
    </tr>
  </table>
</div>

---

<div align="center">
  Made with ❤️ by Jin Qianru
</div>
