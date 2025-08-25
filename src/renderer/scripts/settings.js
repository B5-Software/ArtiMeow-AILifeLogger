// 设置页面逻辑
class SettingsManager {
    constructor() {
        this.storage = new StorageManager();
        this.settings = this.storage.loadSettings();
        this.systemInfo = null;
        
        this.init();
    }
    
    async init() {
        await this.loadSystemInfo();
        this.setupEventListeners();
        this.loadSettings();
        this.updateUI();
    }
    
    async loadSystemInfo() {
        if (window.electronAPI) {
            try {
                this.systemInfo = await window.electronAPI.getSystemInfo();
            } catch (error) {
                console.error('获取系统信息失败:', error);
            }
        }
    }
    
    setupEventListeners() {
        // 选项卡切换
        document.querySelectorAll('.settings-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // 关闭设置模态
        document.getElementById('closeSettingsModal').addEventListener('click', () => {
            this.closeSettingsModal();
        });
        
        document.getElementById('settingsBackdrop').addEventListener('click', () => {
            this.closeSettingsModal();
        });
        
        // AI服务类型切换
        const aiProviderSelect = document.getElementById('aiProvider');
        if (aiProviderSelect) {
            aiProviderSelect.addEventListener('change', (e) => {
                this.showAIConfig(e.target.value);
            });
        }
        
        // 测试连接按钮
        const testOllamaBtn = document.getElementById('testOllamaBtn');
        if (testOllamaBtn) {
            testOllamaBtn.addEventListener('click', () => {
                this.testOllamaConnection();
            });
        }
        
        const testOpenaiBtn = document.getElementById('testOpenaiBtn');
        if (testOpenaiBtn) {
            testOpenaiBtn.addEventListener('click', () => {
                this.testOpenAIConnection();
            });
        }
        
        const testCustomBtn = document.getElementById('testCustomBtn');
        if (testCustomBtn) {
            testCustomBtn.addEventListener('click', () => {
                this.testCustomConnection();
            });
        }
        
        // 保存设置按钮
        const saveSettingsBtn = document.getElementById('saveSettingsBtn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                this.saveSettings();
            });
        }

        // 取消按钮
        const cancelBtn = document.getElementById('cancelSettingsBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeSettingsModal());
        }

        // 主题选择
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) themeSelect.addEventListener('change', e => this.applyTheme(e.target.value));

        // 关于页动作
        const refreshBtn = document.getElementById('refreshInfoBtn');
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshSystemInfo());
        const openGitBtn = document.getElementById('openGithubBtn');
        if (openGitBtn) openGitBtn.addEventListener('click', () => this.openGitHub());
        const githubLink = document.getElementById('githubLink');
        if (githubLink) githubLink.addEventListener('click', (e) => { e.preventDefault(); this.openGitHub(); });

        // 设置选项卡切换事件
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            settingsModal.querySelectorAll('.settings-tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tab = e.target.dataset.tab;
                    if (tab) this.switchTab(tab);
                });
            });
        }
    }
    
    switchTab(tabName) {
        // 只在设置模态框内切换选项卡
        const settingsModal = document.getElementById('settingsModal');
        if (!settingsModal) return;
        
        // 切换设置选项卡按钮 - 使用专门的settings-tab-btn类
        settingsModal.querySelectorAll('.settings-tabs .settings-tab-btn').forEach(btn => btn.classList.remove('active'));
        const btn = settingsModal.querySelector(`.settings-tabs .settings-tab-btn[data-tab="${tabName}"]`);
        if (btn) btn.classList.add('active');
        
        // 切换设置选项卡内容
        settingsModal.querySelectorAll('.settings-tab').forEach(tab => tab.classList.remove('active'));
        const tabEl = settingsModal.querySelector(`#${tabName}Tab`);
        if (tabEl) tabEl.classList.add('active');
    }

    closeSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) modal.style.display = 'none';
    }
    
    showAIConfig(provider) {
        // 隐藏所有配置
        document.querySelectorAll('.ai-config').forEach(config => {
            config.style.display = 'none';
        });
        
        // 显示选中的配置
        const configClass = `${provider}-config`;
        const configElement = document.querySelector(`.${configClass}`);
        if (configElement) {
            configElement.style.display = 'block';
        }
    }
    
    loadSettings() {
        // AI配置 - 添加安全检查
        const aiProviderEl = document.getElementById('aiProvider');
        if (aiProviderEl) aiProviderEl.value = this.settings.aiProvider;
        
        const ollamaUrlEl = document.getElementById('ollamaUrl');
        if (ollamaUrlEl) ollamaUrlEl.value = this.settings.ollamaUrl;
        
        const ollamaModelEl = document.getElementById('ollamaModel');
        if (ollamaModelEl) ollamaModelEl.value = this.settings.ollamaModel;
        
        const openaiUrlEl = document.getElementById('openaiUrl');
        if (openaiUrlEl) openaiUrlEl.value = this.settings.openaiUrl;
        
        const openaiKeyEl = document.getElementById('openaiKey');
        if (openaiKeyEl) openaiKeyEl.value = this.settings.openaiKey;
        
        const openaiModelEl = document.getElementById('openaiModel');
        if (openaiModelEl) openaiModelEl.value = this.settings.openaiModel;
        
        const customUrlEl = document.getElementById('customUrl');
        if (customUrlEl) customUrlEl.value = this.settings.customUrl;
        
        const customKeyEl = document.getElementById('customKey');
        if (customKeyEl) customKeyEl.value = this.settings.customKey;
        
        const customModelEl = document.getElementById('customModel');
        if (customModelEl) customModelEl.value = this.settings.customModel;
        
        // AI行为设置 - 添加安全检查
        const autoSummaryEl = document.getElementById('autoSummary');
        if (autoSummaryEl) autoSummaryEl.checked = this.settings.autoSummary;
        
        const weeklyPlanningEl = document.getElementById('weeklyPlanning');
        if (weeklyPlanningEl) weeklyPlanningEl.checked = this.settings.weeklyPlanning;
        
        const mermaidSuggestionEl = document.getElementById('mermaidSuggestion');
        if (mermaidSuggestionEl) mermaidSuggestionEl.checked = this.settings.mermaidSuggestion;
        
        // 外观设置 - 添加安全检查
        const themeSelectEl = document.getElementById('themeSelect');
        if (themeSelectEl) themeSelectEl.value = this.settings.theme;
        
        const fontSizeEl = document.getElementById('fontSize');
        if (fontSizeEl) fontSizeEl.value = this.settings.fontSize;
        
        const lineNumbersEl = document.getElementById('lineNumbers');
        if (lineNumbersEl) lineNumbersEl.checked = this.settings.lineNumbers;
        
        const wordWrapEl = document.getElementById('wordWrap');
        if (wordWrapEl) wordWrapEl.checked = this.settings.wordWrap;
        
        // 显示相应的AI配置
        this.showAIConfig(this.settings.aiProvider);
    }
    
    updateUI() {
        if (this.systemInfo) {
            // 更新关于页面的系统信息
            document.getElementById('appName').textContent = this.systemInfo.productName || this.systemInfo.name;
            document.getElementById('appVersion').textContent = `版本 ${this.systemInfo.version}`;
            document.getElementById('platformInfo').textContent = this.systemInfo.platform;
            document.getElementById('archInfo').textContent = this.systemInfo.arch;
            document.getElementById('nodeVersion').textContent = this.systemInfo.nodeVersion;
            document.getElementById('electronVersion').textContent = this.systemInfo.electronVersion;
            document.getElementById('packaged').textContent = this.systemInfo.isDev ? '开发模式' : '已打包';
            document.getElementById('execPath').textContent = this.systemInfo.execPath;
            document.getElementById('licenseInfo').textContent = this.systemInfo.license;
        }
    }
    
    async testOllamaConnection() {
        const btn = document.getElementById('testOllamaBtn');
        const url = document.getElementById('ollamaUrl').value;
        const model = document.getElementById('ollamaModel').value;
        
        btn.disabled = true;
        btn.textContent = '测试中...';
        
        try {
            const response = await fetch(`${url}/api/tags`);
            if (response.ok) {
                const data = await response.json();
                const models = data.models || [];
                const hasModel = models.some(m => m.name === model);
                
                if (hasModel) {
                    this.showStatus('Ollama连接成功！', 'success');
                } else {
                    this.showStatus(`连接成功，但未找到模型 ${model}`, 'warning');
                }
            } else {
                this.showStatus('Ollama连接失败', 'error');
            }
        } catch (error) {
            this.showStatus(`连接错误: ${error.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '测试连接';
        }
    }
    
    async testOpenAIConnection() {
        const btn = document.getElementById('testOpenaiBtn');
        const url = document.getElementById('openaiUrl').value;
        const key = document.getElementById('openaiKey').value;
        
        if (!key) {
            this.showStatus('请输入API Key', 'error');
            return;
        }
        
        btn.disabled = true;
        btn.textContent = '测试中...';
        
        try {
            const response = await fetch(`${url}/models`, {
                headers: {
                    'Authorization': `Bearer ${key}`
                }
            });
            
            if (response.ok) {
                this.showStatus('OpenAI API连接成功！', 'success');
            } else {
                this.showStatus(`连接失败: ${response.status}`, 'error');
            }
        } catch (error) {
            this.showStatus(`连接错误: ${error.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '测试连接';
        }
    }
    
    async testCustomConnection() {
        const btn = document.getElementById('testCustomBtn');
        const url = document.getElementById('customUrl').value;
        const key = document.getElementById('customKey').value;
        
        if (!url) {
            this.showStatus('请输入API地址', 'error');
            return;
        }
        
        btn.disabled = true;
        btn.textContent = '测试中...';
        
        try {
            const headers = {};
            if (key) {
                headers['Authorization'] = `Bearer ${key}`;
            }
            
            const response = await fetch(`${url}/models`, { headers });
            
            if (response.ok) {
                this.showStatus('自定义API连接成功！', 'success');
            } else {
                this.showStatus(`连接失败: ${response.status}`, 'error');
            }
        } catch (error) {
            this.showStatus(`连接错误: ${error.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '测试连接';
        }
    }
    
    showStatus(message, type) {
        // 创建状态提示
        const statusDiv = document.createElement('div');
        statusDiv.className = `status-indicator ${type}`;
        statusDiv.textContent = message;
        
        // 移除现有状态
        document.querySelectorAll('.status-indicator').forEach(el => el.remove());
        
        // 添加到合适的位置
        const activeTab = document.querySelector('.settings-tab.active');
        if (activeTab) {
            activeTab.insertBefore(statusDiv, activeTab.firstChild);
            
            // 自动移除
            setTimeout(() => {
                statusDiv.remove();
            }, 5000);
        }
    }
    
    applyTheme(theme) {
        if (window.themeManager) {
            window.themeManager.setTheme(theme);
        }
    }
    
    saveSettings() {
        // 收集所有设置 - 添加安全检查
        const newSettings = {
            // AI配置
            aiProvider: document.getElementById('aiProvider')?.value || 'ollama',
            ollamaUrl: document.getElementById('ollamaUrl')?.value || 'http://localhost:11434',
            ollamaModel: document.getElementById('ollamaModel')?.value || 'llama2',
            openaiUrl: document.getElementById('openaiUrl')?.value || 'https://api.openai.com/v1',
            openaiKey: document.getElementById('openaiKey')?.value || '',
            openaiModel: document.getElementById('openaiModel')?.value || 'gpt-3.5-turbo',
            customUrl: document.getElementById('customUrl')?.value || '',
            customKey: document.getElementById('customKey')?.value || '',
            customModel: document.getElementById('customModel')?.value || '',
            
            // AI行为
            autoSummary: document.getElementById('autoSummary')?.checked ?? true,
            weeklyPlanning: document.getElementById('weeklyPlanning')?.checked ?? true,
            mermaidSuggestion: document.getElementById('mermaidSuggestion')?.checked ?? true,
            
            // 外观
            theme: document.getElementById('themeSelect')?.value || 'system',
            fontSize: document.getElementById('fontSize')?.value || '14',
            lineNumbers: document.getElementById('lineNumbers')?.checked ?? true,
            wordWrap: document.getElementById('wordWrap')?.checked ?? true
        };
        
        // 保存设置
        if (this.storage.saveSettings(newSettings)) {
            this.settings = newSettings;
            this.showStatus('设置已保存', 'success');
            
            // 应用主题变化
            this.applyTheme(newSettings.theme);
            
            // 延迟关闭窗口
            setTimeout(() => {
                this.closeSettingsModal();
            }, 1000);
        } else {
            this.showStatus('保存失败', 'error');
        }
    }
    
    async refreshSystemInfo() {
        const btn = document.getElementById('refreshInfoBtn');
        btn.disabled = true;
        btn.textContent = '刷新中...';
        
        try {
            await this.loadSystemInfo();
            this.updateUI();
            this.showStatus('系统信息已刷新', 'success');
        } catch (error) {
            this.showStatus('刷新失败', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '刷新版本信息';
        }
    }
    
    openGitHub() {
        if (window.electronAPI) {
            window.electronAPI.openExternal('https://github.com/B5-Software/ArtiMeow-AILifeLogger');
        } else {
            window.open('https://github.com/B5-Software/ArtiMeow-AILifeLogger', '_blank');
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
    
    // 初始化主题管理器
    window.themeManager = new ThemeManager();
    window.themeManager.init();
});
