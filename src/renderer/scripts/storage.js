// 本地存储管理
class StorageManager {
    constructor() {
        this.storageKeys = {
            entries: 'artimeow-entries',
            settings: 'artimeow-settings',
            userPreferences: 'artimeow-preferences'
        };
    }
    
    // 记录存储
    saveEntries(entries) {
        try {
            localStorage.setItem(this.storageKeys.entries, JSON.stringify(entries));
            return true;
        } catch (error) {
            console.error('保存记录失败:', error);
            return false;
        }
    }
    
    loadEntries() {
        try {
            const stored = localStorage.getItem(this.storageKeys.entries);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('加载记录失败:', error);
        }
        return [];
    }
    
    // 设置存储
    saveSettings(settings) {
        try {
            localStorage.setItem(this.storageKeys.settings, JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error('保存设置失败:', error);
            return false;
        }
    }
    
    loadSettings() {
        try {
            const stored = localStorage.getItem(this.storageKeys.settings);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
        
        // 返回默认设置
        return {
            theme: 'system',
            aiProvider: 'ollama',
            ollamaUrl: 'http://localhost:11434',
            ollamaModel: 'llama2',
            openaiUrl: 'https://api.openai.com/v1',
            openaiKey: '',
            openaiModel: 'gpt-3.5-turbo',
            customUrl: '',
            customKey: '',
            customModel: '',
            autoSummary: true,
            weeklyPlanning: true,
            mermaidSuggestion: true,
            fontSize: '14',
            lineNumbers: true,
            wordWrap: true
        };
    }
    
    // 用户偏好存储
    savePreferences(preferences) {
        try {
            localStorage.setItem(this.storageKeys.userPreferences, JSON.stringify(preferences));
            return true;
        } catch (error) {
            console.error('保存用户偏好失败:', error);
            return false;
        }
    }
    
    loadPreferences() {
        try {
            const stored = localStorage.getItem(this.storageKeys.userPreferences);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('加载用户偏好失败:', error);
        }
        
        return {
            sidebarWidth: 300,
            lastSelectedEntryId: null,
            lastTabSelected: 'editor'
        };
    }
    
    // 导出数据
    exportData() {
        const data = {
            entries: this.loadEntries(),
            settings: this.loadSettings(),
            preferences: this.loadPreferences(),
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };
        
        return JSON.stringify(data, null, 2);
    }
    
    // 导入数据
    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (data.entries) {
                this.saveEntries(data.entries);
            }
            
            if (data.settings) {
                this.saveSettings(data.settings);
            }
            
            if (data.preferences) {
                this.savePreferences(data.preferences);
            }
            
            return true;
        } catch (error) {
            console.error('导入数据失败:', error);
            return false;
        }
    }
    
    // 清空所有数据
    clearAllData() {
        try {
            Object.values(this.storageKeys).forEach(key => {
                localStorage.removeItem(key);
            });
            return true;
        } catch (error) {
            console.error('清空数据失败:', error);
            return false;
        }
    }
    
    // 获取存储使用情况
    getStorageUsage() {
        let totalSize = 0;
        const usage = {};
        
        Object.entries(this.storageKeys).forEach(([name, key]) => {
            const data = localStorage.getItem(key);
            const size = data ? new Blob([data]).size : 0;
            usage[name] = {
                size: size,
                readable: this.formatBytes(size)
            };
            totalSize += size;
        });
        
        return {
            total: {
                size: totalSize,
                readable: this.formatBytes(totalSize)
            },
            breakdown: usage
        };
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 导出到全局作用域
window.StorageManager = StorageManager;
