// ==UserScript==
// @name         学习通章节测验自动导出器
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  📝 自动遍历学习通所有课程的章节测验题目，导出为练习文件。自动翻页+智能延迟，防封号。
// @author       foweh
// @match        https://mooc2-ans.chaoxing.com/mycourse/studentcourse*
// @match        https://mooc2-ans.chaoxing.com/visit/interaction*
// @match        https://mooc2-ans.chaoxing.com/visit/course/study*
// @match        https://mooc2-ans.chaoxing.com/work/*
// @match        https://*.chaoxing.com/*
// @icon         https://www.chaoxing.com/favicon.ico
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // =============================================
    //  ⚙️ 配置 —— 可自行调整
    // =============================================
    const CONFIG = {
        // 每次操作后的等待时间（毫秒）—— 建议 2000~5000
        delay: 3000,        // 基础延时
        delayRandom: 2000,  // 额外随机延时的最大值（最终延时 = delay + 0~delayRandom）
        // 翻页延时（一般比普通操作略长）
        pageDelay: 2500,
        pageDelayRandom: 1500,
        // 防检测：鼠标模拟（是否在操作前移动鼠标到目标元素）
        simulateMouse: true,
        // 导出格式: 'json' 或 'html'
        format: 'json',
        // 最大连续失败次数（超过则跳过当前章节）
        maxRetries: 3,
    };

    // =============================================
    //  样式
    // =============================================
    GM_addStyle(`
        #cx-qa-panel {
            position: fixed; top: 80px; right: 20px; z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            user-select: none; font-size: 14px;
            display: flex; flex-direction: column; gap: 6px;
            min-width: 200px;
        }
        .cx-qa-btn {
            background: #3a8bff; color: #fff; border: none; border-radius: 8px;
            padding: 10px 18px; font-size: 14px; font-weight: bold; cursor: pointer;
            box-shadow: 0 4px 12px rgba(58,139,255,0.35);
            transition: all 0.2s;
        }
        .cx-qa-btn:hover { background: #2970e0; transform: translateY(-1px); }
        .cx-qa-btn:disabled { background: #aaa; cursor: not-allowed; transform: none; }

        #cx-qa-status {
            margin-top: 4px; background: rgba(30,30,40,0.94);
            backdrop-filter: blur(8px); color: #fff; border-radius: 10px;
            padding: 14px 18px; font-size: 13px; min-width: 280px;
            display: none; line-height: 1.7;
            border: 1px solid rgba(255,255,255,0.08);
            max-height: 400px; overflow-y: auto;
        }
        #cx-qa-status .log { font-size: 12px; color: #ccc; max-height: 200px; overflow-y: auto; }
        #cx-qa-status .log div { padding: 1px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
        #cx-qa-status .log .info { color: #8ab4f8; }
        #cx-qa-status .log .success { color: #81c995; }
        #cx-qa-status .log .warn { color: #fdd663; }
        #cx-qa-status .log .error { color: #f28b82; }
        .cx-qa-progress { height: 4px; background: rgba(255,255,255,0.12); border-radius: 2px; margin: 6px 0; overflow: hidden; }
        .cx-qa-progress-inner { height: 100%; background: linear-gradient(90deg, #3a8bff, #6cb4ff); width: 0%; transition: width 0.5s; border-radius: 2px; }

        /* 速度控制 */
        .cx-qa-speed {
            display: flex; gap: 4px; align-items: center;
        }
        .cx-qa-speed label {
            color: rgba(255,255,255,0.6); font-size: 11px; cursor: pointer;
            padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15);
        }
        .cx-qa-speed label.active { background: #3a8bff; color: #fff; border-color: #3a8bff; }
    `);

    // =============================================
    //  UI 创建
    // =============================================
    const panel = document.createElement('div');
    panel.id = 'cx-qa-panel';
    panel.innerHTML = `
        <button class="cx-qa-btn" id="cx-qa-start">🚀 开始自动导出</button>
        <button class="cx-qa-btn" id="cx-qa-pause" style="display:none;background:#fd7e14;">⏸ 暂停</button>
        <div class="cx-qa-speed" id="cx-qa-speed">
            <label data-speed="slow">🐢 慢</label>
            <label data-speed="medium" class="active">🐇 中</label>
            <label data-speed="fast">🚀 快</label>
        </div>
        <div id="cx-qa-status">
            <div style="margin-bottom:4px;"><strong id="cx-qa-title">⏳ 准备中...</strong></div>
            <div class="cx-qa-progress"><div class="cx-qa-progress-inner" id="cx-qa-progress-bar"></div></div>
            <div style="font-size:12px;color:#aaa;" id="cx-qa-progress-text">0 / 0</div>
            <div class="log" id="cx-qa-log"></div>
        </div>
    `;
    document.body.appendChild(panel);

    const statusPanel = document.getElementById('cx-qa-status');
    const logDiv = document.getElementById('cx-qa-log');
    const startBtn = document.getElementById('cx-qa-start');
    const pauseBtn = document.getElementById('cx-qa-pause');
    const titleEl = document.getElementById('cx-qa-title');
    const progressBar = document.getElementById('cx-qa-progress-bar');
    const progressText = document.getElementById('cx-qa-progress-text');

    // =============================================
    //  状态
    // =============================================
    let isRunning = false;
    let isPaused = false;
    let collectedData = [];   // 收集到的所有题目
    let currentSpeed = 'medium';
    let stats = { totalChapters: 0, doneChapters: 0, totalQuestions: 0 };

    // =============================================
    //  日志 & UI
    // =============================================
    function log(msg, type = 'info') {
        const entry = document.createElement('div');
        entry.className = type;
        const time = new Date().toLocaleTimeString();
        entry.textContent = `[${time}] ${msg}`;
        logDiv.appendChild(entry);
        logDiv.scrollTop = logDiv.scrollHeight;
        console.log(`[学习通导出] ${msg}`);
    }

    function setTitle(text) { titleEl.textContent = text; }
    function setProgress(current, total) {
        const pct = total > 0 ? (current / total * 100) : 0;
        progressBar.style.width = `${pct}%`;
        progressText.textContent = `${current} / ${total}`;
    }

    function getActualDelay() {
        const speedMap = {
            slow: { delay: 5000, random: 3000, pageDelay: 4000, pageRandom: 3000 },
            medium: { delay: 3000, random: 2000, pageDelay: 2500, pageRandom: 1500 },
            fast: { delay: 1500, random: 1000, pageDelay: 1200, pageRandom: 800 },
        };
        const s = speedMap[currentSpeed] || speedMap.medium;
        return Math.floor(s.delay + Math.random() * s.random);
    }

    function getPageDelay() {
        const speedMap = {
            slow: { delay: 5000, random: 3000, pageDelay: 4000, pageRandom: 3000 },
            medium: { delay: 3000, random: 2000, pageDelay: 2500, pageRandom: 1500 },
            fast: { delay: 1500, random: 1000, pageDelay: 1200, pageRandom: 800 },
        };
        const s = speedMap[currentSpeed] || speedMap.medium;
        return Math.floor(s.pageDelay + Math.random() * s.pageRandom);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function humanDelay(type = 'normal') {
        const ms = type === 'page' ? getPageDelay() : getActualDelay();
        // 分小段 sleep，这样暂停可以立即响应
        const chunk = 200;
        let elapsed = 0;
        while (elapsed < ms) {
            if (isPaused) {
                // 等待恢复
                await new Promise(r => {
                    const check = setInterval(() => {
                        if (!isPaused) { clearInterval(check); r(); }
                    }, 200);
                });
            }
            if (!isRunning) return;
            await sleep(chunk);
            elapsed += chunk;
        }
    }

    // 模拟鼠标移动到元素（防检测）
    async function simulateMoveTo(el) {
        if (!CONFIG.simulateMouse || !el) return;
        try {
            const rect = el.getBoundingClientRect();
            const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 10;
            const y = rect.top + rect.height / 2 + (Math.random() - 0.5) * 10;
            // 派发鼠标事件
            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }));
            await sleep(100 + Math.random() * 200);
        } catch(e) { /* 忽略 */ }
    }

    // =============================================
    //  核心提取逻辑
    // =============================================

    /**
     * 从当前页面提取题目
     * 支持多种题型：单选题(1)、多选题(2)、判断题(3)、填空题(4)、简答题(5)
     */
    function extractQuestionsFromPage() {
        const questions = [];
        const qs = new Set(); // 去重

        // 方法1: 从 work 页面提取（作业/测验页面）
        // 学习通的作业/测验页面通常用 .TiMu 或 .question 等 class
        document.querySelectorAll('.TiMu, .questionLi, .question, .timu, [class*="TiMu"], [class*="question"]').forEach(el => {
            // 提取题目文本
            const qText = extractQuestionText(el);
            if (!qText || qs.has(qText)) return;
            qs.add(qText);

            const type = detectQuestionType(el);
            const options = extractOptions(el, type);
            const answer = extractAnswer(el);

            questions.push({
                type: type,
                question: qText,
                options: options,
                answer: answer,
                analysis: extractAnalysis(el),
            });
        });

        // 方法2: 从 iframe 中提取
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                if (doc) {
                    doc.querySelectorAll('.TiMu, .questionLi, .question').forEach(el => {
                        const qText = extractQuestionText(el);
                        if (!qText || qs.has(qText)) return;
                        qs.add(qText);
                        const type = detectQuestionType(el);
                        questions.push({
                            type: type,
                            question: qText,
                            options: extractOptions(el, type),
                            answer: extractAnswer(el),
                            analysis: extractAnalysis(el),
                        });
                    });
                }
            } catch(e) { /* 跨域 iframe 忽略 */ }
        });

        // 方法3: 从 React/Vue 渲染的页面中的特定结构提取
        // 超星新版的题目结构
        document.querySelectorAll('.question-card, .exam-card, .test-card, [class*="questionCard"]').forEach(el => {
            const qText = extractQuestionText(el);
            if (!qText || qs.has(qText)) return;
            qs.add(qText);
            const type = detectQuestionType(el);
            questions.push({
                type: type,
                question: qText,
                options: extractOptions(el, type),
                answer: extractAnswer(el),
                analysis: extractAnalysis(el),
            });
        });

        // 方法4: 从 window 中的全局变量提取
        try {
            if (window.questionList && Array.isArray(window.questionList)) {
                window.questionList.forEach(q => {
                    if (q && q.content && !qs.has(q.content)) {
                        qs.add(q.content);
                        questions.push({
                            type: q.type || '1',
                            question: q.content,
                            options: (q.options || []).map(o => o.content || o),
                            answer: q.answer || q.rightAnswer || '',
                            analysis: q.analysis || '',
                        });
                    }
                });
            }
        } catch(e) { /* 忽略 */ }

        // 方法5: 从某个已知的超星 API 响应数据中提取
        // 有时候数据存储在 data-* 属性中
        document.querySelectorAll('[data-question], [data-timu]').forEach(el => {
            try {
                const data = JSON.parse(el.getAttribute('data-question') || el.getAttribute('data-timu') || '{}');
                if (data && data.content && !qs.has(data.content)) {
                    qs.add(data.content);
                    questions.push({
                        type: data.type || '1',
                        question: data.content,
                        options: data.options || [],
                        answer: data.answer || '',
                        analysis: data.analysis || '',
                    });
                }
            } catch(e) { /* 忽略 */ }
        });

        return questions;
    }

    function extractQuestionText(el) {
        // 尝试多种选择器
        const selectors = [
            '.question-content, .questionContent, .q-content, .qContent',
            '.title, .question-title, .qtit, .timu-title',
            '.zy_question, .workQuestion',
            'h3, h4', // 有些简单页面用标题
            '[class*="title"]',
            '[class*="content"]',
        ];
        for (const sel of selectors) {
            const found = el.querySelector(sel);
            if (found && found.textContent.trim().length > 5) {
                return cleanText(found.textContent);
            }
        }
        // 直接取 el 的文本（去掉选项部分的文本）
        let text = el.textContent || '';
        // 去掉选项部分
        const optionMatch = text.match(/^([^A-D]*?)[A-D][.、．]/);
        if (optionMatch) text = optionMatch[1];
        return cleanText(text).substring(0, 500);
    }

    function detectQuestionType(el) {
        const html = el.innerHTML || '';
        const text = el.textContent || '';

        if (html.includes('duoxuan') || html.includes('multi') || text.includes('多选题')) return '2';
        if (html.includes('panduan') || html.includes('judge') || text.includes('判断题')) return '3';
        if (html.includes('tiankong') || html.includes('fill') || text.includes('填空题')) return '4';
        if (html.includes('jianda') || html.includes('essay') || text.includes('简答题') || text.includes('论述')) return '5';
        // 默认单选题
        return '1';
    }

    function extractOptions(el, type) {
        if (type === '3') return ['正确', '错误'];  // 判断题固定选项
        if (type === '4' || type === '5') return []; // 填空/简答无选项

        const options = [];
        // 尝试多种选项选择器
        const optSelectors = [
            '.option, .options li, .option-item',
            'ul li:not(.title)',
            '[class*="option"]',
            'label',
            'input[type="radio"] ~ span, input[type="checkbox"] ~ span',
        ];

        for (const sel of optSelectors) {
            const items = el.querySelectorAll(sel);
            if (items.length >= 2 && items.length <= 10) {
                items.forEach(item => {
                    const text = cleanText(item.textContent).replace(/^[A-D][.、．\s]*/, '');
                    if (text && text.length > 0) options.push(text);
                });
                if (options.length >= 2) break;
            }
        }

        // 如果没找到，尝试从 HTML 结构中按字母解析
        if (options.length === 0) {
            const html = el.innerHTML;
            for (let letter of ['A', 'B', 'C', 'D', 'E', 'F']) {
                const re = new RegExp(`${letter}[.、．]\\s*([^<]*)`, 'i');
                const m = html.match(re);
                if (m && m[1].trim()) options.push(m[1].trim());
            }
        }

        return options;
    }

    function extractAnswer(el) {
        // 尝试找到正确答案
        const answerSelectors = [
            '.answer, .rightAnswer, .correctAnswer, .right-answer',
            '[class*="answer"]',
            '[class*="correct"]',
            '.green, .red', // 超星常用绿色/红色标记正确答案
        ];

        for (const sel of answerSelectors) {
            const found = el.querySelector(sel);
            if (found) {
                let text = cleanText(found.textContent);
                // 去掉"正确答案:"等前缀
                text = text.replace(/^(正确答案|答案|正确|解析)[：:]\s*/i, '');
                if (text) return text;
            }
        }

        // 尝试从 input 的 checked/disabled 状态判断
        const checkedInput = el.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked');
        if (checkedInput) {
            const label = checkedInput.closest('label') || checkedInput.parentElement;
            if (label) return cleanText(label.textContent);
        }

        // 尝试从 data 属性
        const dataAnswer = el.getAttribute('data-answer') || el.getAttribute('data-right');
        if (dataAnswer) return dataAnswer;

        return '';
    }

    function extractAnalysis(el) {
        const sel = '[class*="analysis"], [class*="parse"], .jiexi, .analysis-content, .explain';
        const found = el.querySelector(sel);
        if (found) {
            return cleanText(found.textContent).replace(/^(解析|分析|讲解)[：:]\s*/i, '');
        }
        return '';
    }

    function cleanText(text) {
        if (!text) return '';
        return text.replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ').trim();
    }

    // =============================================
    //  翻页 / 导航
    // =============================================

    /** 点击"下一题"按钮 */
    async function clickNextQuestion() {
        const btns = document.querySelectorAll('a, button, span, div');
        let nextBtn = null;
        for (const btn of btns) {
            const text = btn.textContent.trim();
            if (text.includes('下一题') || text.includes('下一') || text.includes('next')) {
                if (btn.offsetParent !== null) { // 可见
                    nextBtn = btn;
                    break;
                }
            }
        }
        if (nextBtn) {
            await simulateMoveTo(nextBtn);
            nextBtn.click();
            log('➡️ 点击「下一题」', 'info');
            return true;
        }
        return false;
    }

    /** 点击"上一题"按钮（用于回到第一题后确保所有题都加载） */
    async function clickPrevQuestion() {
        const all = document.querySelectorAll('a, button, span, div');
        for (const el of all) {
            if (el.textContent.trim().includes('上一题') && el.offsetParent !== null) {
                await simulateMoveTo(el);
                el.click();
                return true;
            }
        }
        return false;
    }

    /** 获取当前已做的题号 */
    function getCurrentQuestionIndex() {
        const all = document.querySelectorAll('a, button, span, div');
        for (const el of all) {
            const t = el.textContent.trim();
            const m = t.match(/(\d+)\s*\/\s*(\d+)/);
            if (m) return { current: parseInt(m[1]), total: parseInt(m[2]) };
        }
        // 检查 li 高亮
        const lis = document.querySelectorAll('li');
        for (let i = 0; i < lis.length; i++) {
            if (lis[i].classList.contains('current') || lis[i].classList.contains('active') || lis[i].classList.contains('on')) {
                return { current: i + 1, total: lis.length };
            }
        }
        return null;
    }

    // =============================================
    //  章节导航
    // =============================================

    /** 找到并点击所有章节测验链接 */
    async function collectChapterQuizLinks() {
        const links = [];
        const all = document.querySelectorAll('a, span, div, li');
        for (const el of all) {
            const text = el.textContent.trim();
            // 匹配"测验"、"章节测验"、"测试"等
            if ((text.includes('测验') || text.includes('测试') || text.includes('考试') || text.includes('作业')) 
                && el.offsetParent !== null) {
                const href = el.href || el.getAttribute('data-href') || el.getAttribute('url') || '';
                if (href || el.onclick || el.tagName === 'A' || el.tagName === 'SPAN' || el.tagName === 'DIV') {
                    // 尝试获取所属章节名
                    let chapterName = '';
                    let parent = el.parentElement;
                    for (let i = 0; i < 5 && parent; i++) {
                        const t = parent.textContent.trim();
                        if (t.includes('章') || t.includes('节') || t.includes('Chapter') || t.includes('专题')) {
                            chapterName = t.substring(0, 50);
                            break;
                        }
                        parent = parent.parentElement;
                    }
                    links.push({ el, text, chapterName, href });
                }
            }
        }
        return links;
    }

    /** 导航到指定章节测验 */
    async function navigateToQuiz(linkObj) {
        try {
            await simulateMoveTo(linkObj.el);
            // 先试试直接点击
            if (linkObj.href && !linkObj.el.onclick) {
                // 用 location 跳转
                window.location.href = linkObj.href;
                // 等待页面加载
                await sleep(3000);
            } else {
                linkObj.el.click();
            }
            await humanDelay('page');
            return true;
        } catch(e) {
            log(`❌ 导航失败: ${e.message}`, 'error');
            return false;
        }
    }

    // =============================================
    //  自动收集流程
    // =============================================

    async function startAutoCollect() {
        if (isRunning) return;

        // 重置状态
        isRunning = true;
        isPaused = false;
        collectedData = [];
        stats = { totalChapters: 0, doneChapters: 0, totalQuestions: 0 };

        startBtn.disabled = true;
        startBtn.textContent = '⏳ 运行中...';
        pauseBtn.style.display = 'block';
        pauseBtn.textContent = '⏸ 暂停';
        statusPanel.style.display = 'block';
        logDiv.innerHTML = '';

        log('🚀 开始自动导出章节测验题目', 'success');
        log(`⏱ 延迟配置: ${CONFIG.delay}~${CONFIG.delay + CONFIG.delayRandom}ms`, 'info');

        try {
            // 第一步：检测当前页面类型，选择策略
            const pageUrl = window.location.href;
            log(`📄 当前页面: ${pageUrl}`, 'info');

            if (pageUrl.includes('studentcourse') || pageUrl.includes('course/study')) {
                // 课程学习页面 — 收集当前页面的题目
                await collectFromCurrentPage();
            } else if (pageUrl.includes('work') || pageUrl.includes('doWork') || pageUrl.includes('takeTest')) {
                // 作业/测验答题页面 — 遍历所有题
                await collectFromExamPage();
            } else {
                // 通用方式：尝试查找并遍历所有测验链接
                log('🔍 尝试自动发现章节测验...', 'info');
                
                // 等待页面加载
                await sleep(2000);

                // 查找所有测验入口
                const quizLinks = await collectChapterQuizLinks();
                
                if (quizLinks.length > 0) {
                    log(`📋 找到 ${quizLinks.length} 个测验入口`, 'success');
                    
                    // 去重
                    const seen = new Set();
                    const uniqueLinks = quizLinks.filter(l => {
                        const key = l.text + l.chapterName;
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });
                    
                    stats.totalChapters = uniqueLinks.length;
                    setProgress(0, stats.totalChapters);

                    for (let i = 0; i < uniqueLinks.length; i++) {
                        if (!isRunning) break;

                        const link = uniqueLinks[i];
                        stats.doneChapters = i;
                        setProgress(i, stats.totalChapters);
                        
                        log(`📌 [${i+1}/${stats.totalChapters}] ${link.text} (${link.chapterName})`, 'info');
                        setTitle(`⏳ 正在导出: ${link.text}`);

                        // 导航到测验
                        const ok = await navigateToQuiz(link);
                        if (ok) {
                            // 等待页面加载
                            await sleep(3000 + Math.random() * 2000);
                            // 收集题目
                            const qs = extractQuestionsFromPage();
                            if (qs.length > 0) {
                                collectedData.push({
                                    chapter: link.chapterName || link.text,
                                    quizName: link.text,
                                    questions: qs,
                                });
                                stats.totalQuestions += qs.length;
                                log(`✅ 收集到 ${qs.length} 题`, 'success');
                            } else {
                                log(`⚠️ 未找到题目（可能页面需要手动加载）`, 'warn');
                            }
                        }

                        // 如果有多页，尝试返回
                        await humanDelay('page');
                        
                        // 尝试返回上一页
                        if (i < uniqueLinks.length - 1) {
                            if (window.history.length > 1) {
                                window.history.back();
                                await sleep(3000 + Math.random() * 2000);
                            }
                        }
                    }
                } else {
                    // 没找到测验链接，尝试从当前页面直接提取
                    log('⚠️ 未找到测验入口，尝试从当前页面提取...', 'warn');
                    await collectFromCurrentPage();
                }
            }

            // 完成
            if (isRunning) {
                await finishExport();
            }

        } catch(e) {
            log(`❌ 运行出错: ${e.message}`, 'error');
            console.error(e);
        } finally {
            isRunning = false;
            startBtn.disabled = false;
            startBtn.textContent = '🚀 开始自动导出';
            pauseBtn.style.display = 'none';
        }
    }

    /** 从当前页面收集题目（含翻页） */
    async function collectFromCurrentPage() {
        log('📖 开始从当前页面提取题目', 'info');

        // 等待页面渲染
        await sleep(2000);

        // 第一次提取
        let questions = extractQuestionsFromPage();
        if (questions.length > 0) {
            log(`📥 首次提取到 ${questions.length} 题`, 'success');
        }

        // 尝试翻页
        let maxPages = 50;
        let page = 1;
        let noDataCount = 0;
        let prevCount = questions.length;

        while (page < maxPages && isRunning) {
            // 检查能否翻下一页
            const hasNext = await clickNextQuestion();
            if (!hasNext) {
                log(`📄 共 ${page} 页，无更多题目`, 'info');
                break;
            }

            await humanDelay('page');
            page++;

            // 提取新题目
            const newQs = extractQuestionsFromPage();
            if (newQs.length > prevCount) {
                // 有新题
                questions = newQs;
                noDataCount = 0;
                log(`📄 第 ${page} 页: 共 ${newQs.length} 题`, 'info');
            } else {
                noDataCount++;
                if (noDataCount >= 3) {
                    log(`⚠️ 连续 ${noDataCount} 页无新题，停止翻页`, 'warn');
                    break;
                }
            }
        }

        // 保存结果
        if (questions.length > 0) {
            // 尝试获取章节名
            let chapterName = '';
            const titleEl = document.querySelector('.chapter-title, .course-title, h1, h2, .title');
            if (titleEl) chapterName = titleEl.textContent.trim().substring(0, 50);

            collectedData.push({
                chapter: chapterName || '当前页面',
                quizName: document.title || '章节测验',
                questions: questions,
            });
            stats.totalQuestions += questions.length;
            stats.totalChapters = 1;
            stats.doneChapters = 1;
            log(`✅ 共收集 ${questions.length} 题`, 'success');
        } else {
            log('⚠️ 当前页面未找到题目数据', 'warn');
            log('💡 提示: 请确保在答题页面运行此脚本', 'warn');
        }
    }

    /** 从测验答题页面遍历所有题目 */
    async function collectFromExamPage() {
        log('📝 检测到测验答题页面', 'info');
        
        // 等待渲染
        await sleep(2000);

        // 尝试获取总题数
        let totalQs = 0;
        const qInfo = getCurrentQuestionIndex();
        if (qInfo) totalQs = qInfo.total;

        // 先回到第一题确保从头开始
        // ...（简化处理）

        // 从当前页开始提取
        await collectFromCurrentPage();
    }

    // =============================================
    //  导出
    // =============================================

    async function finishExport() {
        setTitle('✅ 导出完成！');
        log(`📊 共收集 ${collectedData.length} 个章节`, 'success');
        log(`📊 共 ${stats.totalQuestions} 道题目`, 'success');

        if (stats.totalQuestions === 0) {
            log('⚠️ 没有收集到题目，请检查是否在正确的页面运行', 'warn');
            return;
        }

        // 生成文件名
        const now = new Date();
        const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;

        if (CONFIG.format === 'json') {
            // 导出为 JSON
            const json = JSON.stringify(collectedData, null, 2);
            const blob = new Blob(['\ufeff' + json], { type: 'application/json;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `学习通题目_${ts}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            log(`💾 已下载: 学习通题目_${ts}.json (${(json.length/1024).toFixed(1)} KB)`, 'success');
        } else {
            // 导出为 HTML 练习文件
            const html = generatePracticeHTML(collectedData);
            const blob = new Blob(['\ufeff' + html], { type: 'text/html;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `学习通练习_${ts}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            log(`💾 已下载: 学习通练习_${ts}.html`, 'success');
        }
    }

    /** 生成练习 HTML */
    function generatePracticeHTML(data) {
        const typeMap = { '1': '单选题', '2': '多选题', '3': '判断题', '4': '填空题', '5': '简答题' };
        const typeCls = { '1': 'tag-danxuan', '2': 'tag-duoxuan', '3': 'tag-panduan', '4': 'tag-tiankong', '5': 'tag-jianda' };

        let qIdx = 0;
        let sections = '';

        data.forEach((chapter, ci) => {
            sections += `<h2>📖 ${chapter.chapter || '章节' + (ci+1)} — ${chapter.quizName || ''}</h2>`;
            chapter.questions.forEach(q => {
                qIdx++;
                const t = typeMap[q.type] || '未知';
                const tc = typeCls[q.type] || '';
                const opts = q.options || [];

                let optsHtml = '';
                if (q.type === '3') {
                    optsHtml = `
                        <div class="option" data-idx="${qIdx}" data-opt="A" onclick="selectOption(this)"><strong>A.</strong> 正确</div>
                        <div class="option" data-idx="${qIdx}" data-opt="B" onclick="selectOption(this)"><strong>B.</strong> 错误</div>`;
                } else if (q.type === '4') {
                    optsHtml = `<div style="padding:10px;"><input type="text" class="blank-input" placeholder="填写答案..."></div>`;
                } else if (q.type === '5') {
                    optsHtml = `<div style="padding:10px;"><textarea rows="3" style="width:100%;border:1px solid #ddd;border-radius:6px;padding:8px;" placeholder="输入你的回答..."></textarea></div>`;
                } else {
                    opts.forEach((opt, oi) => {
                        const letter = String.fromCharCode(65 + oi);
                        optsHtml += `<div class="option" data-idx="${qIdx}" data-opt="${letter}" onclick="selectOption(this)"><strong>${letter}.</strong> ${opt}</div>`;
                    });
                }

                sections += `
                <div class="quiz-card">
                    <div class="header">
                        <span class="tag ${tc}">${t}</span>
                        <span style="color:#999;font-size:12px;">#${qIdx}</span>
                    </div>
                    <div class="question">${q.question}</div>
                    <div class="options" data-qidx="${qIdx}">${optsHtml}</div>
                    <div class="answer-section">
                        <button class="show-answer-btn" onclick="toggleAnswer(this)">显示答案</button>
                        <div class="answer-content">
                            <span class="correct-text">✅ 正确答案：</span>${q.answer || '略'}
                            ${q.analysis ? `<br><span style="color:#666;font-size:13px;">📖 解析：${q.analysis}</span>` : ''}
                        </div>
                    </div>
                </div>`;
            });
        });

        // 从 timu/练习模板.html 读取模板框架
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><title>📝 学习通练习 — ${new Date().toLocaleDateString()}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Microsoft YaHei","PingFang SC",sans-serif; max-width: 820px; margin: 0 auto; padding: 20px; background: #f0f2f5; }
h1 { text-align: center; color: #1a73e8; margin: 20px 0 8px; }
h2 { color: #333; margin: 28px 0 12px; padding: 10px 16px; background: #e8f0fe; border-radius: 8px; font-size: 18px; }
.subtitle { text-align: center; color: #888; font-size: 14px; margin-bottom: 24px; }
.controls { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px; }
.controls button { padding: 8px 18px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; background: #e8e8e8; color: #333; transition: all 0.2s; }
.controls button:hover { transform: translateY(-1px); }
.controls .active { background: #1a73e8; color: #fff; }
.quiz-card { background: #fff; border-radius: 12px; padding: 20px 24px; margin: 14px 0; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
.quiz-card.hidden { display: none; }
.header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.tag { display: inline-block; padding: 2px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
.tag-danxuan { background: #e3f2fd; color: #1565c0; }
.tag-duoxuan { background: #fce4ec; color: #c62828; }
.tag-panduan { background: #e8f5e9; color: #2e7d32; }
.tag-tiankong { background: #f3e5f5; color: #6a1b9a; }
.tag-jianda { background: #fff3e0; color: #e65100; }
.question { font-size: 16px; line-height: 1.8; color: #222; margin-bottom: 14px; }
.options { display: flex; flex-direction: column; gap: 6px; }
.option { padding: 10px 14px; border-radius: 8px; border: 2px solid #e0e0e0; cursor: pointer; transition: all 0.2s; font-size: 15px; }
.option:hover { border-color: #90caf9; background: #f5f9ff; }
.option.selected { border-color: #1a73e8; background: #e3f2fd; }
.option.correct { border-color: #4caf50; background: #e8f5e9; }
.option.wrong { border-color: #f44336; background: #ffebee; }
.show-answer-btn { background: #ff9800; color: #fff; border: none; padding: 6px 18px; border-radius: 6px; cursor: pointer; font-size: 13px; margin-top: 10px; }
.show-answer-btn:hover { background: #f57c00; }
.answer-content { margin-top: 8px; padding: 12px 16px; background: #fff8e1; border-radius: 8px; border-left: 4px solid #ff9800; display: none; font-size: 15px; }
.answer-content.show { display: block; }
.correct-text { color: #e65100; font-weight: bold; }
.blank-input { border: none; border-bottom: 2px solid #bbb; width: 240px; padding: 4px 8px; font-size: 15px; }
.blank-input:focus { border-bottom-color: #1a73e8; outline: none; }
.stats { position: sticky; top: 10px; background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); border-radius: 10px; padding: 12px 20px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06); font-size: 14px; z-index: 100; }
.stats span { color: #666; }
.stats strong { color: #1a73e8; }
</style>
</head>
<body>
<h1>📝 章节测验练习</h1>
<p class="subtitle">点击选项作答 · 按 <kbd>A</kbd> 全部显示答案 · 按 <kbd>H</kbd> 全部隐藏</p>
<div class="stats">
    <span>共 <strong id="totalCount">${qIdx}</strong> 题</span>
    <span>已答 <strong id="answeredCount">0</strong> 题</span>
    <span>正确 <strong id="correctCount">0</strong> 题</span>
</div>
<div class="controls">
    <button class="active" onclick="showAllAnswers()" style="background:#ff9800;color:#fff;">全部显示答案</button>
    <button onclick="hideAllAnswers()" style="background:#666;color:#fff;">全部隐藏答案</button>
    <button onclick="resetAll()" style="background:#f44336;color:#fff;">重置作答</button>
</div>
<div id="quizList">${sections}</div>
<script>
function selectOption(el) {
    var qIdx = parseInt(el.getAttribute('data-idx'));
    if (!qIdx) return;
    var opt = el.getAttribute('data-opt');
    var siblings = el.parentElement.querySelectorAll('.option');
    var isMulti = el.parentElement.querySelectorAll('.option').length > 2 && el.closest('.tag-duoxuan');
    if (!isMulti) {
        siblings.forEach(function(s) { s.classList.remove('selected','correct','wrong'); });
    }
    el.classList.toggle('selected');
}

function toggleAnswer(btn) {
    var content = btn.nextElementSibling;
    content.classList.toggle('show');
    btn.textContent = content.classList.contains('show') ? '隐藏答案' : '显示答案';
}

function showAllAnswers() {
    document.querySelectorAll('.answer-content').forEach(function(el) { el.classList.add('show'); });
    document.querySelectorAll('.show-answer-btn').forEach(function(el) { el.textContent = '隐藏答案'; });
}

function hideAllAnswers() {
    document.querySelectorAll('.answer-content').forEach(function(el) { el.classList.remove('show'); });
    document.querySelectorAll('.show-answer-btn').forEach(function(el) { el.textContent = '显示答案'; });
}

function resetAll() {
    document.querySelectorAll('.option').forEach(function(el) { el.classList.remove('selected','correct','wrong'); });
    document.querySelectorAll('.blank-input').forEach(function(el) { el.value = ''; });
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'a' || e.key === 'A') showAllAnswers();
    if (e.key === 'h' || e.key === 'H') hideAllAnswers();
});
</script>
</body>
</html>`;
    }

    // =============================================
    //  事件绑定
    // =============================================

    startBtn.addEventListener('click', startAutoCollect);

    pauseBtn.addEventListener('click', function() {
        isPaused = !isPaused;
        this.textContent = isPaused ? '▶️ 继续' : '⏸ 暂停';
        this.style.background = isPaused ? '#28a745' : '#fd7e14';
        log(isPaused ? '⏸ 已暂停' : '▶️ 继续运行', 'warn');
    });

    // 速度选择
    document.querySelectorAll('.cx-qa-speed label').forEach(label => {
        label.addEventListener('click', function() {
            document.querySelectorAll('.cx-qa-speed label').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            currentSpeed = this.getAttribute('data-speed');
            log(`⚡ 速度设为: ${ {slow:'慢',medium:'中',fast:'快'}[currentSpeed] }`, 'info');
        });
    });

    // 自动检测并提示
    setTimeout(() => {
        log('📥 学习通测验导出器已加载', 'info');
        log(`💡 点击「🚀 开始自动导出」开始收集`, 'info');
    }, 1000);

})();
