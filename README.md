# ArtiMeow AI Life Logger

**您的智能生活工作助理**

一个基于 Electron 的 AI 智能生活记录应用，帮助您记录、整理和规划日常工作与生活。

## ✨ 特性

- 🤖 **AI 智能助手** - 支持 Ollama 和 OpenAI API
- 📝 **Markdown 编辑** - 完整的 Markdown 支持
- 📊 **Mermaid 图表** - 智能流程图和思维导图
- 🎨 **精美界面** - 深色/浅色模式自动切换
- ⚡ **快捷操作** - 丰富的快捷键支持
- 📱 **响应式设计** - 适配不同屏幕尺寸
- 💾 **本地存储** - 数据安全可靠
- 🔄 **自动保存** - 不丢失任何想法

## 🚀 开始使用

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建应用

```bash
npm run build
```

### 打包分发

```bash
npm run dist
```

## 🎯 功能说明

### AI 助手功能

- **日常记录整理** - 自动整理您的工作记录
- **计划制定** - 智能生成工作计划和安排
- **内容优化** - 提供写作建议和结构优化
- **流程图生成** - 自动创建 Mermaid 流程图

### 编辑器功能

- **实时预览** - 支持编辑、预览、分屏模式
- **语法高亮** - 完整的代码语法高亮
- **自动保存** - 智能自动保存，防止数据丢失
- **搜索筛选** - 按日期、标题快速查找记录

### 主题系统

- **跟随系统** - 自动适配系统主题
- **手动切换** - 支持浅色/深色主题切换
- **动画效果** - 流畅的主题切换动画

## ⚙️ 配置说明

### AI 服务配置

#### Ollama (推荐本地部署)
```
地址: http://localhost:11434
模型: llama2, llama3, qwen 等
```

#### OpenAI API
```
地址: https://api.openai.com/v1
API Key: 您的 OpenAI API 密钥
模型: gpt-3.5-turbo, gpt-4 等
```

#### 自定义 API
支持任何兼容 OpenAI API 格式的服务

## 🔧 快捷键

- `Ctrl/Cmd + N` - 新建记录
- `Ctrl/Cmd + S` - 保存记录
- `Ctrl/Cmd + T` - 切换主题
- `Ctrl/Cmd + Enter` - 发送 AI 消息

## 📋 系统要求

- **操作系统**: Windows 10+, macOS 10.14+, Linux
- **Node.js**: 16.0+
- **内存**: 512MB+
- **存储**: 100MB+

## 🛠️ 技术栈

- **框架**: Electron
- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **编辑器**: Monaco Editor 风格的 Markdown 编辑器
- **图表**: Mermaid.js
- **AI 集成**: Ollama, OpenAI API
- **主题**: CSS 变量 + 媒体查询

## 📝 开发计划

- [ ] 数据导入导出功能
- [ ] 多语言支持
- [ ] 插件系统
- [ ] 云同步功能
- [ ] 移动端适配
- [ ] 更多 AI 模型支持

## 🐛 问题反馈

如果您在使用过程中遇到问题，请在 [GitHub Issues](https://github.com/B5-Software/ArtiMeow-AILifeLogger/issues) 中反馈。

## 📄 许可证

本项目采用 [B5-Software Free and Open Knowledge Public License Version 1.0-Permissive](LICENSE) 许可证。

## 👨‍💻 关于作者

**B5-Software** - 专注于开发高质量的开源软件

- GitHub: [@B5-Software](https://github.com/B5-Software)
- 项目主页: [ArtiMeow-AILifeLogger](https://github.com/B5-Software/ArtiMeow-AILifeLogger)

---

⭐ 如果这个项目对您有帮助，请给我们一个 Star！
