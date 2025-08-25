const { app, BrowserWindow, Menu, ipcMain, dialog, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

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
  });

  // 开发模式下打开开发者工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // 创建菜单
  createMenu();
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

ipcMain.handle('get-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

ipcMain.handle('set-theme', (event, theme) => {
  if (theme === 'system') {
    nativeTheme.themeSource = 'system';
  } else {
    nativeTheme.themeSource = theme;
  }
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
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 主题变化监听
nativeTheme.on('updated', () => {
  if (mainWindow) {
    mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
  }
});
