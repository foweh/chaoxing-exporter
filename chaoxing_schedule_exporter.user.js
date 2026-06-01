// ==UserScript==
// @name         超星课表导出器 - 全周次提取
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  从超星泛雅课表页面提取所有周次的课程数据，导出为CSV/Excel（含上课周次、上课时间、课程名称、上课地点）
// @author       Reasonix
// @match        https://kb.chaoxing.com/res/pc/curriculum/schedule.html*
// @match        https://*.chaoxing.com/res/pc/curriculum/schedule.html*
// @icon         https://www.chaoxing.com/favicon.ico
// @grant        GM_addStyle
// @grant        GM_download
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        // 导出格式: 'csv' 或 'json'
        format: 'csv',
        // 是否自动开始（设为false时需手动点击按钮）
        autoStart: false,
        // 切换周次后的等待时间(毫秒)
        switchDelay: 800,
    };

    // ==================== 添加可拖拽的导出按钮 ====================
    GM_addStyle(`
        #cx-export-wrapper {
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 99999;
            user-select: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #cx-export-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #3a8bff;
            color: #fff;
            border: none;
            border-radius: 8px;
            padding: 0;
            font-size: 15px;
            font-weight: bold;
            cursor: grab;
            box-shadow: 0 4px 16px rgba(58,139,255,0.5);
            transition: box-shadow 0.3s;
            overflow: hidden;
        }
        #cx-export-btn:active { cursor: grabbing; }
        #cx-export-btn:hover { box-shadow: 0 6px 24px rgba(58,139,255,0.6); }
        #cx-export-btn:disabled { background: #aaa; box-shadow: none; cursor: not-allowed; }
        #cx-export-btn:disabled .cx-drag-handle { cursor: not-allowed; }
        #cx-export-btn .cx-drag-handle {
            padding: 12px 6px;
            background: rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            flex-shrink: 0;
        }
        #cx-export-btn .cx-drag-handle:active { cursor: grabbing; }
        #cx-export-btn .cx-drag-handle svg { width: 16px; height: 16px; fill: rgba(255,255,255,0.8); }
        #cx-export-btn .cx-btn-text {
            padding: 12px 16px 12px 4px;
            white-space: nowrap;
        }
        #cx-export-status {
            margin-top: 8px;
            background: rgba(30,30,40,0.92);
            backdrop-filter: blur(8px);
            color: #fff;
            border-radius: 10px;
            padding: 14px 18px;
            font-size: 13px;
            min-width: 240px;
            display: none;
            line-height: 1.6;
            border: 1px solid rgba(255,255,255,0.08);
        }
        #cx-export-status .status-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
        }
        #cx-export-status .status-close {
            cursor: pointer;
            opacity: 0.5;
            font-size: 16px;
            line-height: 1;
            padding: 0 4px;
        }
        #cx-export-status .status-close:hover { opacity: 1; }
        #cx-export-status .progress-bar {
            height: 4px;
            background: rgba(255,255,255,0.15);
            border-radius: 2px;
            margin-top: 8px;
            overflow: hidden;
        }
        #cx-export-status .progress-bar-inner {
            height: 100%;
            background: linear-gradient(90deg, #3a8bff, #6cb4ff);
            width: 0%;
            transition: width 0.3s;
            border-radius: 2px;
        }
        #cx-export-status .log {
            max-height: 180px;
            overflow-y: auto;
            font-size: 12px;
            color: #ccc;
            margin-top: 6px;
            scrollbar-width: thin;
        }
        #cx-export-status .log div { margin: 2px 0; padding: 1px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    `);

    // ---- 创建包裹容器 ----
    const wrapper = document.createElement('div');
    wrapper.id = 'cx-export-wrapper';

    // ---- 创建拖拽手柄（6点图标） ----
    const dragSvg = `
        <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <circle cx="5" cy="4" r="1.2"/>
            <circle cx="11" cy="4" r="1.2"/>
            <circle cx="5" cy="8" r="1.2"/>
            <circle cx="11" cy="8" r="1.2"/>
            <circle cx="5" cy="12" r="1.2"/>
            <circle cx="11" cy="12" r="1.2"/>
        </svg>`;

    // ---- 创建按钮 ----
    const btn = document.createElement('div');
    btn.id = 'cx-export-btn';
    btn.innerHTML = `
        <span class="cx-drag-handle">${dragSvg}</span>
        <span class="cx-btn-text">📥 导出全部课表</span>
    `;
    wrapper.appendChild(btn);

    // ---- 创建状态面板 ----
    const statusPanel = document.createElement('div');
    statusPanel.id = 'cx-export-status';
    statusPanel.innerHTML = `
        <div class="status-header">
            <strong>⏳ 提取课表中...</strong>
            <span class="status-close">✕</span>
        </div>
        <div class="status-text">准备中...</div>
        <div class="progress-bar"><div class="progress-bar-inner"></div></div>
        <div class="log"></div>
    `;
    wrapper.appendChild(statusPanel);

    document.body.appendChild(wrapper);

    // ---- 拖拽功能 ----
    let isDragging = false;
    let dragTarget = null;
    let startX, startY, origX, origY;

    function makeDraggable(handleEl, targetEl) {
        handleEl.addEventListener('mousedown', startDrag);
        // 触摸支持
        handleEl.addEventListener('touchstart', startDragTouch, { passive: false });

        function startDrag(e) {
            if (btn.disabled && handleEl === btn) return;
            isDragging = true;
            dragTarget = targetEl;
            const rect = targetEl.getBoundingClientRect();
            origX = rect.left;
            origY = rect.top;
            startX = e.clientX;
            startY = e.clientY;
            targetEl.style.transition = 'none';
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', stopDrag);
            e.preventDefault();
        }

        function startDragTouch(e) {
            if (btn.disabled && handleEl === btn) return;
            const touch = e.touches[0];
            if (!touch) return;
            isDragging = true;
            dragTarget = targetEl;
            const rect = targetEl.getBoundingClientRect();
            origX = rect.left;
            origY = rect.top;
            startX = touch.clientX;
            startY = touch.clientY;
            targetEl.style.transition = 'none';
            document.addEventListener('touchmove', onDragTouch, { passive: false });
            document.addEventListener('touchend', stopDragTouch);
            e.preventDefault();
        }

        function onDrag(e) {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            dragTarget.style.left = `${origX + dx}px`;
            dragTarget.style.top = `${origY + dy}px`;
            dragTarget.style.right = 'auto';
            dragTarget.style.bottom = 'auto';
        }

        function onDragTouch(e) {
            if (!isDragging) return;
            const touch = e.touches[0];
            if (!touch) return;
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            dragTarget.style.left = `${origX + dx}px`;
            dragTarget.style.top = `${origY + dy}px`;
            dragTarget.style.right = 'auto';
            dragTarget.style.bottom = 'auto';
            e.preventDefault();
        }

        function stopDrag() {
            isDragging = false;
            dragTarget.style.transition = '';
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
        }

        function stopDragTouch() {
            isDragging = false;
            dragTarget.style.transition = '';
            document.removeEventListener('touchmove', onDragTouch);
            document.removeEventListener('touchend', stopDragTouch);
        }
    }

    // 按钮整体可拖拽（通过手柄区域）
    makeDraggable(btn.querySelector('.cx-drag-handle'), wrapper);
    // 状态面板可拖拽（通过标题栏）
    makeDraggable(statusPanel.querySelector('.status-header'), wrapper);

    // 关闭状态面板
    statusPanel.querySelector('.status-close').addEventListener('click', function() {
        statusPanel.style.display = 'none';
    });

    // 修正：点击按钮文本区域触发导出（不包括手柄）
    btn.querySelector('.cx-btn-text').addEventListener('click', startExport);

    // ==================== 辅助函数 ====================

    function log(msg) {
        const logDiv = statusPanel.querySelector('.log');
        const entry = document.createElement('div');
        entry.textContent = `> ${msg}`;
        logDiv.appendChild(entry);
        logDiv.scrollTop = logDiv.scrollHeight;
        console.log(`[课表导出] ${msg}`);
    }

    function setStatus(text, progress) {
        statusPanel.querySelector('.status-text').textContent = text;
        if (progress !== undefined) {
            statusPanel.querySelector('.progress-bar-inner').style.width = `${progress}%`;
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /** 获取星期几（根据col类名） */
    function getWeekdayFromCol(colNum) {
        const map = {1:'周一', 2:'周二', 3:'周三', 4:'周四', 5:'周五', 6:'周六', 7:'周日'};
        return map[colNum] || '';
    }

    /** 从当前DOM提取课程数据 */
    function extractCurrentWeekCourses(weekNum) {
        const courses = [];
        const table = document.getElementById('scheduleTable');
        if (!table) {
            log('⚠️ 未找到课表表格');
            return courses;
        }

        // 遍历所有带 rowspan 的 td（即包含课程的单元格）
        const courseCells = table.querySelectorAll('td[rowspan]');
        courseCells.forEach(td => {
            // 确定列（星期几）
            let colNum = 0;
            for (let i = 1; i <= 7; i++) {
                if (td.classList.contains(`col${i}`)) {
                    colNum = i;
                    break;
                }
            }
            if (!colNum) return;

            // 课程名称
            const nameEl = td.querySelector('.courseName');
            if (!nameEl || !nameEl.textContent.trim()) return;
            const courseName = nameEl.textContent.trim();

            // 上课地点
            const locEl = td.querySelector('.courseLoc');
            let location = locEl ? locEl.textContent.trim().replace(/^@/, '') : '';

            // 获取此课的 lessonid 和 uuid（用于后续去重）
            const lessonId = td.getAttribute('lessonid') || '';
            const uuid = td.getAttribute('uuid') || '';

            // 尝试从 JavaScript 内存中获取周次信息
            // Schedule.dailyLessonMap 存有当前加载周的课程数据
            let weeksStr = '';
            let weekType = '';
            try {
                if (typeof Schedule !== 'undefined' && Schedule.dailyLessonMap) {
                    const lesson = Schedule.dailyLessonMap.get(uuid);
                    if (lesson && lesson.weeks) {
                        weeksStr = lesson.weeks;
                        if (lesson.weekType !== undefined) {
                            const typeMap = {0: '双周', 1: '单周', 2: '全周'};
                            weekType = typeMap[lesson.weekType] || '';
                        }
                    }
                }
            } catch(e) {
                // 无法访问JS内存，忽略
            }

            // 获取节次范围
            let sectionStart = 0, sectionEnd = 0;
            const rowspan = parseInt(td.getAttribute('rowspan')) || 1;
            
            // 根据所在行确定起始节次
            const tr = td.closest('tr');
            if (tr) {
                const tbody = tr.parentElement;
                const rows = tbody.querySelectorAll('tr');
                for (let i = 0; i < rows.length; i++) {
                    if (rows[i] === tr) {
                        sectionStart = i + 1;
                        sectionEnd = sectionStart + rowspan - 1;
                        break;
                    }
                }
            }

            // 如果从DOM获取不到周次，标记为"待定"
            if (!weeksStr) {
                weeksStr = '待补充';
            }

            courses.push({
                week: weekNum,
                day: getWeekdayFromCol(colNum),
                dayCol: colNum,
                sectionStart,
                sectionEnd,
                courseName,
                location,
                weeks: weeksStr,
                weekType,
                lessonId,
                uuid,
            });
        });

        return courses;
    }

    /** 切换到指定周 */
    function switchToWeek(weekNum) {
        return new Promise((resolve) => {
            // 触发周次选择
            const weekSpan = document.querySelector('.selectWeek .week');
            if (!weekSpan) {
                resolve(false);
                return;
            }

            // 尝试通过点击周选择器来切换
            const weekList = document.querySelector('.selectWeek .selectList');
            if (weekList) {
                // 有下拉列表
                weekSpan.click();
                setTimeout(() => {
                    const items = weekList.querySelectorAll('li p');
                    let found = false;
                    items.forEach(item => {
                        if (item.textContent.includes(`第${weekNum}周`)) {
                            item.click();
                            found = true;
                        }
                    });
                    if (!found) {
                        // 尝试直接设置
                        weekSpan.click(); // 关闭下拉
                        resolve(false);
                        return;
                    }
                }, 200);
            } else {
                // 尝试通过prevWeek/nextWeek 或者直接设置 week 属性
                const prevBtn = document.querySelector('.prevWeek');
                const nextBtn = document.querySelector('.nextWeek');
                const currentWeek = parseInt(weekSpan.getAttribute('week')) || 1;
                
                if (weekNum > currentWeek && nextBtn) {
                    // 循环点击下一周
                    let clicks = weekNum - currentWeek;
                    const clickNext = () => {
                        if (clicks <= 0) { resolve(true); return; }
                        nextBtn.click();
                        clicks--;
                        setTimeout(clickNext, 300);
                    };
                    clickNext();
                    return;
                } else if (weekNum < currentWeek && prevBtn) {
                    let clicks = currentWeek - weekNum;
                    const clickPrev = () => {
                        if (clicks <= 0) { resolve(true); return; }
                        prevBtn.click();
                        clicks--;
                        setTimeout(clickPrev, 300);
                    };
                    clickPrev();
                    return;
                }
            }

            // 默认等待
            setTimeout(() => resolve(true), CONFIG.switchDelay);
        });
    }

    /** 直接通过 Schedule.loadLessons 切换周次（内部API） */
    function loadWeekDirectly(weekNum) {
        return new Promise((resolve) => {
            try {
                if (typeof Schedule !== 'undefined' && typeof Schedule.loadLessons === 'function') {
                    Schedule.loadLessons(weekNum);
                    
                    // 更新显示的周次
                    const weekSpan = document.querySelector('.selectWeek .week');
                    if (weekSpan) {
                        weekSpan.textContent = `第${weekNum}周`;
                        weekSpan.setAttribute('week', weekNum);
                    }
                    
                    setTimeout(resolve, CONFIG.switchDelay);
                } else {
                    resolve(false);
                }
            } catch(e) {
                log(`⚠️ loadLessons 调用失败: ${e.message}`);
                resolve(false);
            }
        });
    }

    /** 从 dailyLessonMap 提取所有课程（包含完整周次信息） */
    function extractFromDailyLessonMap() {
        const courses = [];
        try {
            if (typeof Schedule === 'undefined' || !Schedule.dailyLessonMap) {
                log('⚠️ 无法访问 Schedule.dailyLessonMap');
                return courses;
            }

            Schedule.dailyLessonMap.forEach((lesson, uuid) => {
                if (!lesson || !lesson.name) return;
                
                const dayMap = {1:'周一',2:'周二',3:'周三',4:'周四',5:'周五',6:'周六',7:'周日'};
                const typeMap = {0:'双周',1:'单周',2:'每周'};
                
                let location = lesson.location || '';
                // 如果有线上地点
                if (lesson.onlineLocation) {
                    location = location ? `${location} / ${lesson.onlineLocation}` : lesson.onlineLocation;
                }
                
                courses.push({
                    courseName: lesson.name,
                    day: dayMap[lesson.dayOfWeek] || '',
                    dayOfWeek: lesson.dayOfWeek,
                    beginNumber: lesson.beginNumber,
                    length: lesson.length,
                    location: location,
                    weeks: lesson.weeks || '',
                    weekType: typeMap[lesson.weekType] || '',
                    teacherName: lesson.teacherName || '',
                    className: lesson.className || '',
                    uuid: uuid,
                });
            });
        } catch(e) {
            log(`❌ 读取 dailyLessonMap 出错: ${e.message}`);
        }
        return courses;
    }

    /** 展开周次字符串为数组 */
    function expandWeeks(weeksStr) {
        if (!weeksStr || weeksStr === '待补充') return [];
        const result = [];
        const parts = weeksStr.split(',');
        parts.forEach(p => {
            p = p.trim();
            if (p.includes('-')) {
                const [s, e] = p.split('-').map(Number);
                for (let i = s; i <= e; i++) result.push(i);
            } else if (p) {
                result.push(parseInt(p));
            }
        });
        return result.filter(n => !isNaN(n));
    }

    /** 将课程数据转为CSV */
    function toCSV(courses) {
        // 按周、星期、节次排序
        courses.sort((a, b) => {
            if (a.week !== b.week) return a.week - b.week;
            if (a.dayCol !== b.dayCol) return a.dayCol - b.dayCol;
            return a.sectionStart - b.sectionStart;
        });

        const headers = ['周次', '星期', '节次', '上课时间', '课程名称', '上课地点', '上课周次', '周类型'];
        const rows = [headers.join(',')];

        // 时间映射
        const timeMap = {
            1:'8:00-8:50', 2:'9:00-9:50', 3:'10:10-11:00', 4:'11:10-12:00',
            5:'14:00-14:50', 6:'15:00-15:50', 7:'16:10-17:00', 8:'17:10-18:00',
            9:'19:00-19:50', 10:'20:00-20:50', 11:'21:00-21:50', 12:'22:00-22:50'
        };

        courses.forEach(c => {
            const sectionStr = c.sectionStart === c.sectionEnd 
                ? `第${c.sectionStart}节` 
                : `第${c.sectionStart}-${c.sectionEnd}节`;
            const timeStr = timeMap[c.sectionStart] || '';
            if (c.sectionEnd && c.sectionEnd !== c.sectionStart) {
                // 跨节次的时间
                const endTime = timeMap[c.sectionEnd] || '';
                const timeRange = `${timeMap[c.sectionStart] || ''}-${endTime.split('-')[1] || ''}`;
            }

            const row = [
                c.week,
                c.day,
                sectionStr,
                timeStr,
                `"${c.courseName}"`,
                `"${c.location}"`,
                c.weeks,
                c.weekType,
            ];
            rows.push(row.join(','));
        });

        return rows.join('\n');
    }

    /** 导出CSV文件 */
    function downloadCSV(content, filename) {
        const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /** 导出JSON文件 */
    function downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ==================== 主流程 ====================

    async function startExport() {
        if (wrapper.classList.contains('is-exporting')) return;
        wrapper.classList.add('is-exporting');
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.7';
        btn.querySelector('.cx-btn-text').textContent = '⏳ 提取中...';
        statusPanel.style.display = 'block';
        statusPanel.querySelector('.log').innerHTML = '';

        log('🚀 开始提取课表数据...');

        // 先获取当前周和最大周
        let currentWeek = 14;
        let maxWeek = 25;
        try {
            const weekSpan = document.querySelector('.selectWeek .week');
            if (weekSpan && weekSpan.getAttribute('week')) {
                currentWeek = parseInt(weekSpan.getAttribute('week'));
            }
            if (typeof Schedule !== 'undefined' && Schedule.curriculum) {
                maxWeek = Schedule.curriculum.maxWeek || 25;
                log(`📅 学期: ${Schedule.curriculum.schoolYear || ''} 第${Schedule.curriculum.semester || ''}学期`);
                log(`📅 总教学周: ${maxWeek}周, 当前周: ${currentWeek}`);
            }
        } catch(e) {
            log(`⚠️ 获取学期信息失败: ${e.message}`);
        }

        // 先尝试从 dailyLessonMap 获取带周次信息的课程列表
        log('🔍 尝试从内存中读取课程周次信息...');
        const lessonFromMemory = extractFromDailyLessonMap();
        if (lessonFromMemory.length > 0) {
            log(`✅ 从内存中读取到 ${lessonFromMemory.length} 个课程配置`);
            
            // 展开所有课程到每一周
            const allCourses = [];
            lessonFromMemory.forEach(lesson => {
                const weeks = expandWeeks(lesson.weeks);
                if (weeks.length > 0) {
                    weeks.forEach(w => {
                        if (w <= maxWeek) {
                            const sectionStr = lesson.beginNumber === lesson.beginNumber + lesson.length - 1
                                ? `第${lesson.beginNumber}节`
                                : `第${lesson.beginNumber}-${lesson.beginNumber + lesson.length - 1}节`;
                            const timeMap = {1:'8:00-8:50',2:'9:00-9:50',3:'10:10-11:00',4:'11:10-12:00',5:'14:00-14:50',6:'15:00-15:50',7:'16:10-17:00',8:'17:10-18:00',9:'19:00-19:50',10:'20:00-20:50',11:'21:00-21:50',12:'22:00-22:50'};
                            
                            allCourses.push({
                                week: w,
                                day: lesson.day,
                                dayCol: lesson.dayOfWeek,
                                sectionStart: lesson.beginNumber,
                                sectionEnd: lesson.beginNumber + lesson.length - 1,
                                courseName: lesson.courseName,
                                location: lesson.location,
                                weeks: lesson.weeks,
                                weekType: lesson.weekType,
                            });
                        }
                    });
                }
            });

            if (allCourses.length > 0) {
                log(`✅ 成功展开 ${allCourses.length} 条课表记录`);
                
                // 去重（同一周、同一天、同节次、同课程只保留一条）
                const unique = [];
                const seen = new Set();
                allCourses.forEach(c => {
                    const key = `${c.week}-${c.dayCol}-${c.sectionStart}-${c.courseName}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        unique.push(c);
                    }
                });
                
                log(`📊 去重后共 ${unique.length} 条记录`);

                // 导出
                const timestamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
                if (CONFIG.format === 'json') {
                    downloadJSON(unique, `超星课表_${timestamp}.json`);
                } else {
                    const csv = toCSV(unique);
                    downloadCSV(csv, `超星课表_${timestamp}.csv`);
                }
                
                log(`✅ 导出完成！共 ${unique.length} 条记录`);
                setStatus('✅ 导出完成！', 100);
                wrapper.classList.remove('is-exporting');
                btn.style.pointerEvents = '';
                btn.style.opacity = '';
                btn.querySelector('.cx-btn-text').textContent = '📥 导出全部课表';
                return;
            }
        }

        // 如果内存方式失败，回退到逐周遍历DOM
        log('⚠️ 内存读取失败，回退到逐周遍历模式...');
        log('⏳ 遍历第1周到第' + maxWeek + '周...');

        // 先回到第1周（除非已经在第1周）
        if (currentWeek !== 1) {
            log(`📌 切换到第1周...`);
            await switchToWeek(1);
            await sleep(CONFIG.switchDelay);
        }

        const allCourses = [];

        for (let w = 1; w <= maxWeek; w++) {
            setStatus(`正在提取第 ${w}/${maxWeek} 周...`, (w / maxWeek) * 100);
            log(`📌 提取第${w}周...`);

            // 如果不是第1周，切换
            if (w > 1) {
                const ok = await switchToWeek(w);
                if (!ok) {
                    log(`⚠️ 无法切换到第${w}周`);
                    continue;
                }
                await sleep(CONFIG.switchDelay);
            }

            // 提取当前周数据
            const courses = extractCurrentWeekCourses(w);
            log(`   找到 ${courses.length} 门课程`);
            allCourses.push(...courses);
        }

        // 去重
        const unique = [];
        const seen = new Set();
        allCourses.forEach(c => {
            const key = `${c.week}-${c.dayCol}-${c.sectionStart}-${c.courseName}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(c);
            }
        });

        log(`📊 总计 ${unique.length} 条课表记录`);

        // 导出
        const timestamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
        if (CONFIG.format === 'json') {
            downloadJSON(unique, `超星课表_${timestamp}.json`);
        } else {
            const csv = toCSV(unique);
            downloadCSV(csv, `超星课表_${timestamp}.csv`);
        }

        log(`✅ 导出完成！`);
        setStatus('✅ 导出完成！', 100);
        wrapper.classList.remove('is-exporting');
        btn.style.pointerEvents = '';
        btn.style.opacity = '';
        btn.querySelector('.cx-btn-text').textContent = '📥 导出全部课表';
    }

    // ==================== 绑定事件 ====================

    // 页面加载完成后自动开始（可选）
    if (CONFIG.autoStart) {
        setTimeout(startExport, 2000);
    }

    log('📥 超星课表导出器已加载，点击右上角按钮开始导出');
})();
