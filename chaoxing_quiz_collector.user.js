// ==UserScript==
// @name         学习通题目收集器（安全版）
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  📝 手动收集学习通章节测验题目——你自己翻页，脚本只提取当前页面内容。绝不自动请求，绝不被封。
// @author       foweh
// @match        https://mooc2-ans.chaoxing.com/mycourse/studentcourse*
// @match        https://mooc2-ans.chaoxing.com/work/*
// @match        https://mooc2-ans.chaoxing.com/*
// @match        https://*.chaoxing.com/*
// @icon         https://www.chaoxing.com/favicon.ico
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ====== 样式 ======
    GM_addStyle(`
        #cx-quiz-panel {
            position: fixed; top: 80px; right: 20px; z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            user-select: none; font-size: 14px;
            display: flex; flex-direction: column; gap: 6px;
        }
        .cx-q-btn {
            background: #3a8bff; color: #fff; border: none; border-radius: 8px;
            padding: 10px 18px; font-size: 14px; font-weight: bold; cursor: pointer;
            box-shadow: 0 4px 12px rgba(58,139,255,0.35);
            transition: all 0.2s; white-space: nowrap;
        }
        .cx-q-btn:hover { background: #2970e0; transform: translateY(-1px); }
        .cx-q-btn:disabled { background: #aaa; cursor: not-allowed; transform: none; }
        .cx-q-btn-sm { padding: 6px 12px; font-size: 12px; }
        .cx-q-btn-green { background: #28a745; }
        .cx-q-btn-green:hover { background: #1e8e3e; }
        .cx-q-btn-orange { background: #fd7e14; }
        .cx-q-btn-orange:hover { background: #e06b0a; }

        #cx-q-status {
            margin-top: 4px; background: rgba(30,30,40,0.92);
            backdrop-filter: blur(8px); color: #fff; border-radius: 10px;
            padding: 12px 16px; font-size: 13px; min-width: 260px;
            display: none; line-height: 1.6;
            border: 1px solid rgba(255,255,255,0.08);
        }
        #cx-q-status .head {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 4px; cursor: grab;
        }
        #cx-q-status .close { cursor: pointer; opacity: 0.5; font-size: 15px; }
        #cx-q-status .close:hover { opacity: 1; }
        #cx-q-status .log { max-height: 150px; overflow-y: auto; font-size: 12px; color: #ccc; margin-top: 4px; }
        #cx-q-status .log div { padding: 1px 0; }
        #cx-q-status .count { font-size: 13px; margin: 4px 0; }
        .cx-q-count-badge {
            display: inline-block; background: #3a8bff; color: #fff;
            border-radius: 10px; padding: 0 8px; font-size: 12px; line-height: 20px;
        }

        /* 收集列表弹窗 */
        #cx-q-list-modal {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999999;
            background: rgba(0,0,0,0.5); display: none;
            align-items: center; justify-content: center;
        }
        #cx-q-list-modal .modal {
            background: #fff; border-radius: 12px; padding: 24px;
            max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        #cx-q-list-modal .modal h2 { margin: 0 0 16px; font-size: 18px; color: #333; }
        #cx-q-list-modal .modal .item {
            padding: 10px 14px; border: 1px solid #e0e0e0; border-radius: 8px;
            margin-bottom: 8px; cursor: default;
        }
        #cx-q-list-modal .modal .item .q-text { font-weight: bold; color: #222; margin-bottom: 4px; }
        #cx-q-list-modal .modal .item .q-meta { font-size: 12px; color: #888; }
        #cx-q-list-modal .modal .item .q-answer { color: #28a745; font-weight: bold; margin-top: 4px; display: none; }
        #cx-q-list-modal .modal .item.show-answer .q-answer { display: block; }
        #cx-q-list-modal .modal .close-btn {
            float: right; background: #eee; border: none; border-radius: 6px;
            padding: 6px 16px; cursor: pointer; font-size: 14px; margin-top: -4px;
        }
        #cx-q-list-modal .modal .close-btn:hover { background: #ddd; }
        #cx-q-list-modal .modal .export-bar {
            display: flex; gap: 8px; margin: 16px 0 8px; flex-wrap: wrap;
        }
        #cx-q-list-modal .modal .export-bar button { font-size: 13px; padding: 8px 16px; }
        #cx-q-list-modal .modal .course-filter { margin-bottom: 12px; }
        #cx-q-list-modal .modal .course-filter select {
            padding: 6px 10px; border-radius: 6px; border: 1px solid #ddd; font-size: 13px;
        }

        /* 答题练习模式 */
        .cx-q-practice-mode .q-answer { display: none !important; }
        .cx-q-practice-mode .q-show-answer-btn { display: inline-block !important; }
        .cx-q-show-answer-btn {
            display: none; font-size: 12px; color: #3a8bff; cursor: pointer;
            margin-left: 8px; text-decoration: underline;
        }
        #cx-q-list-modal .modal .item .q-show-answer-btn { display: none; }
    `);

    // ====== 数据存储 ======
    let collected = GM_getValue('cx_collected_questions', []);

    function save() {
        GM_setValue('cx_collected_questions', collected);
    }

    // ====== 提取当前页面的题目 ======
    function extractQuestionsFromPage() {
        const questions = [];

        // 方法1: 从 work/doWork 页面提取（作业/测验答题页）
        // 结构: form.workForm 里面的题目
        const workForm = document.querySelector('form.workForm');
        if (workForm) {
            // 获取课程名称
            let courseName = '';
            const titleEl = document.querySelector('.mark_name, .courseName, .topTitle, h1, h2');
            if (titleEl) courseName = titleEl.textContent.trim();

            // 获取测验名称
            let quizName = '';
            const quizTitle = document.querySelector('.ti, .title, .workTitle, .paperTitle, h3');
            if (quizTitle) quizName = quizTitle.textContent.trim();

            // 遍历所有题目
            const qDivs = workForm.querySelectorAll('.questionLi, .question, .TiMu, [class*="question"]');
            qDivs.forEach(qDiv => {
                const q = parseQuestionDiv(qDiv);
                if (q) {
                    q.courseName = courseName;
                    q.quizName = quizName;
                    q.sourceUrl = window.location.href;
                    questions.push(q);
                }
            });

            if (questions.length > 0) return questions;
        }

        // 方法2: 从 iframe 的内容提取（测验在 iframe 中打开的情况）
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                if (doc) {
                    const form = doc.querySelector('form.workForm');
                    if (form) {
                        let courseName = '';
                        const titleEl = doc.querySelector('.mark_name, .courseName, .topTitle, h1, h2');
                        if (titleEl) courseName = titleEl.textContent.trim();

                        let quizName = '';
                        const quizTitle = doc.querySelector('.ti, .title, .workTitle, .paperTitle, h3');
                        if (quizTitle) quizName = quizTitle.textContent.trim();

                        const qDivs = form.querySelectorAll('.questionLi, .question, .TiMu, [class*="question"]');
                        qDivs.forEach(qDiv => {
                            const q = parseQuestionDiv(qDiv);
                            if (q) {
                                q.courseName = courseName;
                                q.quizName = quizName;
                                q.sourceUrl = iframe.src || window.location.href;
                                questions.push(q);
                            }
                        });
                    }
                }
            } catch(e) { /* 跨域 iframe 无法访问，跳过 */ }
        });

        if (questions.length > 0) return questions;

        // 方法3: 从页面任何包含题目结构的区域提取（宽松匹配）
        const allDivs = document.querySelectorAll('div[class*="TiMu"], div[class*="question"], li[class*="TiMu"], li[class*="question"]');
        allDivs.forEach(qDiv => {
            const q = parseQuestionDiv(qDiv);
            if (q) {
                q.sourceUrl = window.location.href;
                questions.push(q);
            }
        });

        return questions;
    }

    function parseQuestionDiv(qDiv) {
        // 获取题目标题
        let title = '';
        const titleEl = qDiv.querySelector('.Zy_TItle, .questionTitle, .title, .TiMuTitle, h4, h5, [class*="title"]');
        if (titleEl) title = titleEl.textContent.trim();

        if (!title) {
            // 尝试直接拿文本
            const text = qDiv.textContent.trim();
            if (text.length > 5 && text.length < 500) {
                title = text.substring(0, 200);
            }
        }
        if (!title) return null;

        // 获取题型（单选题、多选题等）
        let type = '';
        const typeEl = qDiv.querySelector('.type, .questionType, .qType, .fl, [class*="type"]');
        if (typeEl) type = typeEl.textContent.trim();
        if (!type) {
            if (title.includes('单选题') || qDiv.className.includes('danxuan')) type = '单选题';
            else if (title.includes('多选题') || qDiv.className.includes('duoxuan')) type = '多选题';
            else if (title.includes('判断题') || qDiv.className.includes('panduan')) type = '判断题';
            else if (title.includes('填空题') || qDiv.className.includes('tiankong')) type = '填空题';
            else if (title.includes('简答题') || qDiv.className.includes('jianda')) type = '简答题';
        }
        // 清理标题中的题型标签
        title = title.replace(/^[【\[\(（]?第\d+题[】\)）]?/g, '').trim();
        for (const t of ['单选题', '多选题', '判断题', '填空题', '简答题', '论述题', '名词解释']) {
            title = title.replace(t, '').trim();
        }

        // 获取选项
        const options = [];
        const optionEls = qDiv.querySelectorAll('.option, .selectOption, .radio, .checkbox, li, [class*="option"], [class*="answer"]');
        optionEls.forEach(opt => {
            const text = opt.textContent.trim();
            if (text && text.length > 0 && text.length < 300 && !text.includes('正确答案')) {
                // 过滤掉非选项元素
                const isOption = /^[A-Z][.、．]/.test(text) || /^[A-Z]$/.test(text.trim()) || opt.closest('.questionLi') || opt.closest('.TiMu');
                if (isOption || text.length < 100) {
                    options.push(text);
                }
            }
        });

        // 获取正确答案
        let answer = '';
        // 尝试多种方式找答案
        const answerEl = qDiv.querySelector('.answer, .rightAnswer, .correctAnswer, [class*="answer"], [class*="Answer"], [class*="right"]');
        if (answerEl) {
            answer = answerEl.textContent.trim();
            answer = answer.replace(/^(正确答案|答案|正确)[：:]\s*/g, '').trim();
        }
        // 查找输入框中已填的答案（学生已提交的答案）
        if (!answer) {
            const inputs = qDiv.querySelectorAll('input[type="text"], input:not([type]), textarea');
            inputs.forEach(inp => {
                if (inp.value && inp.value.trim()) {
                    answer = inp.value.trim();
                }
            });
        }
        // 查找被选中的radio/checkbox
        if (!answer) {
            const checked = qDiv.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked');
            if (checked.length > 0) {
                answer = Array.from(checked).map(c => {
                    const label = qDiv.querySelector(`label[for="${c.id}"]`);
                    return label ? label.textContent.trim() : c.value;
                }).join('; ');
            }
        }

        return {
            title: title,
            type: type || '未知题型',
            options: options,
            answer: answer || '',
            pageUrl: window.location.href,
        };
    }

    // ====== 收集按钮 ======
    function addQuestion() {
        const qs = extractQuestionsFromPage();
        if (qs.length === 0) {
            log('❌ 当前页面没有找到题目');
            log('💡 提示：请打开章节测验答题页面后再点"收集"');
            setStatus(`未找到题目`, 0);
            return;
        }

        // 去重（相同标题视为重复）
        let added = 0;
        qs.forEach(q => {
            const isDup = collected.some(c =>
                c.title === q.title && c.courseName === q.courseName
            );
            if (!isDup) {
                collected.push(q);
                added++;
            }
        });
        save();
        log(`✅ 已收集 ${added} 道新题目（去重后）`);
        setStatus(`已收集 ${collected.length} 题`, collected.length);
        showCollectedList();
    }

    function clearAll() {
        if (confirm('确定清空所有已收集的题目吗？')) {
            collected = [];
            save();
            log('🗑️ 已清空所有题目');
            setStatus('已清空', 0);
        }
    }

    // ====== 显示收集列表 ======
    function showCollectedList() {
        let modal = document.getElementById('cx-q-list-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'cx-q-list-modal';
            document.body.appendChild(modal);
        }

        // 按课程分组
        const byCourse = {};
        collected.forEach(q => {
            const course = q.courseName || '未分类';
            if (!byCourse[course]) byCourse[course] = [];
            byCourse[course].push(q);
        });

        let courseOptions = '<option value="">-- 全部课程 --</option>';
        Object.keys(byCourse).sort().forEach(c => {
            courseOptions += `<option value="${c.replace(/"/g,'&quot;')}">${c} (${byCourse[c].length}题)</option>`;
        });

        let html = `
        <div class="modal">
            <button class="close-btn" onclick="document.getElementById('cx-q-list-modal').style.display='none'">✕ 关闭</button>
            <h2>📝 已收集题目 <span class="cx-q-count-badge">${collected.length}题</span></h2>
            <div class="export-bar">
                <button class="cx-q-btn cx-q-btn-sm" onclick="document.querySelector('#cx-q-list-modal .item.show-answer').classList.remove('show-answer')">🙈 隐藏答案</button>
                <button class="cx-q-btn cx-q-btn-sm cx-q-btn-green" onclick="document.querySelectorAll('#cx-q-list-modal .item').forEach(e=>e.classList.add('show-answer'))">👁 显示答案</button>
                <button class="cx-q-btn cx-q-btn-sm cx-q-btn-orange" onclick="exportHTML()">📥 导出HTML</button>
                <button class="cx-q-btn cx-q-btn-sm" onclick="exportJSON()">📥 导出JSON</button>
                <button class="cx-q-btn cx-q-btn-sm cx-q-btn-green" onclick="exportByCourse()">📁 按课程分文件夹导出</button>
            </div>
            <div class="course-filter">
                <select id="cx-q-course-filter" onchange="filterByCourse()">
                    ${courseOptions}
                </select>
            </div>
            <div id="cx-q-list-content">`;

        Object.keys(byCourse).sort().forEach(course => {
            html += `<h3 style="margin:12px 0 6px;color:#555;">📂 ${course} (${byCourse[course].length}题)</h3>`;
            byCourse[course].forEach((q, idx) => {
                const optionsHtml = q.options.map(o => `<div style="padding:2px 0 2px 20px;font-size:13px;">${o}</div>`).join('');
                html += `
                <div class="item" data-course="${(course||'').replace(/"/g,'&quot;')}">
                    <div class="q-text">${q.type} ${q.title}</div>
                    ${optionsHtml}
                    <div class="q-answer">✅ 正确答案：${q.answer || '（未记录）'}</div>
                    <span class="cx-q-show-answer-btn" onclick="this.parentElement.classList.toggle('show-answer')">显示答案</span>
                    <div class="q-meta">📎 ${q.quizName || ''} ${q.sourceUrl ? '| 来源' : ''}</div>
                </div>`;
            });
        });

        html += `</div></div>`;
        modal.innerHTML = html;
        modal.style.display = 'flex';

        // 暴露全局函数供 onclick 调用
        window.exportHTML = exportHTML;
        window.exportJSON = exportJSON;
        window.exportByCourse = exportByCourse;
        window.filterByCourse = filterByCourse;
    }

    function filterByCourse() {
        const val = document.getElementById('cx-q-course-filter').value;
        document.querySelectorAll('#cx-q-list-content .item').forEach(item => {
            if (!val || item.dataset.course === val) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // ====== 导出 ======
    function exportHTML() {
        const allHtml = generateHTML(collected);
        const blob = new Blob(['\ufeff' + allHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `学习通题目_${new Date().toISOString().slice(0,10)}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        log('✅ 已导出HTML文件');
    }

    function exportJSON() {
        const blob = new Blob([JSON.stringify(collected, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `学习通题目_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        log('✅ 已导出JSON文件');
    }

    function exportByCourse() {
        const byCourse = {};
        collected.forEach(q => {
            const course = q.courseName || '未分类课程';
            if (!byCourse[course]) byCourse[course] = [];
            byCourse[course].push(q);
        });

        // 生成一个zip（模拟多文件下载，逐个下载）
        const courseNames = Object.keys(byCourse).sort();
        let delay = 0;
        courseNames.forEach(course => {
            const safeName = course.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 30);
            const html = generateHTML(byCourse[course], course);
            setTimeout(() => {
                const blob = new Blob(['\ufeff' + html], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${safeName}_题目.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, delay);
            delay += 500;
        });
        log(`✅ 已按课程分 ${courseNames.length} 个文件导出`);
    }

    function generateHTML(questions, courseName) {
        const title = courseName ? `${courseName} - 学习通题目` : '学习通题目';
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
    body { font-family: -apple-system, 'Microsoft YaHei', sans-serif; max-width: 900px; margin: 20px auto; padding: 0 20px; background: #f5f5f5; }
    h1 { color: #333; border-bottom: 2px solid #3a8bff; padding-bottom: 10px; }
    .question { background: #fff; border-radius: 10px; padding: 16px 20px; margin: 12px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .question .type { display: inline-block; background: #e8f4fd; color: #3a8bff; padding: 2px 10px; border-radius: 4px; font-size: 12px; }
    .question .title { font-weight: bold; font-size: 15px; margin: 8px 0; color: #222; }
    .question .options { padding-left: 20px; font-size: 14px; color: #444; }
    .question .options div { padding: 3px 0; }
    .question .answer { color: #28a745; font-weight: bold; margin-top: 8px; padding: 6px 12px; background: #f0fff4; border-radius: 6px; display: inline-block; }
    .question .meta { font-size: 12px; color: #999; margin-top: 6px; }
    .practice-mode { position: fixed; top: 20px; right: 20px; }
    .practice-mode button { padding: 8px 16px; background: #3a8bff; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .practice-mode button:hover { background: #2970e0; }
    .hide-answer .answer { display: none; }
    .hide-answer .show-answer-btn { display: inline-block !important; }
    .show-answer-btn { display: none; font-size: 12px; color: #3a8bff; cursor: pointer; margin-left: 8px; }
</style></head><body>
<div class="practice-mode">
    <button onclick="document.body.classList.toggle('hide-answer')">🙈 切换练习模式</button>
</div>
<h1>📝 ${title}</h1>
<p style="color:#888;">共 ${questions.length} 题 | 点击右上角切换练习模式（隐藏/显示答案）</p>`;

        const byCourse = {};
        questions.forEach(q => {
            const course = q.courseName || '未分类';
            if (!byCourse[course]) byCourse[course] = [];
            byCourse[course].push(q);
        });

        Object.keys(byCourse).sort().forEach(course => {
            html += `<h2 style="margin-top:24px;">📂 ${course}</h2>`;
            byCourse[course].forEach((q, idx) => {
                const opts = q.options.map(o => `<div>${o}</div>`).join('');
                const answerDiv = q.answer
                    ? `<div class="answer">✅ 正确答案：${q.answer} <span class="show-answer-btn" onclick="this.parentElement.style.display='none'">隐藏</span></div>`
                    : '';
                html += `
                <div class="question">
                    <span class="type">${q.type}</span>
                    <div class="title">${idx+1}. ${q.title}</div>
                    <div class="options">${opts}</div>
                    ${answerDiv}
                    <div class="meta">${q.quizName || ''}</div>
                </div>`;
            });
        });

        html += `<script>
            // 默认隐藏答案（练习模式）
            document.body.classList.add('hide-answer');
        <\/script>
</body></html>`;
        return html;
    }

    // ====== UI ======
    let statusPanel;

    function log(msg) {
        if (!statusPanel) return;
        const logDiv = statusPanel.querySelector('.log');
        const entry = document.createElement('div');
        entry.textContent = `> ${msg}`;
        logDiv.appendChild(entry);
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    function setStatus(text, count) {
        if (!statusPanel) return;
        statusPanel.querySelector('.status-text').textContent = text;
        if (count !== undefined) {
            statusPanel.querySelector('.count').innerHTML = `📦 已收集 <b>${count}</b> 题`;
        }
    }

    function initUI() {
        const panel = document.createElement('div');
        panel.id = 'cx-quiz-panel';
        panel.innerHTML = `
            <button id="cx-q-collect" class="cx-q-btn">📥 收集本页题目</button>
            <button id="cx-q-list" class="cx-q-btn cx-q-btn-green cx-q-btn-sm">📋 查看已收集 (0)</button>
            <div id="cx-q-status">
                <div class="head">
                    <span class="count">📦 已收集 <b>0</b> 题</span>
                    <span class="close">✕</span>
                </div>
                <div class="status-text">就绪</div>
                <div class="log"></div>
            </div>
        `;
        document.body.appendChild(panel);

        statusPanel = document.getElementById('cx-q-status');

        document.getElementById('cx-q-collect').addEventListener('click', addQuestion);
        document.getElementById('cx-q-list').addEventListener('click', function() {
            if (collected.length === 0) {
                log('📭 还没有收集任何题目，请先打开测验页面点击"收集本页题目"');
                return;
            }
            showCollectedList();
        });
        statusPanel.querySelector('.close').addEventListener('click', function() {
            statusPanel.style.display = 'none';
        });

        // 更新计数
        if (collected.length > 0) {
            document.getElementById('cx-q-list').textContent = `📋 查看已收集 (${collected.length})`;
            setStatus(`已收集 ${collected.length} 题`, collected.length);
        }

        log('📝 学习通题目收集器已加载');
        log('💡 打开章节测验 → 点击「收集本页题目」');
        log('🔒 纯手动收集，绝不自动请求，安全无忧');
    }

    // ====== 启动 ======
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }

})();
