// 主应用逻辑
class ArtiMeowApp {
    constructor() {
        this.currentEntry = null;
        this.entries = [];
        this.storage = new StorageManager();
        this.settings = this.storage.loadSettings();
        this.autoSaveTimer = null;
    this.entryContextTargetId = null; // 右键选中的记录ID
        
        this.initializeApp();
        this.setupEventListeners();
        this.loadEntries();
        this.updateCurrentDate();
    }
    
    initializeApp() {
        // 初始化编辑器元素
        this.editor = document.getElementById('markdownEditor');
        this.titleInput = document.getElementById('entryTitle');
        this.previewContent = document.getElementById('previewContent');
        this.entriesList = document.getElementById('entriesList');
        this.wordCount = document.getElementById('wordCount');
        this.entryDate = document.getElementById('entryDate');
        this.aiWorkspacePane = document.getElementById('aiWorkspacePane');
        this.aiWorkspaceOutput = document.getElementById('aiWorkspaceOutput');
        this.searchInput = document.getElementById('searchInput');
        this.entriesCount = document.getElementById('entriesCount');        // 初始化Mermaid
        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            themeVariables: {
                primaryColor: '#e91e63',
                primaryTextColor: '#ffffff',
                primaryBorderColor: '#c2185b',
                lineColor: '#e91e63',
                mainBkg: '#fff0f3',
                secondaryColor: '#fce4ec'
            }
        });
        
        // 初始化Marked配置
        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {}
                }
                return hljs.highlightAuto(code).value;
            },
            breaks: true,
            gfm: true
        });
        
        // 初始化AI助手
        this.aiAssistant = new AIAssistant(this);
        
        // 初始化Markdown工具栏
        this.initMarkdownToolbar();
        
        // 初始化外部链接处理
        this.initExternalLinkHandlers();
        
        // 默认切换到分屏模式
        setTimeout(() => {
            this.switchTab('split');
            // 设置默认日期为今天
            this.setDefaultDate();
        }, 100);
    }
    
    initMarkdownToolbar() {
        const toolbar = document.getElementById('markdownToolbar');
        if (!toolbar) return;
        
        toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('.toolbar-btn');
            if (!btn) return;
            
            const action = btn.dataset.action;
            this.handleToolbarAction(action);
        });
    }
    
    handleToolbarAction(action) {
        const editor = this.editor;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        const beforeText = editor.value.substring(0, start);
        const afterText = editor.value.substring(end);
        
        let newText = '';
        let newCursorPos = start;
        
        switch (action) {
            case 'bold':
                newText = `**${selectedText || '粗体文本'}**`;
                newCursorPos = start + (selectedText ? 2 : 2);
                break;
            case 'italic':
                newText = `*${selectedText || '斜体文本'}*`;
                newCursorPos = start + (selectedText ? 1 : 1);
                break;
                newText = `# ${selectedText || '标题1'}`;
                newCursorPos = start + 2;
                break;
            case 'h2':
                newText = `## ${selectedText || '标题2'}`;
                newCursorPos = start + 3;
                break;
            case 'h3':
                newText = `### ${selectedText || '标题3'}`;
                newCursorPos = start + 4;
                break;
            case 'ul':
                newText = `- ${selectedText || '列表项'}`;
                newCursorPos = start + 2;
                break;
            case 'ol':
                newText = `1. ${selectedText || '列表项'}`;
                newCursorPos = start + 3;
                break;
            case 'quote':
                newText = `> ${selectedText || '引用文本'}`;
                newCursorPos = start + 2;
                break;
            case 'code':
                newText = `\`${selectedText || '代码'}\``;
                newCursorPos = start + (selectedText ? 1 : 1);
                break;
            case 'codeblock':
                newText = `\`\`\`\n${selectedText || '代码块'}\n\`\`\``;
                newCursorPos = start + 4;
                break;
            case 'link':
                newText = `[${selectedText || '链接文本'}](URL)`;
                newCursorPos = start + (selectedText ? selectedText.length + 3 : 3);
                break;
            case 'image':
                newText = `![${selectedText || '图片描述'}](图片URL)`;
                newCursorPos = start + (selectedText ? selectedText.length + 4 : 4);
                break;
            case 'table':
                newText = `| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 数据1 | 数据2 | 数据3 |\n| 数据4 | 数据5 | 数据6 |`;
                newCursorPos = start + 2;
                break;
            case 'mermaid':
                newText = `\`\`\`mermaid\ngraph TD\n    A[开始] --> B[处理]\n    B --> C[结束]\n\`\`\``;
                newCursorPos = start + 15;
                break;
            case 'hr':
                newText = `---`;
                newCursorPos = start + 3;
                break;
            default:
                return;
        }
        
        // 插入新文本
        editor.value = beforeText + newText + afterText;
        
        // 设置光标位置
        editor.focus();
        if (selectedText) {
            editor.setSelectionRange(start, start + newText.length);
        } else {
            editor.setSelectionRange(newCursorPos, newCursorPos + (newText.includes('文本') || newText.includes('URL') || newText.includes('描述') ? newText.split(/文本|URL|描述/)[1]?.length || 0 : 0));
        }
        
        // 更新预览和字数统计
        this.updatePreview();
        this.updateWordCount();
        this.scheduleAutoSave();
    }
    
    setupEventListeners() {
        // 编辑器事件
        this.editor.addEventListener('input', () => {
            this.updatePreview();
            this.updateWordCount();
            this.scheduleAutoSave();
        });
        
        this.titleInput.addEventListener('input', () => {
            this.scheduleAutoSave();
        });
        
        // 标签页切换 - 只绑定编辑器区域的选项卡
        const editorTabs = document.querySelector('.editor-tabs');
        if (editorTabs) {
            editorTabs.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.switchTab(e.target.dataset.tab);
                });
            });
        }
        
        // 按钮事件
        document.getElementById('newEntryBtn').addEventListener('click', () => {
            this.createNewEntry();
        });
        
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveCurrentEntry();
        });
        
        document.getElementById('aiAssistBtn').addEventListener('click', () => {
            this.showAIDialog();
        });
        
        document.getElementById('themeToggleBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleThemeSelector();
        });
        
        document.getElementById('todayBtn').addEventListener('click', () => {
            this.filterByToday();
        });
        
        document.getElementById('showAllBtn').addEventListener('click', () => {
            this.showAllEntries();
        });
        
        document.getElementById('dateFilter').addEventListener('change', (e) => {
            this.filterByDate(e.target.value);
        });
        
        // 搜索功能
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.filterEntries(e.target.value);
            });
        }
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
        
        // 右键菜单
        this.editor.addEventListener('contextmenu', (e) => {
            this.showContextMenu(e);
        });
        
        document.addEventListener('click', () => {
            this.hideContextMenu();
            this.hideEntryContextMenu();
        });
        
        // 窗口事件
        window.addEventListener('beforeunload', () => {
            this.saveCurrentEntry();
        });

        // 记录列表右键菜单
        this.entriesList.addEventListener('contextmenu', (e) => {
            const item = e.target.closest('.entry-item');
            if (item) {
                e.preventDefault();
                this.entryContextTargetId = item.dataset.entryId;
                const menu = document.getElementById('entryContextMenu');
                menu.style.display = 'block';
                menu.style.left = e.pageX + 'px';
                menu.style.top = e.pageY + 'px';
                menu.onclick = (ev) => this.handleEntryContextMenuClick(ev);
            }
        });

        // AI 工作台按钮
        document.getElementById('btnGenDailySummary').addEventListener('click', () => this.generateDailySummaryFromWorkspace());
        document.getElementById('btnGenWeeklySummary').addEventListener('click', () => this.showWeeklySummaryModal());
        document.getElementById('btnInsertMermaid').addEventListener('click', () => this.generateMermaidDiagram());

        // 设置按钮 / 菜单 IPC
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) settingsBtn.addEventListener('click', () => this.openSettingsModal());
        if (window.require) {
            try {
                const { ipcRenderer } = require('electron');
                ipcRenderer.on('menu-open-settings', () => this.openSettingsModal());
            } catch {}
        }
    }
    
    // 标签页切换
    switchTab(tab) {
        // 只在主编辑器区域切换选项卡，不影响设置模态框
        const editorTabs = document.querySelector('.editor-tabs');
        if (!editorTabs) return;
        
        // 更新标签按钮状态 - 只在编辑器选项卡区域
        editorTabs.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeTabBtn = editorTabs.querySelector(`[data-tab="${tab}"]`);
        if (activeTabBtn) activeTabBtn.classList.add('active');
        
        // 更新内容显示
        const editorPane = document.getElementById('editorPane');
        const previewPane = document.getElementById('previewPane');
        const editorContent = document.querySelector('.editor-content');
        const aiWorkspacePane = this.aiWorkspacePane;
        
        editorPane.classList.remove('active');
        previewPane.classList.remove('active');
        editorContent.classList.remove('split');
        if (aiWorkspacePane) aiWorkspacePane.classList.remove('active');
        
        switch (tab) {
            case 'editor':
                editorPane.classList.add('active');
                break;
            case 'preview':
                previewPane.classList.add('active');
                this.updatePreview();
                break;
            case 'split':
                editorPane.classList.add('active');
                previewPane.classList.add('active');
                editorContent.classList.add('split');
                this.updatePreview();
                break;
            case 'aiworkspace':
                if (aiWorkspacePane) aiWorkspacePane.classList.add('active');
                break;
        }
    }
    
    // 更新预览
    updatePreview() {
        const markdown = this.editor.value;
        if (!markdown.trim()) {
            this.previewContent.innerHTML = '<p class="preview-placeholder">在左侧编辑器中输入内容，预览将在这里显示...</p>';
            return;
        }
        
        try {
            // 处理Mermaid图表
            const processedMarkdown = this.processMermaidBlocks(markdown);
            const html = marked.parse(processedMarkdown);
            this.previewContent.innerHTML = html;
            
            // 渲染Mermaid图表
            this.renderMermaidDiagrams();
            
            // 高亮代码
            this.previewContent.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightBlock(block);
            });
            
            // 为预览区域的链接绑定外部打开处理
            this.bindPreviewLinks();
        } catch (error) {
            console.error('Preview update failed:', error);
            this.previewContent.innerHTML = '<p class="preview-placeholder">预览渲染失败</p>';
        }
    }
    
    // 处理Mermaid代码块
    processMermaidBlocks(markdown) {
        const mermaidRegex = /```mermaid([\s\S]*?)```/g;
        let processed = markdown;
        let match;
        let index = 0;
        
        while ((match = mermaidRegex.exec(markdown)) !== null) {
            const mermaidCode = match[1].trim();
            const mermaidId = `mermaid-${Date.now()}-${index++}`;
            const replacement = `<div class="mermaid" id="${mermaidId}">${mermaidCode}</div>`;
            processed = processed.replace(match[0], replacement);
        }
        
        return processed;
    }
    
    // 渲染Mermaid图表
    async renderMermaidDiagrams() {
        const mermaidElements = this.previewContent.querySelectorAll('.mermaid');
        for (let element of mermaidElements) {
            try {
                // 获取原始的mermaid代码，避免解析HTML内容
                let mermaidCode = element.getAttribute('data-mermaid') || element.textContent.trim();
                
                if (mermaidCode) {
                    // 清除已存在的渲染内容
                    element.innerHTML = '';
                    
                    // 使用新的 Mermaid v10 API
                    const { svg } = await mermaid.render(element.id + '_svg', mermaidCode);
                    element.innerHTML = svg;
                    element.style.textAlign = 'center';
                }
            } catch (error) {
                console.error('Mermaid rendering failed:', error);
                // 显示更友好的错误信息
                element.innerHTML = `<div class="mermaid-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>Mermaid 图表渲染失败</div>
                    <small>${error.message}</small>
                </div>`;
                element.classList.add('mermaid-error');
            }
        }
    }
    
    // 更新字数统计
    updateWordCount() {
        const text = this.editor.value;
        const wordCount = text.length;
        this.wordCount.textContent = `${wordCount} 字`;
    }
    
    // 创建新记录
    createNewEntry() {
        // 保存当前记录
        if (this.currentEntry) {
            this.saveCurrentEntry();
        }
        
        // 创建新记录
        const now = new Date();
        this.currentEntry = {
            id: Date.now().toString(),
            title: '',
            content: '',
            date: now.toISOString(),
            created: now.toISOString(),
            updated: now.toISOString()
        };
        
        // 清空编辑器
        this.titleInput.value = '';
        this.editor.value = '';
        this.updateCurrentDate();
        this.updatePreview();
        this.updateWordCount();
        
        // 聚焦标题输入框
        this.titleInput.focus();
        
        // 更新侧边栏
        this.renderEntriesList();
    }
    
    // 保存当前记录
    saveCurrentEntry() {
        if (!this.currentEntry) return;
        
        const title = this.titleInput.value.trim() || '无标题';
        const content = this.editor.value;
        
        this.currentEntry.title = title;
        this.currentEntry.content = content;
        this.currentEntry.updated = new Date().toISOString();
        if (!this.currentEntry.created) {
            // 旧数据补写 created
            this.currentEntry.created = this.currentEntry.date || this.currentEntry.updated;
        }
        
        // 更新或添加到entries数组
        const existingIndex = this.entries.findIndex(entry => entry.id === this.currentEntry.id);
        if (existingIndex >= 0) {
            this.entries[existingIndex] = { ...this.currentEntry };
        } else {
            this.entries.unshift({ ...this.currentEntry });
        }
        
        // 保存到本地存储
        this.storage.saveEntries(this.entries);
        
        // 更新界面
        this.renderEntriesList();
        
        // 显示保存提示
        this.showNotification('保存成功', 'success');
    }
    
    // 加载记录
    loadEntry(entryId) {
        // 保存当前记录
        if (this.currentEntry) {
            this.saveCurrentEntry();
        }
        
        const entry = this.entries.find(e => e.id === entryId);
        if (!entry) return;
        
        this.currentEntry = { ...entry };
        this.titleInput.value = entry.title;
        this.editor.value = entry.content;
        
        this.updateCurrentDate();
        this.updatePreview();
        this.updateWordCount();
        
        // 更新侧边栏选中状态
        this.updateEntriesListSelection(entryId);
    }
    
    // 渲染记录列表
    renderEntriesList(entriesToRender = null) {
        this.entriesList.innerHTML = '';
        
        // 使用传入的条目列表或默认的所有条目
        const baseEntries = entriesToRender || this.entries;
        
        if (baseEntries.length === 0) {
            this.entriesList.innerHTML = '<div class="no-entries">暂无记录</div>';
            this.updateEntriesCount(0);
            return;
        }
        
        let filteredEntries = baseEntries;
        
        // 只有在没有传入特定条目列表时才应用搜索过滤
        if (!entriesToRender) {
            const searchTerm = this.searchInput?.value?.toLowerCase().trim();
            if (searchTerm) {
                filteredEntries = filteredEntries.filter(entry => 
                    entry.title.toLowerCase().includes(searchTerm) ||
                    entry.content.toLowerCase().includes(searchTerm)
                );
            }
        }
        
        this.updateEntriesCount(filteredEntries.length);
        
        if (filteredEntries.length === 0) {
            this.entriesList.innerHTML = '<div class="no-entries">没有匹配的记录</div>';
            return;
        }
        
        filteredEntries.forEach(entry => {
            const entryElement = this.createEntryListItem(entry);
            this.entriesList.appendChild(entryElement);
        });
    }
    
    // 更新记录数统计
    updateEntriesCount(count) {
        if (this.entriesCount) {
            this.entriesCount.textContent = `${count} 条记录`;
        }
    }
    
    // 过滤记录
    filterEntries(searchTerm) {
        this.renderEntriesList();
    }
    
    // 创建记录列表项
    createEntryListItem(entry) {
        const div = document.createElement('div');
        div.className = 'entry-item';
        div.dataset.entryId = entry.id;
        
        if (this.currentEntry && this.currentEntry.id === entry.id) {
            div.classList.add('active');
        }
        
    const rawDate = entry.created || entry.date || entry.updated;
    const date = new Date(rawDate);
        const preview = this.getTextPreview(entry.content, 100);
        
        div.innerHTML = `
            <div class="entry-title">${this.escapeHtml(entry.title)}</div>
            <div class="entry-date">${isNaN(date) ? this.escapeHtml(rawDate || '') : this.formatDateTime(date)}</div>
            ${preview ? `<div class="entry-preview">${this.escapeHtml(preview)}</div>` : ''}
        `;
        
        // 点击事件
        div.addEventListener('click', () => {
            this.loadEntry(entry.id);
        });
        
        return div;
    }
    
    // 更新记录列表选中状态
    updateEntriesListSelection(entryId) {
        document.querySelectorAll('.entry-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.entryId === entryId) {
                item.classList.add('active');
            }
        });
    }
    
    // 获取文本预览
    getTextPreview(text, maxLength = 100) {
        if (!text) return '';
        
        // 移除markdown语法
        const plainText = text
            .replace(/#+\s/g, '') // 标题
            .replace(/\*\*(.*?)\*\*/g, '$1') // 粗体
            .replace(/\*(.*?)\*/g, '$1') // 斜体
            .replace(/`(.*?)`/g, '$1') // 行内代码
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // 链接
            .replace(/```[\s\S]*?```/g, '') // 代码块
            .replace(/\n+/g, ' ') // 换行
            .trim();
        
        return plainText.length > maxLength 
            ? plainText.substring(0, maxLength) + '...'
            : plainText;
    }
    
    // 更新当前日期
    updateCurrentDate() {
    if (!this.currentEntry) return;
    const raw = this.currentEntry.created || this.currentEntry.date || this.currentEntry.updated;
    if (!raw) { this.entryDate.textContent = ''; return; }
    if (!this.currentEntry.created) this.currentEntry.created = raw;
    const d = new Date(this.currentEntry.created);
    this.entryDate.textContent = isNaN(d) ? raw : this.formatDateTime(d);
    }
    
    // 格式化日期
    formatDate(date) {
        const now = new Date();
        const diffTime = now - date;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays < 7) {
            return `${diffDays}天前`;
        } else {
            return date.toLocaleDateString('zh-CN');
        }
    }

    // 绝对日期时间格式 (YYYY-MM-DD HH:MM)
    formatDateTime(date) {
        if (!(date instanceof Date) || isNaN(date)) return '';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${d} ${hh}:${mm}`;
    }
    
    // 设置默认日期为今天
    setDefaultDate() {
        // 默认显示全部，不自动筛选为今天
        const dateFilter = document.getElementById('dateFilter');
        if (dateFilter) {
            dateFilter.value = '';
        }
        // 直接渲染全部列表
        this.renderEntriesList();
    }
    
    // 按日期筛选
    filterByDate(dateStr) {
        if (!dateStr) {
            // 如果没有选择日期，显示所有记录
            this.renderEntriesList();
            return;
        }
        
        // 筛选指定日期的记录
        const filteredEntries = this.entries.filter(entry => {
            const raw = entry.date || entry.created || entry.updated;
            if (!raw) return false;
            // 处理可能的本地日期格式或ISO字符串
            let entryDateOnly = '';
            if (raw.includes('T')) {
                entryDateOnly = raw.split('T')[0];
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                entryDateOnly = raw; // 已是YYYY-MM-DD
            } else {
                // 尝试解析本地化日期
                try {
                    const d = new Date(raw);
                    if (!isNaN(d)) {
                        entryDateOnly = d.toISOString().split('T')[0];
                    }
                } catch(e) { /* ignore */ }
            }
            return entryDateOnly === dateStr;
        });
        
        // 渲染筛选后的记录列表
        this.renderEntriesList(filteredEntries);
    }
    
    // 显示所有记录
    showAllEntries() {
        const dateFilter = document.getElementById('dateFilter');
        if (dateFilter) {
            dateFilter.value = '';
        }
        this.renderEntriesList();
    }
    
    // 筛选今天的记录
    filterByToday() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        document.getElementById('dateFilter').value = todayStr;
        this.filterByDate(todayStr);
    }
    
    // 计划自动保存
    scheduleAutoSave() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        
        this.autoSaveTimer = setTimeout(() => {
            this.saveCurrentEntry();
        }, 5000); // 5秒后自动保存
    }
    
    // 键盘快捷键处理
    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'n':
                    e.preventDefault();
                    this.createNewEntry();
                    break;
                case 's':
                    e.preventDefault();
                    this.saveCurrentEntry();
                    break;
                case 't':
                    e.preventDefault();
                    this.toggleTheme();
                    break;
            }
        }
    }
    
    // 显示右键菜单
    showContextMenu(e) {
        e.preventDefault();
        
        const contextMenu = document.getElementById('contextMenu');
        contextMenu.style.display = 'block';
        contextMenu.style.left = e.pageX + 'px';
        contextMenu.style.top = e.pageY + 'px';
        
        // 添加事件监听
        contextMenu.addEventListener('click', this.handleContextMenuClick.bind(this));
    }
    
    // 隐藏右键菜单
    hideContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        contextMenu.style.display = 'none';
    }

    hideEntryContextMenu() {
        const menu = document.getElementById('entryContextMenu');
        if (menu) menu.style.display = 'none';
    }
    
    // 处理右键菜单点击
    handleContextMenuClick(e) {
        const action = e.target.dataset.action;
        if (!action) return;
        
        switch (action) {
            case 'cut':
                this.cutText();
                break;
            case 'copy':
                this.copyText();
                break;
            case 'paste':
                this.pasteText();
                break;
            case 'selectAll':
                this.editor.select();
                break;
            case 'aiAssist':
                this.showAIDialogWithSelection();
                break;
        }
        
        this.hideContextMenu();
    }
    
    // 剪切文本
    cutText() {
        const selectedText = this.getSelectedText();
        if (selectedText) {
            navigator.clipboard.writeText(selectedText).then(() => {
                this.replaceSelectedText('');
            }).catch(err => {
                console.warn('剪切失败，使用execCommand备用方案:', err);
                document.execCommand('cut');
            });
        }
    }
    
    // 复制文本
    copyText() {
        const selectedText = this.getSelectedText();
        if (selectedText) {
            navigator.clipboard.writeText(selectedText).catch(err => {
                console.warn('复制失败，使用execCommand备用方案:', err);
                document.execCommand('copy');
            });
        }
    }
    
    // 粘贴文本
    async pasteText() {
        try {
            const text = await navigator.clipboard.readText();
            this.replaceSelectedText(text);
        } catch (err) {
            console.warn('粘贴失败，使用execCommand备用方案:', err);
            // 备用方案 - 聚焦编辑器后使用execCommand
            this.editor.focus();
            document.execCommand('paste');
        }
    }
    
    // 获取选中文本
    getSelectedText() {
        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        return this.editor.value.substring(start, end);
    }
    
    // 替换选中文本
    replaceSelectedText(newText) {
        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const currentValue = this.editor.value;
        
        this.editor.value = currentValue.substring(0, start) + newText + currentValue.substring(end);
        
        // 设置光标位置
        const newPosition = start + newText.length;
        this.editor.setSelectionRange(newPosition, newPosition);
        this.editor.focus();
        
        // 触发预览更新
        this.updatePreview();
    }
    
    // 显示AI对话框并发送选中文本
    showAIDialogWithSelection() {
        if (!this.aiAssistant) return;
        
        const selectedText = this.getSelectedText();
        this.aiAssistant.showDialog();
        
        if (selectedText) {
            // 自动发送优化请求
            const message = `请帮我优化以下文本，如需创建图表请使用完整的mermaid代码块格式（\`\`\`mermaid ... \`\`\`）：\n\n${selectedText}`;
            const aiInput = document.getElementById('aiInput');
            if (aiInput) {
                aiInput.value = message;
                // 自动发送消息
                setTimeout(() => {
                    this.aiAssistant.sendMessage();
                }, 100);
            }
        }
    }

    handleEntryContextMenuClick(e) {
        const action = e.target.dataset.action;
        if (!action) return;
        switch(action) {
            case 'renameEntry':
                this.renameEntry(this.entryContextTargetId);
                break;
            case 'exportToPDF':
                this.exportEntryToPDF(this.entryContextTargetId);
                break;
            case 'deleteEntry':
                this.deleteEntry(this.entryContextTargetId);
                break;
        }
        this.hideEntryContextMenu();
    }

    renameEntry(id) {
        const entry = this.entries.find(e => e.id === id);
        if (!entry) return;
        this.showRenameDialog(entry);
    }

    showRenameDialog(entry) {
        // 创建重命名对话框
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-dialog" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>重命名条目</h3>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="text" id="renameInput" class="form-input" value="${this.escapeHtml(entry.title)}" placeholder="输入新标题" style="width: 100%;">
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="cancelRename">取消</button>
                    <button class="btn btn-primary" id="confirmRename">确认</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        const input = document.getElementById('renameInput');
        const cancelBtn = document.getElementById('cancelRename');
        const confirmBtn = document.getElementById('confirmRename');
        
        // 自动选中文本
        input.focus();
        input.select();
        
        // 处理确认
        const handleConfirm = () => {
            const newTitle = input.value.trim();
            if (newTitle) {
                entry.title = newTitle;
                if (this.currentEntry && this.currentEntry.id === entry.id) {
                    this.titleInput.value = entry.title;
                    this.currentEntry.title = entry.title;
                }
                // 保存与刷新列表
                this.storage.saveEntries(this.entries);
                this.renderEntriesList();
            }
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };
        
        // 处理取消
        const handleCancel = () => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };
        
        // 事件监听
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleConfirm();
            } else if (e.key === 'Escape') {
                handleCancel();
            }
        });
        
        // 点击遮罩关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        });
    }

    // 导出条目为PDF
    async exportEntryToPDF(id) {
        const entry = this.entries.find(e => e.id === id);
        if (!entry) return;
        
        try {
            // 创建一个隐藏的iframe来生成PDF
            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.left = '-9999px';
            iframe.style.width = '210mm'; // A4宽度
            iframe.style.height = '297mm'; // A4高度
            document.body.appendChild(iframe);
            
            const doc = iframe.contentDocument;
            
            // 渲染内容到iframe
            const htmlContent = await this.generatePDFContent(entry);
            doc.open();
            doc.write(htmlContent);
            doc.close();
            
            // 等待内容加载完成
            await new Promise(resolve => {
                iframe.onload = resolve;
                setTimeout(resolve, 2000); // 增加等待时间以确保Mermaid渲染完成
            });
            
            // 等待Mermaid渲染完成
            await this.waitForMermaidRender(iframe.contentDocument);
            
            // 触发打印对话框
            iframe.contentWindow.print();
            
            // 清理
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 2000);
            
        } catch (error) {
            console.error('PDF导出失败:', error);
            alert('PDF导出失败，请稍后重试。');
        }
    }
    
    // 等待Mermaid渲染完成
    async waitForMermaidRender(doc) {
        const mermaidElements = doc.querySelectorAll('.mermaid');
        if (mermaidElements.length === 0) return;
        
        // 等待所有Mermaid图表渲染完成
        const promises = Array.from(mermaidElements).map(element => {
            return new Promise((resolve) => {
                if (element.innerHTML && element.innerHTML.includes('<svg')) {
                    resolve(); // 已经渲染完成
                } else {
                    // 等待渲染
                    const observer = new MutationObserver(() => {
                        if (element.innerHTML && element.innerHTML.includes('<svg')) {
                            observer.disconnect();
                            resolve();
                        }
                    });
                    observer.observe(element, { childList: true, subtree: true });
                    
                    // 超时保护
                    setTimeout(() => {
                        observer.disconnect();
                        resolve();
                    }, 5000);
                }
            });
        });
        
        await Promise.all(promises);
    }
    
    // 为PDF处理Mermaid内容
    async processMermaidForPDF(content) {
        // 检查是否包含Mermaid代码块
        const mermaidRegex = /```mermaid([\s\S]*?)```/g;
        let processedContent = content;
        
        const mermaidMatches = [...content.matchAll(mermaidRegex)];
        
        if (mermaidMatches.length > 0) {
            // 为每个Mermaid代码块生成唯一的div
            for (let i = 0; i < mermaidMatches.length; i++) {
                const match = mermaidMatches[i];
                const mermaidCode = match[1].trim();
                const mermaidId = `pdf-mermaid-${Date.now()}-${i}`;
                
                // 替换为div元素，稍后在iframe中渲染
                const replacement = `<div class="mermaid" id="${mermaidId}">\n${mermaidCode}\n</div>`;
                processedContent = processedContent.replace(match[0], replacement);
            }
        }
        
        return processedContent;
    }
    
    // 生成PDF内容HTML
    async generatePDFContent(entry) {
        // 先处理Mermaid内容
        const processedContent = await this.processMermaidForPDF(entry.content);
        const renderedContent = marked.parse(processedContent);
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${this.escapeHtml(entry.title)}</title>
                <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
                <style>
                    @page {
                        margin: 2cm;
                        size: A4;
                    }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        font-size: 12pt;
                        line-height: 1.6;
                        color: #333;
                        margin: 0;
                        padding: 0;
                    }
                    .header {
                        border-bottom: 2px solid #007acc;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }
                    .title {
                        font-size: 18pt;
                        font-weight: bold;
                        color: #007acc;
                        margin: 0;
                    }
                    .date {
                        font-size: 11pt;
                        color: #666;
                        margin-top: 5px;
                    }
                    .content {
                        line-height: 1.8;
                    }
                    .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
                        color: #333;
                        margin-top: 20px;
                        margin-bottom: 10px;
                    }
                    .content p {
                        margin-bottom: 10px;
                    }
                    .content pre {
                        background: #f5f5f5;
                        padding: 10px;
                        border-radius: 4px;
                        font-size: 10pt;
                        overflow-wrap: break-word;
                    }
                    .content code {
                        background: #f5f5f5;
                        padding: 2px 4px;
                        border-radius: 2px;
                        font-size: 11pt;
                    }
                    .content blockquote {
                        border-left: 4px solid #007acc;
                        margin: 10px 0;
                        padding-left: 15px;
                        color: #666;
                    }
                    .content ul, .content ol {
                        margin-bottom: 10px;
                        padding-left: 20px;
                    }
                    .content li {
                        margin-bottom: 5px;
                    }
                    .mermaid {
                        display: flex;
                        justify-content: center;
                        margin: 20px 0;
                        page-break-inside: avoid;
                    }
                    .mermaid svg {
                        max-width: 100%;
                        height: auto;
                    }
                    .footer {
                        position: fixed;
                        bottom: 1cm;
                        right: 1cm;
                        font-size: 10pt;
                        color: #999;
                    }
                    @media print {
                        .no-print {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1 class="title">${this.escapeHtml(entry.title)}</h1>
                    <div class="date">创建时间: ${entry.date}</div>
                </div>
                <div class="content">
                    ${renderedContent}
                </div>
                <div class="footer">
                    ArtiMeow AI Life Logger - ${new Date().toLocaleDateString('zh-CN')}
                </div>
                <script>
                    // 初始化Mermaid
                    mermaid.initialize({ 
                        startOnLoad: true,
                        theme: 'default',
                        themeVariables: {
                            primaryColor: '#007acc',
                            primaryTextColor: '#333',
                            primaryBorderColor: '#007acc',
                            lineColor: '#666'
                        }
                    });
                    
                    // 确保所有Mermaid图表都被渲染
                    document.addEventListener('DOMContentLoaded', function() {
                        mermaid.init(undefined, document.querySelectorAll('.mermaid'));
                    });
                </script>
            </body>
            </html>
        `;
    }

    deleteEntry(id) {
        const idx = this.entries.findIndex(e => e.id === id);
        if (idx >= 0 && confirm('确定删除该记录？此操作不可撤销')) {
            const removingCurrent = this.currentEntry && this.currentEntry.id === id;
            this.entries.splice(idx, 1);
            this.storage.saveEntries(this.entries);
            if (removingCurrent) {
                this.currentEntry = null;
                this.titleInput.value='';
                this.editor.value='';
                this.updatePreview();
                this.updateWordCount();
            }
            this.renderEntriesList();
        }
    }

    // AI 工作状态控制
    setAIWorkingState(isWorking, statusText = '') {
        const workButtons = document.querySelectorAll('#btnGenDailySummary, #btnGenWeeklySummary, #btnInsertMermaid');
        const statusElement = document.getElementById('aiWorkStatus');
        const statusTextElement = statusElement?.querySelector('.status-text');
        
        workButtons.forEach(btn => {
            btn.disabled = isWorking;
        });
        
        if (statusElement) {
            if (isWorking) {
                statusElement.style.display = 'block';
                if (statusTextElement && statusText) {
                    statusTextElement.textContent = statusText;
                }
            } else {
                statusElement.style.display = 'none';
            }
        }
        
        // 禁用其他操作
        if (isWorking) {
            document.body.classList.add('ai-working');
        } else {
            document.body.classList.remove('ai-working');
        }
    }

    // AI 工作台功能
    async generateDailySummaryFromWorkspace() {
        if (!this.aiAssistant) return;
        
        this.setAIWorkingState(true, '正在生成今日总结...');
        
        const dailyData = this.collectAIWorkspaceData();
        const prompt = `请根据以下结构化输入生成今日总结，分为：已完成、亮点、问题与风险、改进建议，如需创建图表请使用完整的mermaid代码块格式（\`\`\`mermaid ... \`\`\`）：\n\n${JSON.stringify(dailyData, null, 2)}`;
        
        try {
            this.aiWorkspaceOutput.innerHTML = '<div class="generating">正在生成今日总结...</div>';
            await this.streamAIWorkspaceResponse(prompt, 'summary');
        } catch (e) {
            this.aiWorkspaceOutput.textContent = '生成失败: ' + e.message;
        } finally {
            this.setAIWorkingState(false);
        }
    }

    // 显示周总结选择模态框
    showWeeklySummaryModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>生成周总结</h3>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>请选择要包含在周总结中的日志记录：</p>
                    <div class="entry-selection-list" style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px;">
                        ${this.renderEntrySelectionList()}
                    </div>
                    <div style="margin-top: 15px; text-align: center;">
                        <span style="color: #666; font-size: 14px;">已选择: <span id="selectedCount">0</span> 条记录</span>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">取消</button>
                    <button class="btn btn-primary" onclick="app.generateSelectedWeeklySummary()">生成周总结</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.updateSelectedCount();
    }
    
    // 渲染日志选择列表
    renderEntrySelectionList() {
        if (!this.entries || this.entries.length === 0) {
            return '<p style="text-align: center; color: #666; padding: 20px;">暂无日志记录</p>';
        }
        
        return this.entries.map((entry, index) => `
            <div class="entry-selection-item" style="display: flex; align-items: flex-start; padding: 10px; border-bottom: 1px solid #eee;">
                <input type="checkbox" id="entry_${index}" style="margin-top: 3px; margin-right: 10px;" onchange="app.updateSelectedCount()">
                <label for="entry_${index}" style="flex: 1; cursor: pointer;">
                    <div style="font-weight: bold; margin-bottom: 5px;">${this.escapeHtml(entry.title)}</div>
                    <div style="color: #666; font-size: 14px; margin-bottom: 5px;">${entry.date}</div>
                    <div style="color: #888; font-size: 13px; line-height: 1.4;">
                        ${this.escapeHtml(entry.content.substring(0, 150))}${entry.content.length > 150 ? '...' : ''}
                    </div>
                </label>
            </div>
        `).join('');
    }
    
    // 更新选中计数
    updateSelectedCount() {
        const checkboxes = document.querySelectorAll('.entry-selection-item input[type="checkbox"]:checked');
        const countSpan = document.getElementById('selectedCount');
        if (countSpan) {
            countSpan.textContent = checkboxes.length;
        }
    }
    
    // 生成选中的周总结
    async generateSelectedWeeklySummary() {
        const checkboxes = document.querySelectorAll('.entry-selection-item input[type="checkbox"]:checked');
        
        if (checkboxes.length === 0) {
            alert('请至少选择一条日志记录');
            return;
        }
        
        // 收集选中的记录
        const selectedEntries = Array.from(checkboxes).map(checkbox => {
            const index = parseInt(checkbox.id.replace('entry_', ''));
            return this.entries[index];
        });
        
        // 关闭模态框
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
        
        // 开始生成
        if (!this.aiAssistant) return;
        
        this.setAIWorkingState(true, '正在生成周总结和计划...');
        
        const prompt = `基于以下选中的日志记录，请生成一份周总结（概况 / 关键成果 / 遇到的问题 / 经验教训）以及下一周详细计划（目标 -> 任务 -> 里程碑），如需创建图表请使用完整的mermaid代码块格式（\`\`\`mermaid ... \`\`\`）：\n\n${JSON.stringify(selectedEntries.map(e=>({title:e.title,date:e.date,content:e.content.slice(0,500)})), null, 2)}`;
        
        try {
            this.aiWorkspaceOutput.innerHTML = '<div class="generating">正在生成周总结和计划...</div>';
            await this.streamAIWorkspaceResponse(prompt, 'weeklyplan');
        } catch (e) {
            this.aiWorkspaceOutput.textContent = '生成失败: ' + e.message;
        } finally {
            this.setAIWorkingState(false);
        }
    }

    async generateMermaidDiagram() {
        if (!this.aiAssistant) return;
        
        this.setAIWorkingState(true, '正在生成 Mermaid 图表...');
        
        const data = this.collectAIWorkspaceData();
        const prompt = `根据以下结构化输入生成一个 mermaid 流程图或思维导图，必须使用完整的代码块格式：\`\`\`mermaid\n图表代码\n\`\`\`\n\n输入数据：\n${JSON.stringify(data, null, 2)}`;
        
        try {
            // 显示生成状态
            this.aiWorkspaceOutput.innerHTML = '<div class="generating">正在生成 Mermaid 图表...</div>';
            
            // 使用流式传输生成
            await this.streamAIWorkspaceResponse(prompt, 'mermaid');
            
        } catch (e) {
            this.aiWorkspaceOutput.textContent = '生成失败: ' + e.message;
        } finally {
            this.setAIWorkingState(false);
        }
    }
    
    // AI工作台流式响应
    async streamAIWorkspaceResponse(prompt, type = 'general') {
        try {
            let fullContent = '';
            const outputDiv = this.aiWorkspaceOutput;
            
            // 获取设置，确保有默认值
            const settings = this.storage.loadSettings();
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
                        messages: [{ role: 'user', content: prompt }],
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
                        messages: [{ role: 'user', content: prompt }],
                        stream: true
                    })
                });
            } else if (aiProvider === 'custom') {
                // 对于自定义API，按照OpenAI格式处理
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
                        messages: [{ role: 'user', content: prompt }],
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
                        messages: [{ role: 'user', content: prompt }],
                        stream: true
                    })
                });
            }
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            outputDiv.innerHTML = '<div class="streaming-content"></div><div class="workspace-actions"></div>';
            const contentDiv = outputDiv.querySelector('.streaming-content');
            
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
                                
                                if (type === 'mermaid') {
                                    this.renderMermaidPreview(fullContent, contentDiv);
                                } else {
                                    contentDiv.innerHTML = marked.parse(fullContent);
                                }
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
                                
                                if (type === 'mermaid') {
                                    this.renderMermaidPreview(fullContent, contentDiv);
                                } else {
                                    contentDiv.innerHTML = marked.parse(fullContent);
                                }
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
            
            // 添加操作按钮
            this.addWorkspaceActions(fullContent, type);
            
        } catch (error) {
            console.error('Stream AI workspace response failed:', error);
            this.aiWorkspaceOutput.innerHTML = '<div class="error">生成失败: ' + error.message + '</div>';
        }
    }
    
    // 渲染Mermaid预览
    renderMermaidPreview(content, container) {
        // 提取mermaid代码块
        const mermaidMatch = content.match(/```mermaid([\s\S]*?)```/);
        if (mermaidMatch) {
            const mermaidCode = mermaidMatch[1].trim();
            const mermaidId = 'workspace-mermaid-' + Date.now();
            
            container.innerHTML = `
                <div class="mermaid-preview">
                    <h4>Mermaid 图表预览</h4>
                    <div class="mermaid-container">
                        <div class="mermaid-placeholder" id="${mermaidId}">正在渲染图表...</div>
                    </div>
                </div>
                <div class="mermaid-code">
                    <h4>代码</h4>
                    <pre><code class="language-mermaid">${mermaidCode}</code></pre>
                </div>
            `;
            
            // 渲染mermaid图表
            setTimeout(async () => {
                const mermaidElement = container.querySelector(`#${mermaidId}`);
                if (mermaidElement && mermaidCode) {
                    try {
                        // 验证mermaid语法
                        const { svg, bindFunctions } = await mermaid.render(mermaidId + '_svg', mermaidCode);
                        
                        // 替换占位符为SVG
                        mermaidElement.innerHTML = svg;
                        mermaidElement.className = 'mermaid-rendered';
                        
                        // 应用绑定函数（如果有的话）
                        if (bindFunctions) {
                            bindFunctions(mermaidElement);
                        }
                        
                        // 居中显示
                        const container = mermaidElement.parentElement;
                        if (container) {
                            container.style.textAlign = 'center';
                        }
                    } catch (error) {
                        console.error('Mermaid render error:', error);
                        mermaidElement.innerHTML = `
                            <div class="mermaid-error">
                                <i class="fas fa-exclamation-triangle"></i>
                                <div>图表渲染失败</div>
                                <small>${error.message}</small>
                            </div>
                        `;
                        mermaidElement.className = 'mermaid-error-container';
                    }
                }
            }, 100);
        } else {
            // 如果没有找到mermaid代码块，但包含mermaid关键字，尝试直接渲染
            if (content.includes('graph') || content.includes('flowchart') || content.includes('mindmap')) {
                const cleanContent = content.replace(/```/g, '').trim();
                const mermaidId = 'workspace-mermaid-' + Date.now();
                
                container.innerHTML = `
                    <div class="mermaid-preview">
                        <h4>Mermaid 图表预览</h4>
                        <div class="mermaid-container">
                            <div class="mermaid" id="${mermaidId}">${cleanContent}</div>
                        </div>
                    </div>
                `;
                
                setTimeout(() => {
                    const mermaidElement = container.querySelector(`#${mermaidId}`);
                    if (mermaidElement) {
                        try {
                            mermaidElement.innerHTML = cleanContent;
                            mermaidElement.removeAttribute('data-processed');
                            mermaid.init(undefined, mermaidElement);
                            
                            const containerEl = mermaidElement.parentElement;
                            if (containerEl) {
                                containerEl.style.textAlign = 'center';
                            }
                        } catch (error) {
                            console.error('Mermaid render error:', error);
                            mermaidElement.innerHTML = `<pre style="color: red;">Mermaid渲染错误: ${error.message}</pre>`;
                        }
                    }
                }, 100);
            } else {
                container.innerHTML = marked.parse(content);
            }
        }
    }
    
    // 添加工作台操作按钮
    addWorkspaceActions(content, type) {
        const actionsDiv = this.aiWorkspaceOutput.querySelector('.workspace-actions');
        if (!actionsDiv) return;
        
        // 创建按钮容器
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'workspace-action-buttons';
        
        // 创建插入按钮
        const insertBtn = document.createElement('button');
        insertBtn.className = 'btn-small btn-primary';
        insertBtn.innerHTML = '<i class="fas fa-plus"></i> 插入到当前日志';
        insertBtn.onclick = () => this.insertToCurrentEntry(content);
        
        // 创建复制按钮
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-small btn-secondary';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i> 复制内容';
        copyBtn.onclick = () => this.copyToClipboard(content);
        
        // 添加按钮到容器
        buttonsContainer.appendChild(insertBtn);
        buttonsContainer.appendChild(copyBtn);
        
        // Mermaid特有按钮
        if (type === 'mermaid') {
            const mermaidBtn = document.createElement('button');
            mermaidBtn.className = 'btn-small btn-success';
            mermaidBtn.innerHTML = '<i class="fas fa-project-diagram"></i> 插入 Mermaid 到编辑器';
            mermaidBtn.onclick = () => this.insertMermaidToEditor();
            buttonsContainer.appendChild(mermaidBtn);
        }
        
        // 清空并添加按钮容器
        actionsDiv.innerHTML = '';
        actionsDiv.appendChild(buttonsContainer);
    }
    
    // 插入内容到当前日志
    insertToCurrentEntry(content) {
        if (confirm('确定要将此内容插入到当前日志吗？')) {
            const currentContent = this.editor.value;
            this.editor.value = currentContent + '\n\n' + content + '\n\n';
            this.updatePreview();
            this.updateWordCount();
            
            // 显示通知
            this.showNotification('内容已插入到当前日志', 'success');
        }
    }
    
    // 复制到剪贴板
    async copyToClipboard(content) {
        try {
            await navigator.clipboard.writeText(content);
            this.showNotification('内容已复制到剪贴板', 'success');
        } catch (error) {
            console.error('Copy failed:', error);
            this.showNotification('复制失败', 'error');
        }
    }
    
    // 插入Mermaid到编辑器
    insertMermaidToEditor() {
        const mermaidCode = this.aiWorkspaceOutput.querySelector('.mermaid-code code');
        if (mermaidCode && confirm('确定要将此 Mermaid 图表插入到编辑器吗？')) {
            const currentContent = this.editor.value;
            this.editor.value = currentContent + '\n\n```mermaid\n' + mermaidCode.textContent + '\n```\n\n';
            this.updatePreview();
            this.updateWordCount();
            
            // 显示通知
            this.showNotification('Mermaid 图表已插入到编辑器', 'success');
        }
    }

    collectAIWorkspaceData() {
        return {
            done: document.getElementById('aiDailyDone').value.trim(),
            plan: document.getElementById('aiDailyPlan').value.trim(),
            ideas: document.getElementById('aiIdeas').value.trim(),
            research: document.getElementById('aiResearch').value.trim(),
            timestamp: new Date().toISOString()
        };
    }

    insertAutoMermaidIfAny(text, insertRaw=false) {
        const mermaidBlockMatch = text.match(/```mermaid[\s\S]*?```/);
        if (mermaidBlockMatch) {
            const code = mermaidBlockMatch[0].replace(/```mermaid|```/g,'').trim();
            if (insertRaw) {
                // 追加到当前编辑器（前置空行，保持分隔）
                this.editor.value += `\n\n\n\n` + '```mermaid\n' + code + '\n```\n';
                this.updatePreview();
            }
        }
    }

    // 设置模态
    openSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (!modal) return;
        modal.style.display='block';
        this.initSettingsModal();
    }

    closeSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) modal.style.display='none';
    }

    // 设置选项卡切换 - 独立于主程序选项卡
    switchSettingsTab(tabName) {
        const settingsModal = document.getElementById('settingsModal');
        if (!settingsModal) return;
        
        // 切换设置选项卡按钮状态
        settingsModal.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = settingsModal.querySelector(`.settings-tab-btn[data-tab="${tabName}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        
        // 切换设置选项卡内容
        settingsModal.querySelectorAll('.settings-tab').forEach(tab => tab.classList.remove('active'));
        const targetTab = settingsModal.querySelector(`#${tabName}Tab`);
        if (targetTab) targetTab.classList.add('active');
    }

    initSettingsModal() {
        // 只初始化一次监听
        if (this._settingsInited) return;
        this._settingsInited = true;
        
        document.getElementById('closeSettingsModal').addEventListener('click', ()=> this.closeSettingsModal());
        document.getElementById('cancelSettingsBtn').addEventListener('click', ()=> this.closeSettingsModal());
        // 加载设置值
        this.applySettingsToModal();
        document.getElementById('saveSettingsBtn').addEventListener('click', ()=> this.saveSettingsFromModal());
        document.getElementById('aiProvider').addEventListener('change', (e)=> this.showAIConfig(e.target.value));
        
        // 设置选项卡切换事件 - 独立于主程序选项卡
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            settingsModal.querySelectorAll('.settings-tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tab = e.target.dataset.tab;
                    if (tab) this.switchSettingsTab(tab);
                });
            });
        }
        
        // about actions
        const refreshBtn = document.getElementById('refreshInfoBtn');
        if (refreshBtn) refreshBtn.addEventListener('click', ()=> this.refreshSystemInfo());
        const gitBtn = document.getElementById('openGithubBtn');
        if (gitBtn) gitBtn.addEventListener('click', ()=> this.openGitHub());
        const gLink = document.getElementById('githubLink');
        if (gLink) gLink.addEventListener('click', (e)=>{e.preventDefault(); this.openGitHub();});
        this.loadSystemInfo();
    }

    applySettingsToModal() {
        const s = this.settings;
        document.getElementById('aiProvider').value = s.aiProvider;
        document.getElementById('ollamaUrl').value = s.ollamaUrl;
        document.getElementById('ollamaModel').value = s.ollamaModel;
        document.getElementById('openaiUrl').value = s.openaiUrl;
        document.getElementById('openaiKey').value = s.openaiKey;
        document.getElementById('openaiModel').value = s.openaiModel;
        document.getElementById('customUrl').value = s.customUrl;
        document.getElementById('customKey').value = s.customKey;
        document.getElementById('customModel').value = s.customModel;
        document.getElementById('autoSummary').checked = s.autoSummary;
        document.getElementById('weeklyPlanning').checked = s.weeklyPlanning;
        document.getElementById('mermaidSuggestion').checked = s.mermaidSuggestion;
        document.getElementById('themeSelect').value = s.theme;
        document.getElementById('fontSize').value = s.fontSize;
        document.getElementById('lineNumbers').checked = s.lineNumbers;
        document.getElementById('wordWrap').checked = s.wordWrap;
        this.showAIConfig(s.aiProvider);
    }

    saveSettingsFromModal() {
        const newSettings = {
            aiProvider: document.getElementById('aiProvider').value,
            ollamaUrl: document.getElementById('ollamaUrl').value,
            ollamaModel: document.getElementById('ollamaModel').value,
            openaiUrl: document.getElementById('openaiUrl').value,
            openaiKey: document.getElementById('openaiKey').value,
            openaiModel: document.getElementById('openaiModel').value,
            customUrl: document.getElementById('customUrl').value,
            customKey: document.getElementById('customKey').value,
            customModel: document.getElementById('customModel').value,
            autoSummary: document.getElementById('autoSummary').checked,
            weeklyPlanning: document.getElementById('weeklyPlanning').checked,
            mermaidSuggestion: document.getElementById('mermaidSuggestion').checked,
            theme: document.getElementById('themeSelect').value,
            fontSize: document.getElementById('fontSize').value,
            lineNumbers: document.getElementById('lineNumbers').checked,
            wordWrap: document.getElementById('wordWrap').checked
        };
        if (this.storage.saveSettings(newSettings)) {
            this.settings = newSettings;
            if (window.themeManager) window.themeManager.setTheme(newSettings.theme);
            this.showNotification('设置已保存','success');
            setTimeout(()=> this.closeSettingsModal(), 500);
        } else {
            this.showNotification('保存设置失败','error');
        }
    }

    showAIConfig(provider) {
        document.querySelectorAll('#settingsModal .ai-config').forEach(el=> el.style.display='none');
        const target = document.querySelector(`#settingsModal .${provider}-config`);
        if (target) target.style.display='block';
    }

    async loadSystemInfo() {
        if (window.electronAPI && window.electronAPI.getSystemInfo) {
            try {
                const info = await window.electronAPI.getSystemInfo();
                this.systemInfo = info;
                this.updateSystemInfoUI();
            } catch (e) {}
        } else if (window.require) {
            try {
                const { ipcRenderer } = require('electron');
                const info = await ipcRenderer.invoke('get-system-info');
                this.systemInfo = info;
                this.updateSystemInfoUI();
            } catch {}
        }
    }

    updateSystemInfoUI() {
        if (!this.systemInfo) return;
        const map = {
            appName: this.systemInfo.productName || this.systemInfo.name,
            appVersion: '版本 ' + this.systemInfo.version,
            platformInfo: this.systemInfo.platform,
            archInfo: this.systemInfo.arch,
            nodeVersion: this.systemInfo.nodeVersion,
            electronVersion: this.systemInfo.electronVersion,
            packaged: this.systemInfo.isDev ? '开发模式' : '已打包',
            execPath: this.systemInfo.execPath,
            licenseInfo: this.systemInfo.license
        };
        Object.entries(map).forEach(([id,val])=>{ const el=document.getElementById(id); if (el) el.textContent=val; });
    }

    refreshSystemInfo() { this.loadSystemInfo(); }
    openGitHub() { if (window.electronAPI && window.electronAPI.openExternal) { window.electronAPI.openExternal('https://github.com/B5-Software/ArtiMeow-AILifeLogger'); } else { window.open('https://github.com/B5-Software/ArtiMeow-AILifeLogger','_blank'); } }
    
    // 显示AI对话框
    showAIDialog() {
        this.aiAssistant.showDialog();
    }
    
    // 切换主题
    toggleTheme() {
        if (window.themeManager) {
            window.themeManager.toggleTheme();
        }
    }
    
    // 切换主题选择器显示
    toggleThemeSelector() {
        const selector = document.getElementById('themeSelector');
        if (!selector) return;
        
        const isShow = selector.classList.contains('show');
        
        if (isShow) {
            this.hideThemeSelector();
        } else {
            this.showThemeSelector();
        }
    }
    
    // 显示主题选择器
    showThemeSelector() {
        const selector = document.getElementById('themeSelector');
        if (!selector) return;
        
        // 更新当前主题状态
        this.updateThemeSelector();
        
        selector.classList.add('show');
        
        // 启用预览功能
        this.enableThemePreview();
        
        // 添加选项点击事件
        if (!this._themeOptionsInited) {
            this._themeOptionsInited = true;
            
            selector.querySelectorAll('.theme-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    const theme = option.dataset.theme;
                    this.applyTheme(theme);
                    this.hideThemeSelector();
                });
            });
            
            // 点击外部关闭
            document.addEventListener('click', (e) => {
                if (!selector.contains(e.target) && !e.target.closest('#themeToggleBtn')) {
                    this.hideThemeSelector();
                }
            });
        }
    }
    
    // 启用主题预览
    enableThemePreview() {
        const selector = document.getElementById('themeSelector');
        if (!selector) return;
        
        // 为每个主题选项添加预览功能
        selector.querySelectorAll('.theme-option').forEach(option => {
            // 移除旧的预览事件监听器
            const newOption = option.cloneNode(true);
            option.parentNode.replaceChild(newOption, option);
            
            // 添加新的预览事件监听器
            newOption.addEventListener('mouseenter', () => {
                const theme = newOption.dataset.theme;
                document.body.className = `theme-${theme}`;
            });
            
            newOption.addEventListener('mouseleave', () => {
                // 恢复当前主题
                const currentTheme = this.settings.theme || 'system';
                document.body.className = `theme-${currentTheme}`;
            });
            
            // 重新添加点击事件
            newOption.addEventListener('click', (e) => {
                e.stopPropagation();
                const theme = newOption.dataset.theme;
                this.applyTheme(theme);
                this.settings.theme = theme;
                this.storage.saveSettings(this.settings);
                this.hideThemeSelector();
            });
        });
    }
    
    // 隐藏主题选择器
    hideThemeSelector() {
        const selector = document.getElementById('themeSelector');
        if (selector) {
            selector.classList.remove('show');
            // 停用预览模式，恢复当前主题
            this.disableThemePreview();
        }
    }
    
    // 停用主题预览
    disableThemePreview() {
        const currentTheme = this.settings.theme || 'system';
        document.body.className = `theme-${currentTheme}`;
        
        // 移除所有预览事件监听器
        const selector = document.getElementById('themeSelector');
        if (selector) {
            selector.querySelectorAll('.theme-option').forEach(option => {
                const newOption = option.cloneNode(true);
                option.parentNode.replaceChild(newOption, option);
            });
            
            // 重新添加点击事件（仅点击事件，不包括hover预览）
            selector.querySelectorAll('.theme-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const theme = option.dataset.theme;
                    this.applyTheme(theme);
                    this.settings.theme = theme;
                    this.storage.saveSettings(this.settings);
                    this.hideThemeSelector();
                });
            });
        }
    }
    
    // 更新主题选择器状态
    updateThemeSelector() {
        const selector = document.getElementById('themeSelector');
        if (!selector) return;
        
        const currentTheme = this.settings.theme || 'system';
        
        selector.querySelectorAll('.theme-option').forEach(option => {
            if (option.dataset.theme === currentTheme) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }
    
    // 应用主题
    applyTheme(theme) {
        this.settings.theme = theme;
        this.storage.saveSettings(this.settings);
        document.body.className = `theme-${theme}`;
        this.updateThemeSelector();
    }
    
    // 显示通知
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: var(--${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'}-color);
            color: white;
            border-radius: 6px;
            z-index: 9999;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // 自动移除
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 在系统浏览器中打开链接
    openExternalLink(url) {
        if (window.electronAPI && window.electronAPI.openExternal) {
            window.electronAPI.openExternal(url);
        } else {
            // 备用方案
            window.open(url, '_blank');
        }
    }
    
    // 初始化外部链接处理
    initExternalLinkHandlers() {
        // 为所有链接添加外部打开功能（除了预览区域）
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (link && !link.closest('.preview-content')) {
                const href = link.getAttribute('href');
                if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                    e.preventDefault();
                    this.openExternalLink(href);
                }
            }
        });
    }
    
    // 为预览区域绑定链接处理
    bindPreviewLinks() {
        if (!this.previewContent) return;
        // 若已绑定过委托，则不重复
        if (this._previewLinkDelegated) return;
        this._previewLinkDelegated = true;
        this.previewContent.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;
            let href = link.getAttribute('href');
            if (!href) return;
            // 忽略纯锚点（# 或 #id）——若也要外部打开可移除此判断
            if (href.trim().startsWith('#')) {
                e.preventDefault();
                return; // 保持页面不跳转（预览内部锚点功能可后续实现）
            }
            e.preventDefault();
            e.stopPropagation();
            // 如果没有协议前缀且不包含 '://'，尝试补全为 https://
            if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) {
                // 可能是形如 example.com / www.example.com / docs/path
                // 简单规则：如果含有空格，先编码；若以 // 开头则补 https:；否则前置 https://
                href = href.trim();
                if (href.startsWith('//')) {
                    href = 'https:' + href; // 协议相对 URL
                } else {
                    // 对本地相对路径也会这样处理；若需要本地文件策略可后续扩展
                    href = 'https://' + href.replace(/^\/+/, '');
                }
            }
            this.openExternalLink(href);
        });
    }
    
    // 本地存储相关方法
    loadEntries() {
        this.entries = this.storage.loadEntries();
        this.renderEntriesList();
    }
}

// 初始化应用
let app;
document.addEventListener('DOMContentLoaded', () => {
    // 初始化主题管理器
    window.themeManager = new ThemeManager();
    window.themeManager.init();
    
    // 初始化应用
    app = new ArtiMeowApp();
});

// 导出到全局作用域供其他脚本使用
window.ArtiMeowApp = ArtiMeowApp;
