// AI助手功能
class AIAssistant {
    constructor(app) {
        this.app = app;
        this.isDialogOpen = false;
        this.currentConversation = [];
        this.settings = app.settings;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // AI对话框事件
        document.getElementById('closeAiDialog').addEventListener('click', () => {
            this.hideDialog();
        });
        
        document.getElementById('aiSendBtn').addEventListener('click', () => {
            this.sendMessage();
        });
        
        document.getElementById('aiClearBtn').addEventListener('click', () => {
            this.clearConversation();
        });
        
        document.getElementById('aiInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // 点击外部关闭对话框
        document.getElementById('aiDialog').addEventListener('click', (e) => {
            if (e.target.id === 'aiDialog') {
                this.hideDialog();
            }
        });
    }
    
    showDialog() {
        this.isDialogOpen = true;
        document.getElementById('aiDialog').classList.add('show');
        document.getElementById('aiInput').focus();
        this.updateStatus('idle');
    }
    
    hideDialog() {
        this.isDialogOpen = false;
        document.getElementById('aiDialog').classList.remove('show');
    }
    
    // 更新AI状态
    updateStatus(status) {
        const statusElement = document.getElementById('aiStatus');
        if (!statusElement) return;
        
        // 移除所有状态类
        statusElement.classList.remove('idle', 'working');
        
        if (status === 'working') {
            statusElement.textContent = '正在生成内容';
            statusElement.classList.add('working');
        } else {
            statusElement.textContent = '空闲';
            statusElement.classList.add('idle');
        }
    }
    
    async sendMessage() {
        const input = document.getElementById('aiInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        // 添加用户消息
        this.addMessage('user', message);
        input.value = '';
        
        // 更新状态为工作中
        this.updateStatus('working');
        
        // 显示加载指示器
        this.showTypingIndicator();
        
        try {
            // 获取当前编辑器内容作为上下文
            const context = this.getCurrentContext();
            
            // 使用流式传输发送到AI服务
            await this.streamAIResponse(message, context);
            
        } catch (error) {
            console.error('AI request failed:', error);
            this.hideTypingIndicator();
            this.addMessage('assistant', '抱歉，AI服务暂时不可用。请检查网络连接和AI服务配置。');
        } finally {
            // 恢复状态为空闲
            this.updateStatus('idle');
        }
    }
    
    // 流式AI响应
    async streamAIResponse(message, context) {
        try {
            // 隐藏输入指示器并添加助手消息
            this.hideTypingIndicator();
            const assistantMessageElement = this.addMessage('assistant', '');
            const contentDiv = assistantMessageElement?.querySelector('.message-content');
            
            if (!contentDiv) {
                console.error('Could not find message content div');
                this.addMessage('assistant', '界面错误，请重试。');
                return;
            }
            
            let fullContent = '';
            
            // 获取设置，确保有默认值
            const settings = this.app.storage.loadSettings();
            const aiProvider = settings.aiProvider || 'ollama';
            const ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';
            const ollamaModel = settings.ollamaModel || 'llama2';
            const openaiUrl = settings.openaiUrl || 'https://api.openai.com/v1';
            const openaiKey = settings.openaiKey || '';
            const openaiModel = settings.openaiModel || 'gpt-3.5-turbo';
            
            let response;
            
            if (aiProvider === 'ollama') {
                response = await fetch(`${ollamaUrl}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: ollamaModel,
                        messages: [
                            { role: 'system', content: this.buildSystemPrompt(context) },
                            { role: 'user', content: message }
                        ],
                        stream: true
                    })
                });
            } else if (aiProvider === 'openai') {
                response = await fetch(`${openaiUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openaiKey}`
                    },
                    body: JSON.stringify({
                        model: openaiModel,
                        messages: [
                            { role: 'system', content: this.buildSystemPrompt(context) },
                            { role: 'user', content: message }
                        ],
                        stream: true
                    })
                });
            } else if (aiProvider === 'custom') {
                const customUrl = settings.customUrl || openaiUrl;
                const customKey = settings.customKey || openaiKey;
                const customModel = settings.customModel || openaiModel;
                
                response = await fetch(`${customUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${customKey}`
                    },
                    body: JSON.stringify({
                        model: customModel,
                        messages: [
                            { role: 'system', content: this.buildSystemPrompt(context) },
                            { role: 'user', content: message }
                        ],
                        stream: true
                    })
                });
            } else {
                // 默认使用ollama
                response = await fetch(`${ollamaUrl}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: ollamaModel,
                        messages: [
                            { role: 'system', content: this.buildSystemPrompt(context) },
                            { role: 'user', content: message }
                        ],
                        stream: true
                    })
                });
            }
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            // 清空初始消息
            contentDiv.innerHTML = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                
                if (aiProvider === 'ollama') {
                    const lines = chunk.split('\n').filter(line => line.trim());
                    
                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line);
                            if (data.message && data.message.content) {
                                fullContent += data.message.content;
                                contentDiv.innerHTML = marked.parse(fullContent);
                                this.scrollToBottom();
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                } else if (aiProvider === 'openai' || aiProvider === 'custom') {
                    const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));
                    
                    for (const line of lines) {
                        const data = line.replace('data: ', '');
                        if (data === '[DONE]') break;
                        
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.choices && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                                fullContent += parsed.choices[0].delta.content;
                                contentDiv.innerHTML = marked.parse(fullContent);
                                this.scrollToBottom();
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
            
            // 处理代码高亮
            contentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightBlock(block);
            });
            
        } catch (error) {
            console.error('Stream AI response failed:', error);
            this.addMessage('assistant', '抱歉，AI服务出现错误。');
        } finally {
            this.hideTypingIndicator();
        }
    }
    
    // 滚动到底部
    scrollToBottom() {
        const chatContainer = document.getElementById('aiChat');
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }
    
    addMessage(type, content) {
        const chatContainer = document.getElementById('aiChat');
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${type}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (type === 'assistant') {
            // 支持Markdown渲染
            contentDiv.innerHTML = marked.parse(content);
            
            // 处理代码高亮
            contentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightBlock(block);
            });
        } else {
            contentDiv.textContent = content;
        }
        
        messageDiv.appendChild(contentDiv);
        chatContainer.appendChild(messageDiv);
        
        // 滚动到底部
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // 保存到对话历史
        this.currentConversation.push({ type, content });
        
        // 返回创建的消息元素
        return messageDiv;
    }
    
    clearConversation() {
        const chatContainer = document.getElementById('aiChat');
        // 保留系统消息
        const systemMessages = chatContainer.querySelectorAll('.ai-message.system');
        chatContainer.innerHTML = '';
        
        systemMessages.forEach(msg => {
            chatContainer.appendChild(msg);
        });
        
        this.currentConversation = [];
    }
    
    getCurrentContext() {
        const title = document.getElementById('entryTitle').value;
        const content = document.getElementById('markdownEditor').value;
        const selectedText = this.getSelectedText();
        
        return {
            title: title || '无标题',
            content: content || '',
            fullContent: content || '', // 完整日志内容
            selectedText: selectedText || '',
            currentDate: new Date().toLocaleDateString('zh-CN'),
            entryCount: this.app.entries.length,
            // 添加所有历史记录作为上下文
            allEntries: this.app.entries.map(entry => ({
                title: entry.title,
                date: entry.date,
                content: entry.content
            }))
        };
    }
    
    getSelectedText() {
        const editor = document.getElementById('markdownEditor');
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        
        if (start !== end) {
            return editor.value.substring(start, end);
        }
        
        return '';
    }
    
    async callAIService(message, context) {
        const { aiProvider } = this.settings;
        
        // 构建系统提示
        const systemPrompt = this.buildSystemPrompt(context);
        
        switch (aiProvider) {
            case 'ollama':
                return await this.callOllama(systemPrompt, message);
            case 'openai':
            case 'custom':
                return await this.callOpenAIAPI(systemPrompt, message);
            default:
                throw new Error('未配置AI服务');
        }
    }
    
    buildSystemPrompt(context) {
        let prompt = `你是ArtiMeow AI Life Logger的智能助手，专门帮助用户整理生活和工作记录。

当前上下文：
- 标题：${context.title}
- 当前日期：${context.currentDate}
- 总记录数：${context.entryCount}
- 当前内容：${context.fullContent}
${context.selectedText ? `- 选中文本：${context.selectedText}` : ''}`;

        // 如果有历史记录，添加到上下文中
        if (context.allEntries && context.allEntries.length > 0) {
            prompt += '\n\n历史记录摘要：\n';
            const recentEntries = context.allEntries.slice(0, 5); // 最近5条记录
            recentEntries.forEach(entry => {
                prompt += `- ${entry.date}: ${entry.title}\n  ${entry.content.substring(0, 200)}${entry.content.length > 200 ? '...' : ''}\n`;
            });
        }

        prompt += `

你的能力包括：
1. 整理和总结用户的工作记录
2. 制定工作计划和安排
3. 将想法转换为结构化内容
4. 创建Mermaid流程图和思维导图
5. 提供写作建议和优化

重要说明：当需要生成Mermaid图表时，必须使用完整的代码块格式：
\`\`\`mermaid
graph TD
    A[开始] --> B[处理]
    B --> C[结束]
\`\`\`

请用中文回复，保持专业和友好的语调。`;

        return prompt;
    }
    
    async callOllama(systemPrompt, userMessage) {
        const { ollamaUrl, ollamaModel } = this.settings;
        
        const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: ollamaModel,
                prompt: `${systemPrompt}\n\n用户问题：${userMessage}`,
                stream: false
            })
        });
        
        if (!response.ok) {
            throw new Error(`Ollama请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        return data.response;
    }
    
    async callOpenAIAPI(systemPrompt, userMessage) {
        const { openaiUrl, openaiKey, openaiModel, customUrl, customKey, customModel } = this.settings;
        const { aiProvider } = this.settings;
        
        const url = aiProvider === 'openai' ? openaiUrl : customUrl;
        const apiKey = aiProvider === 'openai' ? openaiKey : customKey;
        const model = aiProvider === 'openai' ? openaiModel : customModel;
        
        const response = await fetch(`${url}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    }
    
    showLoading(show) {
        const indicator = document.getElementById('loadingIndicator');
        if (show) {
            indicator.classList.add('show');
        } else {
            indicator.classList.remove('show');
        }
    }
    
    // 智能建议功能
    async generateSmartSuggestions(content) {
        if (!content.trim()) return [];
        
        try {
            const suggestions = [];
            
            // 分析内容类型并生成建议
            if (this.containsTaskKeywords(content)) {
                suggestions.push({
                    type: 'flowchart',
                    title: '创建任务流程图',
                    description: '将您的任务转换为可视化流程图'
                });
            }
            
            if (this.containsPlanKeywords(content)) {
                suggestions.push({
                    type: 'planning',
                    title: '优化计划结构',
                    description: '重新组织您的计划，使其更加清晰'
                });
            }
            
            if (content.length > 500) {
                suggestions.push({
                    type: 'summary',
                    title: '生成内容摘要',
                    description: '为您的长文档创建简洁的摘要'
                });
            }
            
            return suggestions;
        } catch (error) {
            console.error('生成智能建议失败:', error);
            return [];
        }
    }
    
    containsTaskKeywords(content) {
        const taskKeywords = ['任务', '步骤', '流程', '过程', '执行', '完成', '开始', '结束'];
        return taskKeywords.some(keyword => content.includes(keyword));
    }
    
    containsPlanKeywords(content) {
        const planKeywords = ['计划', '安排', '目标', '方案', '策略', '规划', '时间表'];
        return planKeywords.some(keyword => content.includes(keyword));
    }
    
    // 预设的AI助手功能
    async generateDailySummary() {
        const today = new Date().toISOString().split('T')[0];
        const todayEntries = this.app.entries.filter(entry => 
            entry.date.startsWith(today)
        );
        
        if (todayEntries.length === 0) {
            return '今天还没有记录。';
        }
        
        const content = todayEntries.map(entry => 
            `**${entry.title}**\n${entry.content}`
        ).join('\n\n');
        
        const prompt = `请为以下今日记录生成一个简洁的总结：\n\n${content}`;
        
        try {
            return await this.callAIService(prompt, { title: '今日总结', content, selectedText: '', currentDate: new Date().toLocaleDateString('zh-CN'), entryCount: todayEntries.length });
        } catch (error) {
            return '生成总结失败，请检查AI服务配置。';
        }
    }
    
    async generateWeeklyPlan() {
        const lastWeekEntries = this.getLastWeekEntries();
        const content = lastWeekEntries.map(entry => 
            `**${entry.title}** (${new Date(entry.date).toLocaleDateString('zh-CN')})\n${entry.content}`
        ).join('\n\n');
        
        const prompt = `基于以下上周的工作记录，请制定下周的工作计划：\n\n${content}`;
        
        try {
            return await this.callAIService(prompt, { title: '周计划', content, selectedText: '', currentDate: new Date().toLocaleDateString('zh-CN'), entryCount: lastWeekEntries.length });
        } catch (error) {
            return '生成计划失败，请检查AI服务配置。';
        }
    }
    
    getLastWeekEntries() {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        return this.app.entries.filter(entry => {
            const entryDate = new Date(entry.date);
            return entryDate >= oneWeekAgo;
        });
    }
    
    // 显示输入指示器
    showTypingIndicator() {
        this.hideTypingIndicator(); // 先移除可能存在的指示器
        
        const chatContainer = document.getElementById('aiChat');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-message typing';
        typingDiv.id = 'typingIndicator';
        
        typingDiv.innerHTML = `
            <div class="message-content">
                <span>AI正在思考</span>
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        
        chatContainer.appendChild(typingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    // 隐藏输入指示器
    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
}

// 导出到全局作用域
window.AIAssistant = AIAssistant;
