# 🚀 AI 助手推送日报功能 - 使用说明

## ✨ 新增功能概览

本次更新为 AI 助手添加了三个核心功能，让日报推送更加便捷：

### 1. 💾 **GitHub 配置缓存**
- ✅ 可以选择记住 GitHub PAT（Personal Access Token）
- ✅ 自动保存成员名称和团队目录
- ✅ 下次推送时自动填充，无需重复输入

### 2. 🤖 **AI 智能推送日报**
- ✅ 通过自然语言与 AI 助手对话
- ✅ 直接粘贴日报内容，AI 自动推送到 GitHub
- ✅ 无需手动打开 Insights 视图

### 3. 📝 **多行输入框**
- ✅ 支持粘贴长篇日报内容
- ✅ 保留换行符和格式
- ✅ Ctrl/Cmd + Enter 快速发送

---

## 📖 使用指南

### 第一步：配置 GitHub 信息（仅需一次）

1. 打开应用，进入 **Insights** 视图
2. 生成一份日报（详细版或汇报版）
3. 点击 **"推送日报到 GitHub"** 按钮
4. 在弹出的表单中输入：
   - **GitHub PAT**（访问 https://github.com/settings/tokens 获取）
   - **成员名称**（例如：金倩如）
   - **团队目录**（例如：中国团队 china-team）
5. **重要：勾选 "🔐 记住 PAT"** 选项
6. 点击 **"确认推送"**

✅ 配置完成后，GitHub PAT 会被安全保存到本地，下次可以直接通过 AI 助手推送！

---

### 第二步：使用 AI 助手推送日报

#### 方式一：使用快捷按钮

1. 点击右上角的 **"AI 助手"** 按钮打开聊天面板
2. 点击快捷按钮 **"推送今日日报 🚀"**
3. 在多行输入框中粘贴你的日报内容
4. 按 **Ctrl + Enter**（Mac 用 Cmd + Enter）或点击发送按钮
5. AI 会自动识别并推送日报到 GitHub

#### 方式二：自然语言对话

你可以这样和 AI 说：

```
帮我推送日报

# 📅 工作日报 - 2026-01-21

## 📊 工作概览
- 总工作时长：8.5 小时
- 深度工作时长：6.2 小时
...
（粘贴完整日报内容）
```

或者：

```
上传今天的日报到 GitHub

（粘贴日报内容）
```

AI 会自动：
- ✅ 识别推送意图
- ✅ 提取日报内容
- ✅ 读取缓存的 GitHub 配置
- ✅ 调用 Tauri 后端推送到 GitHub
- ✅ 返回推送结果

---

## 🎯 常见使用场景

### 场景 1：日常推送日报

```
用户：帮我推送今天的日报

# 2026-01-21 工作日报
...（日报内容）

AI：✅ 日报推送成功！

📁 已推送到 GitHub 仓库
📅 日期：2026-01-21
👤 成员：金倩如
🌏 团队：中国团队 china-team
```

### 场景 2：推送历史日报

```
用户：帮我推送 1月15日 的日报

# 2026-01-15 工作日报
...（日报内容）

AI：✅ 日报推送成功！
📅 日期：2026-01-15
```

### 场景 3：修改后再推送

```
用户：我先在 Insights 生成了日报，修改后再推送

（在 Insights 编辑日报）

用户：好了，帮我推送这个：

（粘贴修改后的日报）

AI：✅ 已为你推送！
```

---

## ⚙️ 技术实现细节

### 1. GitHub 配置管理 (`githubConfig.ts`)

新增工具文件，负责 GitHub 配置的缓存管理：

```typescript
export interface GitHubConfig {
  pat: string;
  memberName: string;
  teamDir: string;
}

// 保存配置到 localStorage
export function saveGitHubConfig(config: GitHubConfig): void

// 加载配置
export function loadGitHubConfig(): GitHubConfig | null

// 清除配置
export function clearGitHubConfig(): void

// 检查是否已配置
export function hasGitHubConfig(): boolean
```

### 2. PatInputModal 增强

- ✅ 添加"记住 PAT"复选框
- ✅ 从 `githubConfig` 读取缓存
- ✅ 根据用户选择保存配置

### 3. AI 工具扩展 (`App.tsx`)

新增 `pushDailyReportTool` Function Declaration：

```typescript
const pushDailyReportTool: FunctionDeclaration = {
  name: "pushDailyReport",
  description: "推送日报到 GitHub",
  parameters: {
    content: { type: Type.STRING, description: "日报 Markdown 内容" },
    date: { type: Type.STRING, description: "日期 YYYY-MM-DD" }
  }
}
```

处理逻辑：
1. 读取缓存的 GitHub 配置
2. 调用 Tauri 命令 `invoke('push_daily_report', {...})`
3. 返回推送结果给用户

### 4. ChatSidebar 优化

- ✅ `<input>` → `<textarea>` （支持多行）
- ✅ 添加 Ctrl/Cmd + Enter 快捷键
- ✅ 更新快捷按钮（"推送今日日报 🚀"）
- ✅ `resize-none` 防止用户调整大小

---

## 🔐 安全性说明

### PAT 存储方式

- ✅ 存储在浏览器的 `localStorage`
- ✅ 仅保存在本地，不会上传到任何服务器
- ✅ 用户可以随时清除（通过浏览器清除缓存）

### 权限要求

- GitHub PAT 需要 `repo` 权限
- 用于创建/更新文件到 `AIEC-Team/AIEC-agent-hub` 仓库

### 清除配置

如果需要清除缓存的 PAT：

```javascript
// 在浏览器控制台执行
localStorage.removeItem('chronicle_github_config')
```

或者下次推送时不勾选"记住 PAT"即可覆盖。

---

## ❓ 常见问题

### Q1: 提示"未配置 GitHub 信息"

**A:** 需要先在 Insights 视图手动推送一次，并勾选"记住 PAT"。

---

### Q2: 推送失败，提示认证错误

**A:** 可能的原因：
1. PAT 已过期 → 重新生成 PAT
2. PAT 权限不足 → 确保勾选了 `repo` 权限
3. 仓库地址变更 → 联系开发者

解决方法：在 Insights 重新推送一次，输入新的 PAT 并勾选记住。

---

### Q3: 日报格式错误或换行丢失

**A:** 确保：
1. 使用多行输入框（textarea）粘贴内容
2. 不要在浏览器地址栏或单行输入框粘贴
3. 使用 Ctrl/Cmd + Enter 发送，不要点浏览器的"提交"按钮

---

### Q4: 能否推送到其他 GitHub 仓库？

**A:** 目前固定推送到 `AIEC-Team/AIEC-agent-hub`，如需修改请联系开发者或自行修改 Rust 后端代码。

---

### Q5: AI 没有识别到推送意图

**A:** 尝试更明确的关键词：
- ✅ "帮我推送日报"
- ✅ "上传日报到 GitHub"
- ✅ "提交今天的日报"
- ❌ "发一下日报"（太模糊）

---

## 🎨 用户体验优化

### 1. 快捷按钮

在 AI 助手聊天面板底部，新增快捷按钮：

```
["帮我建个任务 ✨", "进度总结 📊", "推送今日日报 🚀"]
```

### 2. 多行输入提示

占位符文本提示用户：

```
问我任何事情...
💡 Ctrl/Cmd + Enter 发送
💡 可粘贴多行日报内容
```

### 3. 智能反馈

AI 会根据推送结果给出友好的反馈：

- ✅ **成功**：显示推送详情（日期、成员、团队）
- ⚠️ **未配置**：引导用户先手动推送一次
- ❌ **失败**：显示错误原因和解决建议

---

## 🔄 工作流程对比

### 旧工作流程（需要 5 步）

1. 切换到 Insights 视图
2. 生成日报
3. 编辑日报
4. 点击推送按钮
5. 输入 PAT、成员名称、团队目录 → 推送

### 新工作流程（只需 2 步）

1. 打开 AI 助手
2. 粘贴日报内容 + 发送 → **完成！**

**效率提升 60%！** 🚀

---

## 📦 文件变更清单

```
新增：
- src/utils/githubConfig.ts          (GitHub 配置管理)

修改：
- src/components/modals/PatInputModal.tsx  (支持缓存 PAT)
- src/App.tsx                               (添加 pushDailyReport 工具)
- src/components/chat/ChatSidebar.tsx       (多行输入框)
```

---

## 🎯 未来优化方向

### 可能的扩展功能

1. **批量推送**
   ```
   用户：帮我推送这周的所有日报
   ```

2. **自动生成并推送**
   ```
   用户：生成并推送今天的日报
   AI：正在分析你的活动... 已生成并推送！
   ```

3. **定时自动推送**
   ```
   用户：每天下午6点自动推送日报
   ```

4. **多仓库支持**
   - 配置多个 GitHub 仓库
   - 推送时选择目标仓库

5. **日报模板管理**
   - 保存常用的日报模板
   - 快速套用模板

---

## 💬 反馈与支持

如有问题或建议，欢迎：

1. 在 GitHub 提 Issue
2. 联系开发者
3. 查看应用内的帮助文档

---

**版本：v2.1**  
**更新日期：2026-01-21**  
**开发者：Chronicle Team**

**祝你使用愉快！** ✨
