// 主题管理
class ThemeManager {
    constructor() {
        this.themes = ['system', 'light', 'dark'];
        this.currentTheme = 'system';
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // 监听系统主题变化
        this.mediaQuery.addEventListener('change', (e) => {
            if (this.currentTheme === 'system') {
                this.updateThemeDisplay();
            }
        });
    }
    
    setTheme(theme) {
        if (!this.themes.includes(theme)) {
            console.warn(`未知主题: ${theme}, 使用默认主题 system`);
            theme = 'system';
        }
        
        this.currentTheme = theme;
        this.updateThemeDisplay();
        this.updateThemeIcon();
        
        // 通知主进程更新主题并同步到其他窗口
        if (window.require) {
            try {
                const { ipcRenderer } = require('electron');
                ipcRenderer.invoke('set-theme', theme);
            } catch (error) {
                console.error('主题同步失败:', error);
            }
        }
        
        // 保存到本地存储
        const storage = new StorageManager();
        const settings = storage.loadSettings();
        settings.theme = theme;
        storage.saveSettings(settings);
        
        console.log(`主题管理器：主题已切换至 ${theme}`);
    }
    
    getTheme() {
        return this.currentTheme;
    }
    
    getEffectiveTheme() {
        if (this.currentTheme === 'system') {
            return this.mediaQuery.matches ? 'dark' : 'light';
        }
        return this.currentTheme;
    }
    
    updateThemeDisplay() {
        const body = document.body;
        const effectiveTheme = this.getEffectiveTheme();
        
        // 清除所有现有主题类
        body.className = body.className.replace(/theme-\w+/g, '');
        
        // 应用当前主题类
        body.className += ` theme-${this.currentTheme}`;
        
        // 更新CSS变量（如果需要）
        this.updateCSSVariables(effectiveTheme);
        
        // 触发主题变化事件
        this.dispatchThemeChangeEvent(effectiveTheme);
        
        console.log(`主题显示已更新: ${this.currentTheme} (有效主题: ${effectiveTheme})`);
    }
    
    updateCSSVariables(theme) {
        const root = document.documentElement;
        
        // 这里可以根据需要动态更新CSS变量
        // 当前通过CSS类已经足够，但保留此方法以备将来使用
        
        if (theme === 'dark') {
            root.style.setProperty('--scrollbar-track', '#2d3748');
            root.style.setProperty('--scrollbar-thumb', '#4a5568');
        } else {
            root.style.setProperty('--scrollbar-track', '#f1f1f1');
            root.style.setProperty('--scrollbar-thumb', '#c1c1c1');
        }
    }
    
    updateThemeIcon() {
        const themeIcon = document.querySelector('.theme-icon');
        if (!themeIcon) return;
        
        // 图标通过CSS类自动更新，这里可以添加额外的逻辑
        const button = themeIcon.closest('button');
        if (button) {
            button.title = this.getThemeTooltip();
        }
    }
    
    getThemeTooltip() {
        const tooltips = {
            system: '跟随系统主题',
            light: '浅色主题',
            dark: '深色主题'
        };
        return tooltips[this.currentTheme] || '切换主题';
    }
    
    toggleTheme() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % this.themes.length;
        const nextTheme = this.themes[nextIndex];
        
        this.setTheme(nextTheme);
    }
    
    dispatchThemeChangeEvent(effectiveTheme) {
        const event = new CustomEvent('themechange', {
            detail: {
                theme: this.currentTheme,
                effectiveTheme: effectiveTheme
            }
        });
        
        window.dispatchEvent(event);
    }
    
    // 初始化主题
    init() {
        const storage = new StorageManager();
        const settings = storage.loadSettings();
        const savedTheme = settings.theme || 'system';
        
        this.setTheme(savedTheme);
    }
    
    // 获取主题统计信息
    getThemeInfo() {
        return {
            current: this.currentTheme,
            effective: this.getEffectiveTheme(),
            systemDark: this.mediaQuery.matches,
            available: this.themes
        };
    }
}

// 主题变化监听器
window.addEventListener('themechange', (e) => {
    const { effectiveTheme } = e.detail;
    
    // 更新Mermaid主题
    if (window.mermaid) {
        mermaid.initialize({
            startOnLoad: true,
            theme: effectiveTheme === 'dark' ? 'dark' : 'default',
            themeVariables: {
                primaryColor: effectiveTheme === 'dark' ? '#4fc3f7' : '#007acc',
                primaryTextColor: '#ffffff',
                primaryBorderColor: effectiveTheme === 'dark' ? '#29b6f6' : '#005a9e',
                lineColor: effectiveTheme === 'dark' ? '#718096' : '#6c757d',
                sectionBkColor: effectiveTheme === 'dark' ? 'rgba(79, 195, 247, 0.1)' : 'rgba(0, 122, 204, 0.1)',
                altSectionBkColor: effectiveTheme === 'dark' ? 'rgba(79, 195, 247, 0.05)' : 'rgba(0, 122, 204, 0.05)',
                gridColor: effectiveTheme === 'dark' ? '#4a5568' : '#dee2e6',
                secondaryColor: effectiveTheme === 'dark' ? '#2d3748' : '#f8f9fa',
                tertiaryColor: effectiveTheme === 'dark' ? '#1a202c' : '#ffffff'
            }
        });
    }
    
    // 更新代码高亮主题
    updateCodeHighlightTheme(effectiveTheme);
});

function updateCodeHighlightTheme(theme) {
    const lightThemeLink = document.querySelector('link[href*="github.min.css"]');
    const darkThemeLink = document.querySelector('link[href*="github-dark.min.css"]');
    
    if (lightThemeLink && darkThemeLink) {
        if (theme === 'dark') {
            lightThemeLink.disabled = true;
            darkThemeLink.disabled = false;
        } else {
            lightThemeLink.disabled = false;
            darkThemeLink.disabled = true;
        }
    }
}

// 导出到全局作用域
window.ThemeManager = ThemeManager;
