// 修复后的设置管理器
class SettingsManager {
    constructor() {
        this.storage = new StorageManager();
        this.settings = this.storage.loadSettings();
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadSettings();
    }
    
    setupEventListeners() {
        // 设置模态关闭
        const closeBtn = document.getElementById('closeSettingsModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeSettingsModal());
        }
        
        const backdrop = document.getElementById('settingsBackdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => this.closeSettingsModal());
        }
        
        // 标签页切换
        document.querySelectorAll('.settings-tabs .settings-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // AI服务类型切换
        const aiProvider = document.getElementById('aiProvider');
        if (aiProvider) {
            aiProvider.addEventListener('change', (e) => {
                this.showAIConfig(e.target.value);
            });
        }
        
        // 测试连接按钮
        const testOllamaBtn = document.getElementById('testOllamaBtn');
        if (testOllamaBtn) {
            testOllamaBtn.addEventListener('click', () => this.testOllamaConnection());
        }
        
        const testOpenaiBtn = document.getElementById('testOpenaiBtn');
        if (testOpenaiBtn) {
            testOpenaiBtn.addEventListener('click', () => this.testOpenAIConnection());
        }
        
        // 保存设置
        const saveBtn = document.getElementById('saveSettingsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }
        
        // 主题选择
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.applyTheme(e.target.value);
            });
        }
        
        // 壁纸设置
        const wallpaperToggle = document.getElementById('wallpaperEnabled');
        if (wallpaperToggle) {
            wallpaperToggle.addEventListener('change', (e) => {
                this.toggleWallpaper(e.target.checked);
            });
        }
    }
    
    switchTab(tabName) {
        // 移除所有活动状态
        document.querySelectorAll('.settings-tabs .settings-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // 激活当前标签
        const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}Tab`);
        
        if (tabBtn && tabContent) {
            tabBtn.classList.add('active');
            tabContent.classList.add('active');
        }
    }
    
    closeSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    showAIConfig(provider) {
        // 隐藏所有配置
        document.querySelectorAll('.ai-config').forEach(config => {
            config.style.display = 'none';
        });
        
        // 显示选中的配置
        const selectedConfig = document.querySelector(`.${provider}-config`);
        if (selectedConfig) {
            selectedConfig.style.display = 'block';
        }
    }
    
    loadSettings() {
        // 加载AI设置
        if (this.settings.aiProvider) {
            const aiProvider = document.getElementById('aiProvider');
            if (aiProvider) {
                aiProvider.value = this.settings.aiProvider;
                this.showAIConfig(this.settings.aiProvider);
            }
        }
        
        // 加载Ollama设置
        if (this.settings.ollamaUrl) {
            const ollamaUrl = document.getElementById('ollamaUrl');
            if (ollamaUrl) ollamaUrl.value = this.settings.ollamaUrl;
        }
        
        if (this.settings.ollamaModel) {
            const ollamaModel = document.getElementById('ollamaModel');
            if (ollamaModel) ollamaModel.value = this.settings.ollamaModel;
        }
        
        // 加载OpenAI设置
        if (this.settings.openaiUrl) {
            const openaiUrl = document.getElementById('openaiUrl');
            if (openaiUrl) openaiUrl.value = this.settings.openaiUrl;
        }
        
        if (this.settings.openaiKey) {
            const openaiKey = document.getElementById('openaiKey');
            if (openaiKey) openaiKey.value = this.settings.openaiKey;
        }
        
        if (this.settings.openaiModel) {
            const openaiModel = document.getElementById('openaiModel');
            if (openaiModel) openaiModel.value = this.settings.openaiModel;
        }
        
        // 加载主题设置
        if (this.settings.theme) {
            const themeSelect = document.getElementById('themeSelect');
            if (themeSelect) themeSelect.value = this.settings.theme;
        }
        
        // 加载壁纸设置
        this.loadWallpaperSettings();
    }
    
    async loadWallpaperSettings() {
        try {
            if (window.electronAPI && window.electronAPI.getWallpaperStatus) {
                const isEnabled = await window.electronAPI.getWallpaperStatus();
                const wallpaperToggle = document.getElementById('wallpaperEnabled');
                if (wallpaperToggle) {
                    wallpaperToggle.checked = isEnabled;
                }
            }
        } catch (error) {
            console.error('加载壁纸设置失败:', error);
        }
    }
    
    async toggleWallpaper(enabled) {
        try {
            if (window.electronAPI && window.electronAPI.toggleWallpaper) {
                await window.electronAPI.toggleWallpaper(enabled);
                this.showNotification(
                    enabled ? '壁纸已启用' : '壁纸已禁用',
                    'success'
                );
            }
        } catch (error) {
            console.error('切换壁纸失败:', error);
            this.showNotification('壁纸操作失败', 'error');
        }
    }
    
    async testOllamaConnection() {
        const url = document.getElementById('ollamaUrl').value;
        const model = document.getElementById('ollamaModel').value;
        
        try {
            const response = await fetch(`${url}/api/tags`);
            if (response.ok) {
                this.showStatus('Ollama 连接成功！', 'success');
            } else {
                this.showStatus('Ollama 连接失败', 'error');
            }
        } catch (error) {
            this.showStatus('连接失败: ' + error.message, 'error');
        }
    }
    
    async testOpenAIConnection() {
        const url = document.getElementById('openaiUrl').value;
        const key = document.getElementById('openaiKey').value;
        const model = document.getElementById('openaiModel').value;
        
        try {
            const response = await fetch(`${url}/models`, {
                headers: {
                    'Authorization': `Bearer ${key}`
                }
            });
            
            if (response.ok) {
                this.showStatus('OpenAI API 连接成功！', 'success');
            } else {
                this.showStatus('OpenAI API 连接失败', 'error');
            }
        } catch (error) {
            this.showStatus('连接失败: ' + error.message, 'error');
        }
    }
    
    showStatus(message, type) {
        // 创建状态提示
        const status = document.createElement('div');
        status.className = `status-message ${type}`;
        status.textContent = message;
        
        // 添加到页面
        document.body.appendChild(status);
        
        // 3秒后移除
        setTimeout(() => {
            status.remove();
        }, 3000);
    }
    
    applyTheme(theme) {
        if (window.themeManager) {
            window.themeManager.setTheme(theme);
        }
        this.settings.theme = theme;
        this.storage.saveSettings(this.settings);
    }
    
    saveSettings() {
        // 收集所有设置
        const settings = {
            aiProvider: document.getElementById('aiProvider')?.value || 'ollama',
            ollamaUrl: document.getElementById('ollamaUrl')?.value || 'http://localhost:11434',
            ollamaModel: document.getElementById('ollamaModel')?.value || 'llama2',
            openaiUrl: document.getElementById('openaiUrl')?.value || 'https://api.openai.com/v1',
            openaiKey: document.getElementById('openaiKey')?.value || '',
            openaiModel: document.getElementById('openaiModel')?.value || 'gpt-3.5-turbo',
            theme: document.getElementById('themeSelect')?.value || 'system'
        };
        
        // 保存设置
        this.storage.saveSettings(settings);
        this.settings = settings;
        
        this.showStatus('设置已保存', 'success');
        
        // 延迟关闭模态
        setTimeout(() => {
            this.closeSettingsModal();
        }, 1000);
    }
    
    showNotification(message, type = 'info') {
        // 创建简单的通知
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// 初始化设置管理器
let settingsManager;

document.addEventListener('DOMContentLoaded', () => {
    settingsManager = new SettingsManager();
});

// 导出给外部使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsManager;
}
