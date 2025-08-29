const { app, BrowserWindow, Menu, ipcMain, dialog, shell, nativeTheme, Tray, screen } = require('electron');

// 防止重复打开
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
const path = require('path');
const fs = require('fs');
const os = require('os');
const { attach, detach, refresh } = require('electron-as-wallpaper');

let mainWindow;
let quadrantWindow;
let reminderWindow;
let wallpaperWindow;
let tray;
// 记录最近一次提醒窗口任务签名，避免重复创建导致 ready-to-show race
let lastReminderSignature = null;
let wallpaperEnabled = false;

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // 无边框窗口
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 窗口准备好后显示，避免闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // 创建系统托盘
    createTray();
    
    // 延迟检查重要任务提醒
    setTimeout(() => {
      mainWindow.webContents.send('check-urgent-tasks-reminder');
    }, 2000);
  });

  // 开发模式下打开开发者工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // 窗口关闭时隐藏到托盘而不是退出
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // 创建菜单
  createMenu();
}

// 创建四象限任务管理窗口
function createQuadrantWindow() {
  // 如果窗口已存在，直接聚焦
  if (quadrantWindow && !quadrantWindow.isDestroyed()) {
    quadrantWindow.focus();
    return quadrantWindow;
  }

  quadrantWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    title: '四象限任务管理 - ArtiMeow',
    frame: false, // 无边框窗口
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    // parent: mainWindow, // 移除parent设置，让窗口独立
    modal: false,
    skipTaskbar: false // 确保在任务栏显示
  });

  quadrantWindow.loadFile(path.join(__dirname, 'renderer', 'quadrant-window.html'));

  // 窗口准备好后显示
  quadrantWindow.once('ready-to-show', () => {
    quadrantWindow.show();
  });

  // 窗口关闭时清理引用
  quadrantWindow.on('closed', () => {
    quadrantWindow = null;
  });

  return quadrantWindow;
}

// 创建壁纸窗口
function createWallpaperWindow() {
  try {
    // 获取主屏幕分辨率
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    
    console.log(`创建壁纸窗口，分辨率: ${width}x${height}`);
    
    wallpaperWindow = new BrowserWindow({
      width: width,
      height: height,
      x: 0,
      y: 0,
      frame: false,
      transparent: false,
      alwaysOnTop: false,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      show: false
    });

    wallpaperWindow.loadFile(path.join(__dirname, 'renderer', 'wallpaper.html'));

    wallpaperWindow.once('ready-to-show', () => {
      if (wallpaperEnabled) {
        wallpaperWindow.show();
        // 设置为壁纸
        attach(wallpaperWindow);
        console.log('壁纸窗口已创建并设置');
        
        // 定期更新壁纸数据
        updateWallpaperData();
        setInterval(updateWallpaperData, 30000); // 30秒更新一次
      }
    });

    wallpaperWindow.on('closed', () => {
      wallpaperWindow = null;
    });

    return wallpaperWindow;
  } catch (error) {
    console.error('创建壁纸窗口失败:', error);
    return null;
  }
}

// 启用/禁用壁纸
function enableWallpaper(enabled) {
  wallpaperEnabled = enabled;
  
  if (enabled) {
    if (!wallpaperWindow || wallpaperWindow.isDestroyed()) {
      createWallpaperWindow();
    } else {
      wallpaperWindow.show();
      attach(wallpaperWindow);
    }
  } else {
    if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
      detach(wallpaperWindow);
      wallpaperWindow.hide();
    }
  }
  
  // 保存设置
  saveWallpaperSettings();
}

// 更新壁纸数据
function updateWallpaperData() {
  if (!wallpaperWindow || wallpaperWindow.isDestroyed()) return;
  
  try {
    // 从主窗口获取任务数据和主题设置
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 获取任务数据
      mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            const tasks = JSON.parse(localStorage.getItem('quadrantTasks') || '[]');
            const settings = JSON.parse(localStorage.getItem('settings') || '{}');
            return {
              tasks: tasks,
              theme: settings.theme || 'system'
            };
          } catch (e) {
            console.error('读取数据失败:', e);
            return { tasks: [], theme: 'system' };
          }
        })()
      `).then(data => {
        console.log('获取到壁纸数据:', { taskCount: data.tasks.length, theme: data.theme });
        // 发送数据到壁纸窗口
        wallpaperWindow.webContents.send('data-updated', data);
      }).catch(error => {
        console.error('获取壁纸数据失败:', error);
        // 发送默认数据
        wallpaperWindow.webContents.send('data-updated', { tasks: [], theme: 'system' });
      });
    }
  } catch (error) {
    console.error('更新壁纸数据失败:', error);
  }
}

// 保存壁纸设置
function saveWallpaperSettings() {
  const settingsPath = path.join(os.homedir(), '.artimeow-settings.json');
  try {
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    settings.wallpaperEnabled = wallpaperEnabled;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('保存壁纸设置失败:', error);
  }
}

// 加载壁纸设置
function loadWallpaperSettings() {
  const settingsPath = path.join(os.homedir(), '.artimeow-settings.json');
  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      wallpaperEnabled = settings.wallpaperEnabled || false;
      
      // 如果启用了壁纸，延迟创建
      if (wallpaperEnabled) {
        setTimeout(() => {
          enableWallpaper(true);
        }, 3000); // 延迟3秒确保主窗口已完全加载
      }
    }
  } catch (error) {
    console.error('加载壁纸设置失败:', error);
  }
}

// 创建重要任务提醒窗口
function createReminderWindow(tasks = []) {
  // 如果没有重要任务，不创建窗口
  if (!tasks || tasks.length === 0) return;

  // 生成签名用于去重（任务 id 优先，其次 title+deadline）
  const signature = tasks.map(t => `${t.id || t.title || ''}#${t.deadline || ''}`).join('|');
  if (reminderWindow && !reminderWindow.isDestroyed() && lastReminderSignature === signature) {
    // 内容相同且窗口仍在，直接聚焦即可
    try {
      reminderWindow.show();
      reminderWindow.focus();
    } catch (e) {
      // 忽略
    }
    return reminderWindow;
  }

  // 如果窗口已存在，先关闭
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.close();
  }

  reminderWindow = new BrowserWindow({
    width: 400,
    height: 300,
    minWidth: 350,
    minHeight: 250,
    maxWidth: 500,
    maxHeight: 400,
    frame: false, // 无边框
    titleBarStyle: 'hidden',
    alwaysOnTop: true, // 置顶
    resizable: true,
    movable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    show: false,
    skipTaskbar: false, // 显示在任务栏
    icon: path.join(__dirname, 'assets', 'icon.png'),
    // 窗口居中偏上显示
    x: Math.floor(mainWindow.getBounds().x + (mainWindow.getBounds().width - 400) / 2),
    y: Math.floor(mainWindow.getBounds().y + 100)
  });

  // 记录最新签名
  lastReminderSignature = signature;

  // 创建提醒窗口的HTML内容
  const reminderHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>重要任务提醒</title>
    <link rel="stylesheet" href="styles/themes.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-gradient, linear-gradient(135deg, #667eea 0%, #764ba2 100%));
            color: var(--text-color, white);
            overflow: hidden;
            user-select: none;
            transition: all 0.3s ease;
        }
        .reminder-container {
            height: 100vh;
            display: flex;
            flex-direction: column;
            position: relative;
        }
        .reminder-header {
            padding: 15px 20px 10px;
            background: var(--header-bg, rgba(255,255,255,0.1));
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.2));
            -webkit-app-region: drag;
        }
        .reminder-title {
            font-size: 16px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--text-color, white);
        }
        .reminder-subtitle {
            font-size: 12px;
            opacity: 0.8;
            margin-top: 2px;
            color: var(--text-color-secondary, rgba(255,255,255,0.8));
        }
        .close-btn {
            position: absolute;
            top: 10px;
            right: 15px;
            background: none;
            border: none;
            color: var(--text-color, white);
            font-size: 18px;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.2s;
            -webkit-app-region: no-drag;
        }
        .close-btn:hover { opacity: 1; }
        .reminder-content {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
        }
        .task-item {
            background: var(--task-bg, rgba(255,255,255,0.15));
            backdrop-filter: blur(5px);
            border-radius: 8px;
            padding: 12px 15px;
            margin-bottom: 10px;
            border-left: 4px solid var(--accent-color, #ff6b6b);
            transition: transform 0.2s;
        }
        .task-item:hover {
            transform: translateY(-2px);
            background: var(--task-bg-hover, rgba(255,255,255,0.2));
        }
        .task-title {
            font-weight: 600;
            margin-bottom: 4px;
            font-size: 14px;
            color: var(--text-color, white);
        }
        .task-deadline {
            font-size: 12px;
            opacity: 0.9;
            color: var(--text-color-secondary, rgba(255,255,255,0.9));
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .reminder-footer {
            padding: 15px 20px;
            background: var(--footer-bg, rgba(255,255,255,0.1));
            border-top: 1px solid var(--border-color, rgba(255,255,255,0.2));
            display: flex;
            gap: 10px;
            justify-content: space-between;
        }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s;
            background: var(--btn-bg, rgba(255,255,255,0.2));
            color: var(--btn-text, white);
            border: 1px solid var(--btn-border, rgba(255,255,255,0.3));
        }
        .btn:hover {
            background: var(--btn-bg-hover, rgba(255,255,255,0.3));
            transform: translateY(-1px);
        }
        .btn-primary {
            background: var(--btn-primary-bg, #4CAF50);
            border-color: var(--btn-primary-border, #4CAF50);
        }
        .btn-primary:hover {
            background: var(--btn-primary-bg-hover, #45a049);
        }
        .snooze-btn-container {
            position: relative;
        }
        .snooze-options {
            display: none;
            position: absolute;
            bottom: 100%;
            left: 0;
            background: var(--dropdown-bg, rgba(0,0,0,0.9));
            backdrop-filter: blur(10px);
            border-radius: 8px;
            padding: 8px;
            min-width: 150px;
            margin-bottom: 5px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            border: 1px solid var(--dropdown-border, rgba(255,255,255,0.2));
        }
        .snooze-options.show {
            display: block;
        }
        .snooze-option {
            display: block;
            width: 100%;
            padding: 8px 12px;
            background: none;
            border: none;
            color: var(--dropdown-text, white);
            text-align: left;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            margin-bottom: 2px;
            transition: background 0.2s;
        }
        .snooze-option:hover {
            background: var(--dropdown-option-hover, rgba(255,255,255,0.2));
        }
        .snooze-option:last-child {
            margin-bottom: 0;
        }
    </style>
</head>
<body class="theme-system reminder-window">
    <div class="reminder-container">
        <div class="reminder-header">
            <div class="reminder-title">
                🚨 重要任务提醒
            </div>
            <div class="reminder-subtitle">您有 ${tasks.length} 个重要紧急任务需要处理</div>
            <button class="close-btn" onclick="closeWindow()">&times;</button>
        </div>
        <div class="reminder-content">
            ${tasks.map(task => `
                <div class="task-item">
                    <div class="task-title">${task.title}</div>
                    <div class="task-deadline">
                        ⏰ ${task.deadline ? new Date(task.deadline).toLocaleDateString() : '无截止时间'}
                    </div>
                    ${task.daysLeft !== undefined ? `<div class="task-alert">📅 剩余 ${task.daysLeft} 天</div>` : ''}
                </div>
            `).join('')}
        </div>
        <div class="reminder-footer">
            <div class="snooze-btn-container">
                <button class="btn" onclick="toggleSnoozeOptions()">稍后提醒 ▼</button>
                <div class="snooze-options" id="snoozeOptions">
                    <button class="snooze-option" onclick="snoozeReminder(5)">5分钟后提醒</button>
                    <button class="snooze-option" onclick="snoozeReminder(10)">10分钟后提醒</button>
                    <button class="snooze-option" onclick="snoozeReminder(30)">30分钟后提醒</button>
                    <button class="snooze-option" onclick="snoozeReminder(60)">1小时后提醒</button>
                    <button class="snooze-option" onclick="snoozeReminder(120)">2小时后提醒</button>
                </div>
            </div>
            <button class="btn btn-primary" onclick="openQuadrantManager()">打开任务管理</button>
        </div>
    </div>
    <script>
        const { ipcRenderer } = require('electron');
        
        // 简化的主题管理
        class SimpleThemeManager {
            constructor() {
                this.currentTheme = 'system';
                this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                this.init();
            }
            
            init() {
                // 从主窗口获取当前主题
                ipcRenderer.invoke('get-current-theme').then(theme => {
                    this.setTheme(theme || 'system');
                });
                
                // 监听主题变化
                ipcRenderer.on('theme-changed', (event, theme) => {
                    this.setTheme(theme);
                });
                
                // 监听系统主题变化
                this.mediaQuery.addEventListener('change', () => {
                    if (this.currentTheme === 'system') {
                        this.updateThemeDisplay();
                    }
                });
            }
            
            setTheme(theme) {
                const validThemes = ['system', 'light', 'dark'];
                if (!validThemes.includes(theme)) {
                    console.warn('提醒窗口：无效的主题 ' + theme + ', 使用默认主题 system');
                    theme = 'system';
                }
                
                this.currentTheme = theme;
                this.updateThemeDisplay();
            }
            
            updateThemeDisplay() {
                const body = document.body;
                const effectiveTheme = this.getEffectiveTheme();
                
                // 清除所有现有主题类，保留其他类
                body.className = body.className.replace(/theme-\\w+/g, '');
                // 添加当前主题类和窗口标识类
                body.className += ' theme-' + this.currentTheme + ' reminder-window';
                body.setAttribute('data-effective-theme', effectiveTheme);
                
                console.log('提醒窗口主题已更新为: ' + this.currentTheme + ' (有效主题: ' + effectiveTheme + ')');
            }
            
            getEffectiveTheme() {
                if (this.currentTheme === 'system') {
                    return this.mediaQuery.matches ? 'dark' : 'light';
                }
                return this.currentTheme;
            }
        }
        
        // 初始化主题管理器
        const themeManager = new SimpleThemeManager();
        
        function closeWindow() {
            ipcRenderer.send('close-reminder-window');
        }
        
        function toggleSnoozeOptions() {
            const options = document.getElementById('snoozeOptions');
            options.classList.toggle('show');
        }
        
        function snoozeReminder(minutes) {
            ipcRenderer.send('snooze-reminder', minutes * 60 * 1000, minutes);
            closeWindow();
        }
        
        function openQuadrantManager() {
            ipcRenderer.send('open-quadrant-from-reminder');
            closeWindow();
        }
    </script>
</body>
</html>
  `;

  // 将HTML内容写入临时文件

  // 使用系统临时目录，避免asar只读问题
  const tempHtmlPath = path.join(require('os').tmpdir(), `artimeow-reminder-${Date.now()}.html`);
  fs.writeFileSync(tempHtmlPath, reminderHtml, 'utf8');

  reminderWindow.loadFile(tempHtmlPath);

  // 窗口准备好后显示
  reminderWindow.once('ready-to-show', () => {
    // 防止窗口在 ready 之前被关闭或变量被置空
    if (reminderWindow && !reminderWindow.isDestroyed()) {
      try {
        reminderWindow.show();
        reminderWindow.focus();
      } catch (e) {
        console.warn('提醒窗口 show 失败: ', e);
      }
    } else {
      console.warn('ready-to-show 触发时提醒窗口已不存在');
    }
  });

  // 窗口关闭时清理引用和临时文件
  reminderWindow.on('closed', () => {
    reminderWindow = null;
    lastReminderSignature = null;
    
    // 立即清理临时文件
    try { 
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath); 
      }
    } catch (e) {
      console.warn('清理临时文件失败:', e);
    }
  });

  return reminderWindow;
}

// 创建系统托盘
function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));
  
  // 托盘提示文本
  tray.setToolTip('ArtiMeow AI Life Logger');
  
  // 点击托盘图标显示/隐藏主窗口
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  
  // 双击托盘图标总是显示主窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  
  // 更新托盘菜单
  updateTrayMenu();
}

// 更新托盘菜单
function updateTrayMenu(countdown = null) {
  if (!tray) return;
  
  const menuTemplate = [];
  
  // 首先添加四象限临期提醒
  menuTemplate.push({
    label: '四象限临期提醒',
    click: () => {
      if (mainWindow) {
        mainWindow.webContents.send('check-important-tasks');
      }
    }
  });
  
  // 如果有倒计时，添加倒计时显示和相关操作
  if (countdown) {
    menuTemplate.push({ type: 'separator' });
    menuTemplate.push({
      label: `⏰ 下次提醒: ${countdown}`,
      enabled: false
    });
    
    menuTemplate.push({
      label: '延时提醒',
      submenu: [
        {
          label: '延迟5分钟',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('start-reminder-countdown', 5 * 60 * 1000, 5);
            }
          }
        },
        {
          label: '延迟10分钟',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('start-reminder-countdown', 10 * 60 * 1000, 10);
            }
          }
        },
        {
          label: '延迟30分钟',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('start-reminder-countdown', 30 * 60 * 1000, 30);
            }
          }
        }
      ]
    });
    
    menuTemplate.push({
      label: '关闭提醒',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('cancel-reminder-countdown');
        }
      }
    });
  }
  
  menuTemplate.push({ type: 'separator' });
  
  menuTemplate.push({
    label: '打开主窗口',
    click: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  
  menuTemplate.push({
    label: '打开四象限窗口',
    click: () => {
      createQuadrantWindow();
    }
  });

  menuTemplate.push({ type: 'separator' });

  menuTemplate.push({
    label: '退出应用',
    click: () => {
      app.isQuiting = true;
      app.quit();
    }
  });

  const contextMenu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(contextMenu);
}

// 不再单独创建设置窗口，改为渲染进程内模态

// 创建菜单
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建记录',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-entry');
          }
        },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-save');
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectall', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '切换主题',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            mainWindow.webContents.send('menu-toggle-theme');
          }
        },
        { type: 'separator' },
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 / 设置',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-open-settings');
          }
        },
        {
          label: '访问 GitHub',
          click: () => {
            shell.openExternal('https://github.com/B5-Software/ArtiMeow-AILifeLogger');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC 处理程序
ipcMain.handle('get-system-info', () => {
  const packageJson = require('../package.json');
  return {
    name: packageJson.name,
    version: packageJson.version,
    productName: packageJson.build?.productName || packageJson.name,
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    execPath: process.execPath,
    isDev: process.argv.includes('--dev'),
    author: packageJson.author,
    license: packageJson.license,
    homepage: packageJson.homepage
  };
});

// 四象限窗口相关的IPC处理
ipcMain.handle('create-quadrant-window', () => {
  createQuadrantWindow();
  return { success: true };
});

ipcMain.handle('send-to-quadrant', (event, data) => {
  if (quadrantWindow && !quadrantWindow.isDestroyed()) {
    quadrantWindow.webContents.send('quadrant-update', data);
    return { success: true };
  }
  return { success: false, error: 'Quadrant window not available' };
});

ipcMain.handle('get-quadrant-tasks', async () => {
  if (quadrantWindow && !quadrantWindow.isDestroyed()) {
    try {
      return await quadrantWindow.webContents.executeJavaScript('quadrantManager.getCurrentTasks()');
    } catch (error) {
      return { error: error.message };
    }
  }
  return { error: 'Quadrant window not available' };
});

// 主题管理
let currentTheme = 'system';

// 获取当前主题
ipcMain.handle('get-current-theme', () => {
  return currentTheme;
});

// 设置主题
ipcMain.handle('set-theme', (event, theme) => {
  // 验证主题有效性
  const validThemes = ['system', 'light', 'dark'];
  if (!validThemes.includes(theme)) {
    console.warn(`无效的主题: ${theme}, 使用默认主题 system`);
    theme = 'system';
  }
  
  currentTheme = theme;
  
  // 设置原生主题
  if (theme === 'system') {
    nativeTheme.themeSource = 'system';
  } else {
    nativeTheme.themeSource = theme;
  }
  
  // 通知所有窗口主题变化
  const windows = [mainWindow, quadrantWindow, reminderWindow].filter(win => win && !win.isDestroyed());
  windows.forEach(window => {
    window.webContents.send('theme-changed', theme);
  });
  
  console.log(`主题已切换至: ${theme}`);
  return theme;
});

// 获取系统主题（兼容性保持）
ipcMain.handle('get-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('show-save-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('show-open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  return result;
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 更新主窗口截止日期状态
ipcMain.handle('update-main-deadline-status', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('deadline-status-changed');
  }
});

// 四象限窗口控制
ipcMain.handle('minimize-quadrant-window', () => {
  if (quadrantWindow && !quadrantWindow.isDestroyed()) {
    quadrantWindow.minimize();
  }
});

ipcMain.handle('toggle-maximize-quadrant-window', () => {
  if (quadrantWindow && !quadrantWindow.isDestroyed()) {
    if (quadrantWindow.isMaximized()) {
      quadrantWindow.unmaximize();
    } else {
      quadrantWindow.maximize();
    }
  }
});

ipcMain.handle('close-quadrant-window', () => {
  if (quadrantWindow && !quadrantWindow.isDestroyed()) {
    quadrantWindow.close();
  }
});

// 提醒窗口相关处理
ipcMain.handle('create-reminder-window', (event, tasks) => {
  // 确保tasks是可序列化的对象
  const serializableTasks = tasks ? JSON.parse(JSON.stringify(tasks)) : [];
  createReminderWindow(serializableTasks);
  // 不返回任何值，避免序列化问题
  return null;
});

ipcMain.on('close-reminder-window', () => {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.close();
  }
});

ipcMain.on('snooze-reminder', (event, delay, minutes) => {
  // 启动倒计时并发送到主窗口
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('start-reminder-countdown', delay, minutes);
  }
  
  // 延迟后重新显示提醒
  setTimeout(() => {
    // 重新检查任务并显示提醒
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('check-urgent-tasks-reminder');
    }
  }, delay);
});

ipcMain.on('open-quadrant-from-reminder', () => {
  createQuadrantWindow();
});

// 托盘菜单更新
ipcMain.on('update-tray-countdown', (event, countdown) => {
  updateTrayMenu(countdown);
});

ipcMain.on('clear-tray-countdown', () => {
  updateTrayMenu();
});

// 壁纸相关IPC处理
ipcMain.handle('toggle-wallpaper', (event, enabled) => {
  enableWallpaper(enabled);
  return wallpaperEnabled;
});

ipcMain.handle('get-wallpaper-status', () => {
  return wallpaperEnabled;
});

ipcMain.handle('get-wallpaper-tasks', async () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const tasks = await mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            const tasks = JSON.parse(localStorage.getItem('quadrantTasks') || '[]');
            return tasks;
          } catch (e) {
            return [];
          }
        })()
      `);
      return tasks;
    }
    return [];
  } catch (error) {
    console.error('获取壁纸任务数据失败:', error);
    return [];
  }
});

// 窗口控制
ipcMain.on('window-control', (event, action) => {
  if (!mainWindow) return;
  switch (action) {
    case 'minimize':
      mainWindow.minimize();
      break;
    case 'maximize':
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      event.sender.send('window-maximize-changed', mainWindow.isMaximized());
      break;
    case 'close':
      mainWindow.close();
      break;
  }
});

// 应用事件
app.whenReady().then(() => {
  createWindow();
  loadWallpaperSettings(); // 加载壁纸设置
});

app.on('window-all-closed', () => {
  // 在Windows和Linux上，即使所有窗口都关闭，也保持应用运行（因为有托盘）
  // 只有在macOS上且用户明确退出时才退出应用
  if (process.platform === 'darwin' && !app.isQuiting) {
    // macOS上隐藏应用但不退出
  } else if (app.isQuiting) {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
  
  // 清理壁纸
  try {
    refresh();
  } catch (error) {
    console.error('清理壁纸失败:', error);
  }
});

// 主题变化监听
nativeTheme.on('updated', () => {
  if (mainWindow) {
    mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
  }
});
