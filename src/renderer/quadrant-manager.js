class QuadrantManager {
    constructor() {
        this.tasks = {
            'urgent-important': [],
            'important-not-urgent': [],
            'urgent-not-important': [],
            'not-urgent-not-important': []
        };
        this.editingTask = null;
        this.currentQuadrant = null;
        this.settings = {
            showCompleted: false,
            showDescription: true,
            showDeadline: true,
            reminderDays: 3,
            urgentReminder: true,
            sortMethod: 'deadline',
            autoSave: true
        };
        this.init();
    }

    init() {
        this.loadSettings();
        this.loadTasks();
        this.renderAllQuadrants();
        this.setupEventListeners();
        this.setupIPC();
        this.updateDeadlineIndicator();
        
        // 检查今日截止日期任务
        setTimeout(() => {
            this.checkTodayDeadlines();
        }, 1000);
        
        // 定期检查截止日期
        setInterval(() => {
            this.updateDeadlineIndicator();
        }, 60000); // 每分钟检查一次
        
        // 启动时检查当日重要任务截止日期
        this.checkTodayDeadlines();
    }

    setupIPC() {
        try {
            const { ipcRenderer } = require('electron');
            
            // 监听四象限更新消息
            ipcRenderer.on('quadrant-update', (event, data) => {
                console.log('收到四象限更新数据:', data);
                this.updateTasksFromAnalysis(data);
            });
            
            console.log('IPC通信已设置');
        } catch (error) {
            console.warn('IPC通信设置失败，可能运行在浏览器环境中:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTask();
        });

        // 实时自动保存 - 监听任务输入字段变化
        const taskTitle = document.getElementById('taskTitle');
        const taskDescription = document.getElementById('taskDescription');
        const taskDeadline = document.getElementById('taskDeadline');
        const taskQuadrant = document.getElementById('taskQuadrant');
        const taskAlertThreshold = document.getElementById('taskAlertThreshold');
        const taskPriority = document.getElementById('taskPriority');

        // 添加自动保存的延迟函数
        let autoSaveTimeout;
        const autoSave = () => {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => {
                if (this.editingTask) {
                    this.autoSaveCurrentTask();
                }
            }, 1000); // 1秒延迟自动保存
        };

        if (taskTitle) {
            taskTitle.addEventListener('input', autoSave);
            taskTitle.addEventListener('blur', () => {
                if (this.editingTask) this.autoSaveCurrentTask();
            });
        }
        if (taskDescription) {
            taskDescription.addEventListener('input', autoSave);
            taskDescription.addEventListener('blur', () => {
                if (this.editingTask) this.autoSaveCurrentTask();
            });
        }
        if (taskDeadline) {
            taskDeadline.addEventListener('change', () => {
                if (this.editingTask) this.autoSaveCurrentTask();
            });
        }
        if (taskQuadrant) {
            taskQuadrant.addEventListener('change', () => {
                if (this.editingTask) this.autoSaveCurrentTask();
            });
        }
        if (taskAlertThreshold) {
            taskAlertThreshold.addEventListener('change', () => {
                if (this.editingTask) this.autoSaveCurrentTask();
            });
        }
        if (taskPriority) {
            taskPriority.addEventListener('change', () => {
                if (this.editingTask) this.autoSaveCurrentTask();
            });
        }

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideTaskModal();
            }
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.showAddTaskModal('urgent-important');
            }
        });
    }

    // 窗口控制方法
    minimizeWindow() {
        try {
            const { ipcRenderer } = require('electron');
            ipcRenderer.invoke('minimize-quadrant-window');
        } catch (error) {
            console.warn('无法最小化窗口:', error);
        }
    }

    toggleMaximize() {
        try {
            const { ipcRenderer } = require('electron');
            ipcRenderer.invoke('toggle-maximize-quadrant-window');
        } catch (error) {
            console.warn('无法切换窗口大小:', error);
        }
    }

    closeWindow() {
        try {
            const { ipcRenderer } = require('electron');
            ipcRenderer.invoke('close-quadrant-window');
        } catch (error) {
            window.close();
        }
    }

    // 设置管理
    loadSettings() {
        try {
            const saved = localStorage.getItem('quadrant-settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
            this.applySettings();
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('quadrant-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('保存设置失败:', error);
        }
    }

    applySettings() {
        // 应用设置到UI
        document.getElementById('showCompleted').checked = this.settings.showCompleted;
        document.getElementById('showDescription').checked = this.settings.showDescription;
        document.getElementById('showDeadline').checked = this.settings.showDeadline;
        document.getElementById('reminderDays').value = this.settings.reminderDays;
        document.getElementById('urgentReminder').checked = this.settings.urgentReminder;
        document.getElementById('sortMethod').value = this.settings.sortMethod;
        document.getElementById('autoSave').checked = this.settings.autoSave;
    }

    updateSettings() {
        this.settings.showCompleted = document.getElementById('showCompleted').checked;
        this.settings.showDescription = document.getElementById('showDescription').checked;
        this.settings.showDeadline = document.getElementById('showDeadline').checked;
        this.settings.reminderDays = parseInt(document.getElementById('reminderDays').value);
        this.settings.urgentReminder = document.getElementById('urgentReminder').checked;
        this.settings.sortMethod = document.getElementById('sortMethod').value;
        this.settings.autoSave = document.getElementById('autoSave').checked;
        
        this.saveSettings();
        this.renderAllQuadrants();
        this.updateDeadlineIndicator();
    }

    toggleSettings() {
        const panel = document.getElementById('settingsPanel');
        panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
    }

    // 从AI分析结果更新任务
    updateTasksFromAnalysis(analysisData) {
        try {
            console.log('处理AI分析数据:', analysisData);
            
            if (analysisData.delta) {
                // 处理增量更新
                this.processDeltaUpdate(analysisData.delta);
            } else if (analysisData.quadrants) {
                // 处理完整的象限数据
                this.processQuadrantUpdate(analysisData.quadrants);
            } else if (analysisData.quadrantTasks) {
                // 处理新格式的象限任务数据
                this.processQuadrantTasksUpdate(analysisData.quadrantTasks);
            }
            
            this.saveTasks();
            this.renderAllQuadrants();
            this.updateDeadlineIndicator();
            this.showNotification('任务已根据AI分析更新', 'success');
        } catch (error) {
            console.error('更新任务失败:', error);
            this.showNotification('更新任务失败: ' + error.message, 'error');
        }
    }

    // 处理象限任务数据格式
    processQuadrantTasksUpdate(quadrantTasks) {
        Object.keys(quadrantTasks).forEach(quadrant => {
            if (this.tasks[quadrant]) {
                quadrantTasks[quadrant].forEach(task => {
                    const taskId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                    const newTask = {
                        id: taskId,
                        title: task.title,
                        description: task.description || '',
                        deadline: task.deadline || '',
                        completed: false,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    this.tasks[quadrant].push(newTask);
                });
            }
        });
    }

    // 处理增量更新
    processDeltaUpdate(delta) {
        // 添加新任务
        if (delta.add) {
            Object.keys(delta.add).forEach(quadrant => {
                delta.add[quadrant].forEach(task => {
                    this.addTask(quadrant, task.title, task.description || '', '', 3, 'medium');
                });
            });
        }

        // 删除任务
        if (delta.remove) {
            Object.keys(delta.remove).forEach(quadrant => {
                delta.remove[quadrant].forEach(taskId => {
                    this.removeTask(quadrant, taskId);
                });
            });
        }

        // 移动任务
        if (delta.move) {
            delta.move.forEach(move => {
                this.moveTask(move.from, move.to, move.taskId);
            });
        }

        // 更新任务
        if (delta.update) {
            Object.keys(delta.update).forEach(quadrant => {
                delta.update[quadrant].forEach(task => {
                    this.updateTask(quadrant, task.id, task);
                });
            });
        }
    }

    // 处理完整象限更新
    processQuadrantUpdate(quadrants) {
        Object.keys(quadrants).forEach(quadrant => {
            this.tasks[quadrant] = quadrants[quadrant].map(task => ({
                id: this.generateId(),
                title: task.title,
                description: task.description || '',
                completed: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }));
        });
    }

    // 显示添加任务模态框
    showAddTaskModal(quadrant) {
        this.currentQuadrant = quadrant;
        this.editingTask = null;
        
        document.getElementById('modalTitle').textContent = '添加新任务';
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDescription').value = '';
        document.getElementById('taskQuadrant').value = quadrant;
        document.getElementById('taskDeadline').value = '';
        document.getElementById('taskAlertThreshold').value = '3';
        document.getElementById('taskPriority').value = 'medium';
        
        document.getElementById('taskModal').style.display = 'flex';
        document.getElementById('taskTitle').focus();
    }

    // 显示编辑任务模态框
    showEditTaskModal(quadrant, taskId) {
        const task = this.tasks[quadrant].find(t => t.id === taskId);
        if (!task) return;

        this.currentQuadrant = quadrant;
        this.editingTask = task;
        
        document.getElementById('modalTitle').textContent = '编辑任务';
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskQuadrant').value = quadrant;
        document.getElementById('taskDeadline').value = task.deadline || '';
        
        // 确保阈值是数字类型
        const alertThreshold = task.alertThreshold !== undefined ? parseInt(task.alertThreshold) : 3;
        document.getElementById('taskAlertThreshold').value = alertThreshold;
        
        // 确保优先级有效
        const priority = task.priority || 'medium';
        document.getElementById('taskPriority').value = priority;
        
        document.getElementById('taskModal').style.display = 'flex';
        document.getElementById('taskTitle').focus();
        
        console.log('编辑任务数据:', { title: task.title, alertThreshold, priority });
    }

    // 隐藏任务模态框
    hideTaskModal() {
        document.getElementById('taskModal').style.display = 'none';
        this.editingTask = null;
        this.currentQuadrant = null;
    }

    // 保存任务
    saveTask() {
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const quadrant = document.getElementById('taskQuadrant').value;
        const deadline = document.getElementById('taskDeadline').value;
        const atInputVal = document.getElementById('taskAlertThreshold').value;
        const alertThreshold = atInputVal === '0' ? 0 : (parseInt(atInputVal,10) || 3);
        const priority = document.getElementById('taskPriority').value || 'medium';

        console.log('保存任务数据:', { title, alertThreshold, priority });

        if (!title) {
            this.showNotification('请输入任务标题', 'error');
            return;
        }

        if (this.editingTask) {
            // 编辑现有任务
            this.editingTask.title = title;
            this.editingTask.description = description;
            this.editingTask.deadline = deadline;
            this.editingTask.alertThreshold = alertThreshold;
            this.editingTask.priority = priority;
            this.editingTask.updatedAt = new Date().toISOString();
            
            // 清理任务的提醒记录，允许重新提醒
            if (window.mainApp && window.mainApp.clearTaskAlert) {
                window.mainApp.clearTaskAlert(this.editingTask.id);
            }
            
            console.log('任务更新后:', this.editingTask);
            
            // 如果象限改变，移动任务
            if (quadrant !== this.currentQuadrant) {
                this.moveTask(this.currentQuadrant, quadrant, this.editingTask.id);
            }
        } else {
            // 添加新任务
            this.addTask(quadrant, title, description, deadline, alertThreshold, priority);
        }

        this.saveTasks();
        this.renderAllQuadrants();
        this.updateDeadlineIndicator();
        this.hideTaskModal();
        this.showNotification('任务已保存', 'success');
    }

    // 自动保存当前正在编辑的任务
    autoSaveCurrentTask() {
        if (!this.editingTask) return;

        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const quadrant = document.getElementById('taskQuadrant').value;
        const deadline = document.getElementById('taskDeadline').value;
        const atAutoVal = document.getElementById('taskAlertThreshold').value;
        const alertThreshold = atAutoVal === '0' ? 0 : parseInt(atAutoVal,10);
        const priority = document.getElementById('taskPriority').value;

        // 只有当标题不为空时才保存
        if (!title) return;

        // 更新任务数据
        this.editingTask.title = title;
        this.editingTask.description = description;
        this.editingTask.deadline = deadline;
        this.editingTask.alertThreshold = alertThreshold;
        this.editingTask.priority = priority;
        this.editingTask.updatedAt = new Date().toISOString();

        // 清理任务的提醒记录，允许重新提醒
        if (window.mainApp && window.mainApp.clearTaskAlert) {
            window.mainApp.clearTaskAlert(this.editingTask.id);
        }
        
        // 如果象限改变，移动任务
        if (quadrant !== this.currentQuadrant) {
            this.moveTask(this.currentQuadrant, quadrant, this.editingTask.id);
            this.currentQuadrant = quadrant;
        }

        // 保存到存储并更新显示
        this.saveTasks();
        this.renderAllQuadrants();
        this.updateDeadlineIndicator();
        
        // 显示自动保存提示（更轻量化）
        this.showAutoSaveIndicator();
    }

    // 显示自动保存指示器
    showAutoSaveIndicator() {
        // 在任务表单标题旁显示保存状态
        const saveIndicator = document.getElementById('autoSaveIndicator') || (() => {
            const indicator = document.createElement('span');
            indicator.id = 'autoSaveIndicator';
            indicator.style.cssText = `
                color: #28a745; 
                font-size: 12px; 
                margin-left: 10px; 
                opacity: 0; 
                transition: opacity 0.3s ease;
            `;
            indicator.innerHTML = '✓ 已保存';
            
            const modalTitle = document.querySelector('.modal-title');
            if (modalTitle) {
                modalTitle.appendChild(indicator);
            }
            return indicator;
        })();

        // 显示保存提示
        saveIndicator.style.opacity = '1';
        
        // 3秒后淡出
        setTimeout(() => {
            saveIndicator.style.opacity = '0';
        }, 3000);
    }

    // 添加任务
    addTask(quadrant, title, description, deadline, alertThreshold = 3, priority = 'medium') {
        const task = {
            id: this.generateId(),
            title: title,
            description: description,
            deadline: deadline,
            alertThreshold: alertThreshold,
            priority: priority,
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.tasks[quadrant].push(task);
        return task;
    }

    // 删除任务
    async deleteTask(quadrant, taskId) {
        const confirmed = await this.showCustomConfirm(
            '确认删除',
            '确定要删除这个任务吗？',
            '删除',
            '取消'
        );
        
        if (confirmed) {
            this.tasks[quadrant] = this.tasks[quadrant].filter(t => t.id !== taskId);
            this.saveTasks();
            this.renderAllQuadrants();
            this.showNotification('任务已删除', 'success');
        }
    }

    // 切换任务完成状态
    toggleTask(quadrant, taskId) {
        const task = this.tasks[quadrant].find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            task.updatedAt = new Date().toISOString();
            this.saveTasks();
            this.renderAllQuadrants();
            this.updateDeadlineIndicator();
            
            const status = task.completed ? '已完成' : '已重新激活';
            this.showNotification(`任务${status}`, 'success');
        }
    }

    // 移动任务到不同象限
    moveTask(fromQuadrant, toQuadrant, taskId) {
        const taskIndex = this.tasks[fromQuadrant].findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;

        const task = this.tasks[fromQuadrant].splice(taskIndex, 1)[0];
        task.updatedAt = new Date().toISOString();
        this.tasks[toQuadrant].push(task);
    }

    // 渲染所有象限
    renderAllQuadrants() {
        Object.keys(this.tasks).forEach(quadrant => {
            this.renderQuadrant(quadrant);
        });
    }

    // 渲染单个象限
    renderQuadrant(quadrant) {
        const container = document.getElementById(`tasks-${quadrant}`);
        const countElement = document.getElementById(`count-${quadrant}`);
        
        let tasks = this.tasks[quadrant];
        
        // 根据设置过滤任务
        if (!this.settings.showCompleted) {
            tasks = tasks.filter(task => !task.completed);
        }
        
        // 排序任务
        tasks = this.sortTasks(tasks);
        
        countElement.textContent = tasks.length;

        if (tasks.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div>暂无任务</div></div>';
            return;
        }

        container.innerHTML = tasks.map(task => {
            const deadlineInfo = this.getDeadlineInfo(task.deadline);
            const deadlineClass = deadlineInfo.isUrgent ? 'urgent-deadline' : 
                                 deadlineInfo.isApproaching ? 'approaching-deadline' : '';
            
            return `
                <div class="task-item ${task.completed ? 'completed' : ''} ${deadlineClass}" onclick="quadrantManager.toggleTask('${quadrant}', '${task.id}')">
                    <div class="task-header">
                        <div class="task-title">${this.escapeHtml(task.title)}</div>
                        ${this.settings.showDeadline && task.deadline ? 
                            `<div class="task-deadline ${deadlineInfo.class}">${deadlineInfo.text}</div>` : ''}
                    </div>
                    ${this.settings.showDescription && task.description ? 
                        `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
                    <div class="task-actions">
                        <button class="task-action-btn" onclick="event.stopPropagation(); quadrantManager.showEditTaskModal('${quadrant}', '${task.id}')" title="编辑">✏️</button>
                        <button class="task-action-btn" onclick="event.stopPropagation(); quadrantManager.deleteTask('${quadrant}', '${task.id}').catch(console.error)" title="删除">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 排序任务
    sortTasks(tasks) {
        return tasks.sort((a, b) => {
            switch (this.settings.sortMethod) {
                case 'deadline':
                    if (!a.deadline && !b.deadline) return new Date(b.createdAt) - new Date(a.createdAt);
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(a.deadline) - new Date(b.deadline);
                case 'created':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'updated':
                    return new Date(b.updatedAt) - new Date(a.updatedAt);
                case 'title':
                    return a.title.localeCompare(b.title);
                default:
                    return 0;
            }
        });
    }

    // 获取截止日期信息
    getDeadlineInfo(deadline) {
        if (!deadline) return { text: '', class: '', isUrgent: false, isApproaching: false };
        
        const deadlineDate = new Date(deadline);
        const today = new Date();
        const diffTime = deadlineDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let text, className, isUrgent = false, isApproaching = false;
        
        if (diffDays < 0) {
            text = `逾期${Math.abs(diffDays)}天`;
            className = 'urgent';
            isUrgent = true;
        } else if (diffDays === 0) {
            text = '今天到期';
            className = 'urgent';
            isUrgent = true;
        } else if (diffDays === 1) {
            text = '明天到期';
            className = 'warning';
            isApproaching = true;
        } else if (diffDays <= this.settings.reminderDays) {
            text = `${diffDays}天后到期`;
            className = 'warning';
            isApproaching = true;
        } else {
            text = `${diffDays}天后到期`;
            className = '';
        }
        
        return { text, class: className, isUrgent, isApproaching };
    }

    // 更新截止日期指示器
    updateDeadlineIndicator() {
        const indicator = document.getElementById('deadlineIndicator');
        const urgentTasks = this.getUrgentTasks();
        
        if (urgentTasks.length === 0) {
            indicator.innerHTML = '<span style="color: #28a745;">✅ 暂无紧急任务</span>';
            return;
        }
        
        const importantUrgent = urgentTasks.filter(t => t.quadrant === 'urgent-important');
        const otherUrgent = urgentTasks.filter(t => t.quadrant !== 'urgent-important');
        
        let html = '';
        
        if (importantUrgent.length > 0) {
            html += `<span class="deadline-badge urgent">${importantUrgent.length} 重要紧急</span>`;
        }
        
        if (otherUrgent.length > 0) {
            html += `<span class="deadline-badge important">${otherUrgent.length} 其他紧急</span>`;
        }
        
        indicator.innerHTML = html;
    }

    // 获取紧急任务
    getUrgentTasks() {
        const urgent = [];
        Object.keys(this.tasks).forEach(quadrant => {
            this.tasks[quadrant].forEach(task => {
                if (!task.completed && task.deadline) {
                    const deadlineInfo = this.getDeadlineInfo(task.deadline);
                    if (deadlineInfo.isUrgent || deadlineInfo.isApproaching) {
                        urgent.push({ ...task, quadrant });
                    }
                }
            });
        });
        
        return urgent.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    }

    // 显示紧急任务
    showUrgentTasks() {
        const urgentTasks = this.getUrgentTasks();
        
        if (urgentTasks.length === 0) {
            this.showNotification('暂无紧急任务', 'success');
            return;
        }
        
        const taskList = urgentTasks.map(task => {
            const deadlineInfo = this.getDeadlineInfo(task.deadline);
            const quadrantName = this.getQuadrantName(task.quadrant);
            return `• ${task.title} (${quadrantName}) - ${deadlineInfo.text}`;
        }).join('\n');
        
        alert(`紧急任务列表 (${urgentTasks.length}个):\n\n${taskList}`);
    }

    // 获取象限名称
    getQuadrantName(quadrant) {
        const names = {
            'urgent-important': '重要且紧急',
            'important-not-urgent': '重要但不紧急',
            'urgent-not-important': '紧急但不重要',
            'not-urgent-not-important': '既不重要也不紧急'
        };
        return names[quadrant] || quadrant;
    }

    // 检查当日截止日期
    checkTodayDeadlines() {
        // 四象限窗口打开时不再弹窗提醒，改为只更新状态
        // 如果关闭了紧急任务提醒，则不显示
        if (!this.settings.urgentReminder) {
            return;
        }
        
        const today = new Date().toISOString().split('T')[0];
        const todayTasks = [];
        
        Object.keys(this.tasks).forEach(quadrant => {
            this.tasks[quadrant].forEach(task => {
                if (!task.completed && task.deadline === today) {
                    todayTasks.push({ ...task, quadrant });
                }
            });
        });
        
        if (todayTasks.length > 0) {
            const importantTasks = todayTasks.filter(t => t.quadrant === 'urgent-important');
            
            if (importantTasks.length > 0) {
                // 不再弹窗，只在控制台记录
                console.log(`⚠️ 重要任务提醒: 今天有 ${importantTasks.length} 个重要任务需要完成`);
                // 可以在这里更新状态指示器或者发送到主窗口
            }
        }
    }

    // 刷新任务
    refreshTasks() {
        this.loadTasks();
        this.renderAllQuadrants();
        this.showNotification('任务已刷新', 'success');
    }

    // 导出任务
    exportTasks() {
        const data = {
            tasks: this.tasks,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quadrant-tasks-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showNotification('任务已导出', 'success');
    }

    // 显示设置
    showSettings() {
        alert('设置功能开发中...');
    }

    // 保存任务到本地存储
    saveTasks() {
        try {
            localStorage.setItem('quadrant-tasks', JSON.stringify(this.tasks));
            
            // 通知主窗口更新截止日期状态
            if (window.require) {
                try {
                    const { ipcRenderer } = require('electron');
                    ipcRenderer.invoke('update-main-deadline-status');
                } catch (error) {
                    console.log('IPC通信失败:', error);
                }
            }
        } catch (error) {
            console.error('保存任务失败:', error);
            this.showNotification('保存任务失败', 'error');
        }
    }

    // 从本地存储加载任务
    loadTasks() {
        try {
            const saved = localStorage.getItem('quadrant-tasks');
            if (saved) {
                this.tasks = JSON.parse(saved);
                
                // 确保所有象限都存在
                const defaultQuadrants = ['urgent-important', 'important-not-urgent', 'urgent-not-important', 'not-urgent-not-important'];
                defaultQuadrants.forEach(quadrant => {
                    if (!this.tasks[quadrant]) {
                        this.tasks[quadrant] = [];
                    } else {
                        // 为现有任务添加缺失的字段
                        this.tasks[quadrant].forEach(task => {
                            if (task.alertThreshold === undefined) {
                                task.alertThreshold = 3; // 默认3天
                            }
                            if (task.priority === undefined) {
                                task.priority = 'medium'; // 默认中等优先级
                            }
                        });
                    }
                });
                
                // 保存迁移后的数据
                this.saveTasks();
            } else {
                // 如果没有保存的数据，初始化为空数据
                this.initializeEmptyTasks();
            }
        } catch (error) {
            console.error('加载任务失败:', error);
            this.showNotification('加载任务失败', 'error');
            this.initializeEmptyTasks();
        }
    }

    // 初始化空任务数据
    initializeEmptyTasks() {
        this.tasks = {
            'urgent-important': [],
            'important-not-urgent': [],
            'urgent-not-important': [],
            'not-urgent-not-important': []
        };
        this.saveTasks();
        console.log('已初始化空的四象限任务数据');
    }

    // 生成唯一ID
    generateId() {
        return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 转义HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 显示通知
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50px;
            right: 20px;
            background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // 显示动画
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // 自动隐藏
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // 获取当前任务数据（供主窗口调用）
    getCurrentTasks() {
        return this.tasks;
    }

    // 重置所有任务
    async resetTasks() {
        try {
            // 第一步：文本输入确认
            const confirmText = '清空所有任务';
            const userInput = await this.showCustomPrompt(
                '⚠️ 危险操作警告 ⚠️',
                `此操作将永久删除所有四象限任务，无法撤销！\n\n如果确定要继续，请在下方输入：${confirmText}`,
                '请输入确认文本'
            );
            
            if (userInput !== confirmText) {
                this.showNotification('操作已取消', 'info');
                return;
            }

            // 第二步：二次确认
            const secondConfirm = await this.showCustomConfirm(
                '最后确认',
                '您真的要删除所有任务吗？此操作不可撤销！',
                '确认删除',
                '取消'
            );
            
            if (!secondConfirm) {
                this.showNotification('操作已取消', 'info');
                return;
            }

            // 创建备份
            const backup = {
                timestamp: new Date().toISOString(),
                tasks: JSON.parse(JSON.stringify(this.tasks))
            };
            
            // 保存备份到localStorage
            const backupKey = `quadrant-backup-${Date.now()}`;
            localStorage.setItem(backupKey, JSON.stringify(backup));
            
            // 清空任务
            this.tasks = {
                'urgent-important': [],
                'important-not-urgent': [],
                'urgent-not-important': [],
                'not-urgent-not-important': []
            };
            
            this.saveTasks();
            this.renderAllQuadrants();
            this.updateDeadlineIndicator();
            
            this.showNotification(`所有任务已清空。备份已保存为：${backupKey}`, 'success');
            console.log('任务备份已保存:', backupKey, backup);
            
            // 自动清理旧备份
            this.cleanOldBackups();
        } catch (error) {
            console.error('重置任务时出错:', error);
            this.showNotification('重置失败，请重试', 'error');
        }
    }

    // 自定义 prompt 对话框
    showCustomPrompt(title, message, placeholder = '') {
        return new Promise((resolve) => {
            // 创建对话框HTML
            const dialogHTML = `
                <div class="custom-dialog-overlay">
                    <div class="custom-dialog">
                        <div class="dialog-header">
                            <h3>${this.escapeHtml(title)}</h3>
                        </div>
                        <div class="dialog-body">
                            <p style="white-space: pre-line; margin-bottom: 15px;">${this.escapeHtml(message)}</p>
                            <input type="text" class="dialog-input" placeholder="${this.escapeHtml(placeholder)}" />
                        </div>
                        <div class="dialog-footer">
                            <button class="btn btn-secondary dialog-cancel">取消</button>
                            <button class="btn btn-danger dialog-confirm">确认</button>
                        </div>
                    </div>
                </div>
            `;
            
            // 插入对话框到页面
            const dialogElement = document.createElement('div');
            dialogElement.innerHTML = dialogHTML;
            document.body.appendChild(dialogElement);
            
            const overlay = dialogElement.querySelector('.custom-dialog-overlay');
            const input = dialogElement.querySelector('.dialog-input');
            const cancelBtn = dialogElement.querySelector('.dialog-cancel');
            const confirmBtn = dialogElement.querySelector('.dialog-confirm');
            
            // 聚焦输入框
            setTimeout(() => input.focus(), 100);
            
            // 关闭对话框的函数
            const closeDialog = (result) => {
                document.body.removeChild(dialogElement);
                resolve(result);
            };
            
            // 事件监听
            cancelBtn.addEventListener('click', () => closeDialog(null));
            confirmBtn.addEventListener('click', () => closeDialog(input.value));
            
            // 支持回车确认
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    closeDialog(input.value);
                }
            });
            
            // 点击遮罩关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeDialog(null);
                }
            });
        });
    }

    // 自定义 confirm 对话框
    showCustomConfirm(title, message, confirmText = '确认', cancelText = '取消') {
        return new Promise((resolve) => {
            // 创建对话框HTML
            const dialogHTML = `
                <div class="custom-dialog-overlay">
                    <div class="custom-dialog">
                        <div class="dialog-header">
                            <h3>${this.escapeHtml(title)}</h3>
                        </div>
                        <div class="dialog-body">
                            <p style="white-space: pre-line;">${this.escapeHtml(message)}</p>
                        </div>
                        <div class="dialog-footer">
                            <button class="btn btn-secondary dialog-cancel">${this.escapeHtml(cancelText)}</button>
                            <button class="btn btn-danger dialog-confirm">${this.escapeHtml(confirmText)}</button>
                        </div>
                    </div>
                </div>
            `;
            
            // 插入对话框到页面
            const dialogElement = document.createElement('div');
            dialogElement.innerHTML = dialogHTML;
            document.body.appendChild(dialogElement);
            
            const overlay = dialogElement.querySelector('.custom-dialog-overlay');
            const cancelBtn = dialogElement.querySelector('.dialog-cancel');
            const confirmBtn = dialogElement.querySelector('.dialog-confirm');
            
            // 关闭对话框的函数
            const closeDialog = (result) => {
                document.body.removeChild(dialogElement);
                resolve(result);
            };
            
            // 事件监听
            cancelBtn.addEventListener('click', () => closeDialog(false));
            confirmBtn.addEventListener('click', () => closeDialog(true));
            
            // 点击遮罩关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeDialog(false);
                }
            });
            
            // 支持键盘操作
            document.addEventListener('keydown', function escapeHandler(e) {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escapeHandler);
                    closeDialog(false);
                }
            });
        });
    }

    // 从备份恢复数据
    restoreFromBackup() {
        const backupList = [];
        
        // 获取所有备份
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('quadrant-backup-')) {
                const timestamp = key.replace('quadrant-backup-', '');
                const date = new Date(parseInt(timestamp));
                backupList.push({
                    key: key,
                    timestamp: timestamp,
                    dateStr: date.toLocaleString('zh-CN')
                });
            }
        }
        
        if (backupList.length === 0) {
            this.showNotification('没有找到可用的备份', 'warning');
            return;
        }
        
        // 按时间排序，最新的在前
        backupList.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
        
        // 创建选择界面
        let optionsHTML = backupList.map((backup, index) => 
            `<option value="${backup.key}">${backup.dateStr}</option>`
        ).join('');
        
        const restoreHTML = `
            <div class="restore-dialog">
                <h3>选择要恢复的备份</h3>
                <select id="backupSelect">
                    ${optionsHTML}
                </select>
                <div class="restore-buttons">
                    <button onclick="quadrantManager.closeRestoreDialog()">取消</button>
                    <button onclick="quadrantManager.performRestore()">恢复</button>
                </div>
            </div>
        `;
        
        const dialog = document.createElement('div');
        dialog.innerHTML = restoreHTML;
        dialog.className = 'backup-restore-dialog';
        dialog.id = 'backup-restore-dialog';
        document.body.appendChild(dialog);
    }

    // 关闭恢复对话框
    closeRestoreDialog() {
        const dialog = document.getElementById('backup-restore-dialog');
        if (dialog) {
            dialog.remove();
        }
    }
    
    // 执行恢复操作
    async performRestore() {
        const select = document.getElementById('backupSelect');
        if (!select) return;
        
        const backupKey = select.value;
        const backupData = localStorage.getItem(backupKey);
        
        if (!backupData) {
            this.showNotification('备份数据不存在', 'error');
            return;
        }
        
        try {
            const backup = JSON.parse(backupData);
            
            // 确认恢复
            const confirmRestore = await this.showCustomConfirm(
                '确认恢复',
                `确定要恢复到 ${new Date(parseInt(backupKey.replace('quadrant-backup-', ''))).toLocaleString('zh-CN')} 的备份吗？\n当前数据将被覆盖！`,
                '恢复',
                '取消'
            );
            
            if (!confirmRestore) {
                return;
            }
            
            // 恢复数据
            this.tasks = backup.tasks;
            localStorage.setItem('quadrant-tasks', JSON.stringify(this.tasks));
            
            // 更新界面
            this.renderAllQuadrants();
            this.updateDeadlineIndicator();
            
            this.showNotification('数据恢复成功', 'success');
            
            // 关闭恢复对话框
            this.closeRestoreDialog();
            
        } catch (error) {
            console.error('恢复备份时出错:', error);
            this.showNotification('恢复失败，备份数据可能已损坏', 'error');
        }
    }
    
    // 清理旧备份（保留最近10个）
    cleanOldBackups() {
        const backupList = [];
        
        // 获取所有备份
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('quadrant-backup-')) {
                const timestamp = parseInt(key.replace('quadrant-backup-', ''));
                backupList.push({ key, timestamp });
            }
        }
        
        // 按时间排序，最新的在前
        backupList.sort((a, b) => b.timestamp - a.timestamp);
        
        // 删除超过10个的旧备份
        const toDelete = backupList.slice(10);
        toDelete.forEach(backup => {
            localStorage.removeItem(backup.key);
        });
        
        if (toDelete.length > 0) {
            console.log(`已清理 ${toDelete.length} 个旧备份`);
        }
    }

    // 清理已完成的任务
    cleanCompletedTasks() {
        let removedCount = 0;
        Object.keys(this.tasks).forEach(quadrant => {
            const beforeCount = this.tasks[quadrant].length;
            this.tasks[quadrant] = this.tasks[quadrant].filter(task => !task.completed);
            removedCount += beforeCount - this.tasks[quadrant].length;
        });
        
        if (removedCount > 0) {
            this.saveTasks();
            this.renderAllQuadrants();
            this.updateDeadlineIndicator();
            this.showNotification(`已清理 ${removedCount} 个已完成任务`, 'success');
        } else {
            this.showNotification('没有已完成的任务需要清理', 'info');
        }
    }

    // 显示通知
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 自动移除
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    // 编辑任务
    editTask(quadrant, taskId, title, description, deadline) {
        const task = this.tasks[quadrant].find(t => t.id === taskId);
        if (task) {
            task.title = title;
            task.description = description;
            task.deadline = deadline;
            task.updatedAt = new Date().toISOString();
            
            this.saveTasks();
            this.renderAllQuadrants();
            this.updateDeadlineIndicator();
            
            this.showNotification('任务已更新', 'success');
        }
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化四象限管理器
const quadrantManager = new QuadrantManager();

// 暴露到全局，供HTML调用
window.quadrantManager = quadrantManager;

// 主题管理
class QuadrantThemeManager {
    constructor() {
        this.currentTheme = 'system';
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.init();
    }
    
    init() {
        if (window.require) {
            try {
                const { ipcRenderer } = require('electron');
                
                // 从主进程获取当前主题
                ipcRenderer.invoke('get-current-theme').then(theme => {
                    this.setTheme(theme || 'system');
                });
                
                // 监听主题变化
                ipcRenderer.on('theme-changed', (event, theme) => {
                    this.setTheme(theme);
                });
            } catch (error) {
                console.error('主题管理初始化失败:', error);
            }
        }
        
        // 监听系统主题变化
        this.mediaQuery.addEventListener('change', () => {
            if (this.currentTheme === 'system') {
                this.updateThemeDisplay();
            }
        });
    }
    
    setTheme(theme) {
        this.currentTheme = theme;
        this.updateThemeDisplay();
    }
    
    updateThemeDisplay() {
        const body = document.body;
        const effectiveTheme = this.getEffectiveTheme();
        
        // 清除所有现有主题类，保留其他类
        body.className = body.className.replace(/theme-\w+/g, '');
        // 添加当前主题类和窗口标识类
        body.className += ` theme-${this.currentTheme} quadrant-window`;
        body.setAttribute('data-effective-theme', effectiveTheme);
        
        console.log(`四象限主题管理器：主题已更新为 ${this.currentTheme} (有效主题: ${effectiveTheme})`);
    }
    
    getEffectiveTheme() {
        if (this.currentTheme === 'system') {
            return this.mediaQuery.matches ? 'dark' : 'light';
        }
        return this.currentTheme;
    }
}

// 初始化主题管理器
const quadrantThemeManager = new QuadrantThemeManager();
