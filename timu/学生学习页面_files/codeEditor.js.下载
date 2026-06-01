var codeEditors = {};

function createCodeEditor(businessId, options) {
    var langList = {};

    if (options && options.languages) {
        var languages = options.languages;
        if ($.isArray(languages) && languages.length > 0) {
            $.each(langList, function(key) {
                delete langList[key];
            });
            $(languages).each(function(index, pair) {
                if (pair.codeName) {
                    var key = pair.codeName;
                    var value = pair.code;
                    langList[key] = value;
                }
            });
        }
    }

    var codeEditor = CodeMirror.fromTextArea($(`.code-editor[data-business-id="${businessId}"]`)[0],{
        value: "function myScript(){return 100;}\n",
        mode: "javascript",
        lineNumbers: true,
        theme: "default",
        hintOptions: {
            completeSingle: false
        },
        autoCloseBrackets: true,
        matchBrackets: true,
        autoCloseTags: true,
        gutters: [
            "CodeMirror-linenumbers",
            "CodeMirror-lint-markers",
            "CodeMirror-linenumbers",
            "CodeMirror-foldgutter"
        ],
        foldGutter: true,
        extraKeys: {
            "Ctrl-Space": "autocomplete",
            "Ctrl-Q": function (cm) {
                cm.foldCode(cm.getCursor());
            }
        },
        foldOptions: {
            rangeFinder: CodeMirror.fold.brace
        }
    });

    // 代码自动补全
    var notShowArr = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$';
    codeEditor.on("inputRead", function onChange(editor, change) {
        if (notShowArr.indexOf(change.text) !== -1) {
            codeEditor.showHint({completeSingle: false});
        }
    });

    // 展开程序语言选择列表
    $(document).on("click", `.langList[data-business-id="${businessId}"]`, function () {
        var ul = $(this).find("ul");
        var display = ul.css("display");
        var isShow = display !== "block";

        $(`.langList[data-business-id="${businessId}"] ul`).hide();

        if (isShow) {
            $(this).addClass("blue-border");
            var totalHeight = 0;
            ul.find("li").each(function() {
                totalHeight += $(this).height();
            });
            ul.slideDown(100);
        } else {
            $(this).removeClass("blue-border");
            ul.slideUp(100);
        }
        return false;
    });

    // 代码格式化
    $(document).on("click", `.mrconTop .format[data-business-id="${businessId}"]`, function() {
        var code = codeEditor.getValue();
        var formattedCode = js_beautify(code);
        codeEditor.setValue(formattedCode);
    });

    // 代码重置
    $(`.mrconTop .refresh[data-business-id="${businessId}"]`).click(function () {
        $(`.reset-mask[data-business-id="${businessId}"]`).show();
    });

    // 代码重置
    $(`.btnReset[data-business-id="${businessId}"]`).click(function (event) {
        event.preventDefault();
        codeEditor.setValue('');
        codeEditor.getWrapperElement().style.fontSize = 14 + 'px';
        var lang = $(`.langList[data-business-id="${businessId}"] > p > span`).text();
        codeEditor.setOption("mode", langList[lang]);
        codeEditor.refresh();
        $(`.reset-mask[data-business-id="${businessId}"]`).hide();
    });

    // 代码复制
    $(document).on("click", `.mrconTop .copy[data-business-id="${businessId}"]`, function () {
        var currentText = codeEditor.getValue();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(currentText)
                .then(function() {
                    toast('代码已复制');
                })
                .catch(function(err) {
                    console.error('复制失败', err);
                });
        } else {
            var textarea = $("<textarea>");
            textarea.val(currentText);
            $("body").append(textarea);
            textarea.prop("selectionStart", 0);
            textarea.prop("selectionEnd", 99999);
            try {
                document.execCommand("copy");
                toast('代码已复制');
            } catch (err) {
                console.error('复制失败', err);
            }
            textarea.remove();
        }
    });

    // 编辑器设置
    $(document).on("click", `.mrconTop .setting[data-business-id="${businessId}"]`, function () {
        $(`.setting-mask[data-business-id="${businessId}"]`).show();
    });

    // 字体切换
    $(document).on("click", `.fontList[data-business-id="${businessId}"] ul li`, function () {
        var p = $(this).find("a").text();
        codeEditor.setOption("mode", langList[p]);
    });

    // 取消
    $(`.btnCancle[data-business-id="${businessId}"], .popClose[data-business-id="${businessId}"]`).click(function () {
        $(`.reset-mask[data-business-id="${businessId}"]`).hide();
        $(`.setting-mask[data-business-id="${businessId}"]`).hide();
    });

    // 编辑器确认
    $(`.btnSetting[data-business-id="${businessId}"]`).click(function (event) {
        event.preventDefault();
        var fontSize = $(`.fontList[data-business-id="${businessId}"] > p > span`).text();
        codeEditor.getWrapperElement().style.fontSize = fontSize;
        var lang = $(`.langList[data-business-id="${businessId}"] > p > span`).text();
        codeEditor.setOption("mode", langList[lang]);
        codeEditor.refresh();
        $(`.setting-mask[data-business-id="${businessId}"]`).hide();
    });

    // 选择程序语言
    $(document).on("click", `.langList[data-business-id="${businessId}"] ul li`, function () {
        var p = $(this).closest('.langList').find("p span");
        p.text($(this).find("a").text());
        p.attr("value", $(this).attr("value"));
        p.css("color", "#444");
        $(`.langList[data-business-id="${businessId}"] ul li`).removeClass("boxli_cur");
        $(this).addClass("boxli_cur");

        var aEle = $(this).find("a");
        var codename = aEle.attr("codename");
        var codenum = aEle.attr("codenum");
        $(`.langList[data-business-id="${businessId}"]`).attr("codenum", codenum);
        $(`.langList[data-business-id="${businessId}"]`).attr("codename", codename);

        var languageSelectId = `languageSelect${businessId}`;
        var languageSelect = $(`#${languageSelectId}`);
        if (languageSelect.length > 0) {
            languageSelect.val(codenum);
        }

        changeMode(codename, businessId);
        preparedEditorChangeLanguage(businessId);
    });

    function changeMode(mode, businessId) {
        var editor = codeEditors[businessId];
        if (editor) {
            editor.setOption("mode", getMimeType(mode));
        }
    }

    function getMimeType(language) {
        return langList[language] || 'text/plain';
    }

    codeEditors[businessId] = codeEditor;
}

function initCodeMirror(businessId, options) {
    createCodeEditor(businessId, options);
}

function getCodeEditorByBusinessId(businessId) {
    return codeEditors[businessId];
}

function getCodeContentByBusinessId(businessId) {
    var editor = getCodeEditorByBusinessId(businessId);
    if (editor) {
        return editor.getValue();
    }
    return "";
}


var toastTimer = null;
function toast(str, time) {
    time = time || 1000;
    var toast = $('#toast');
    if (toast.length) {
        toast.remove();
        clearTimeout(toastTimer);
        toastTimer = null;
    }

    var toastDiv = $("<div>");
    toastDiv.attr("id", "toast");
    toastDiv.html(str);
    $("body").append(toastDiv);

    toastTimer = setTimeout(function() {
        $('#toast').remove();
        toastTimer = null;
    }, time);
}

function setCodeContentByBusinessId(businessId, data) {
    var editor = getCodeEditorByBusinessId(businessId);
    if (editor) {
        editor.setValue(data);
    }
}

// 程序题作答模板切换语言
function preparedEditorChangeLanguage(businessId) {
    var codeNum = $('.langList[data-business-id="'+businessId+'"]').attr("codenum");
    var preparedCodeStr = $('.codeEditorBoxDiv[data-business-id="'+businessId+'"]').attr("prepared-code");
    // 如果是做大模板编辑器则需要记录当前语言的代码，切换语言后回显之前设置的代码
    if (typeof preparedCodeStr != "undefined" && preparedCodeStr != "") {
        try{
            var preparedCode = JSON.parse(preparedCodeStr);
            var codeData = preparedCode.find(item => item.codeNum === codeNum);
            var oriCode = getCodeContentByBusinessId(businessId);

            if(typeof codeData != "undefined"&& codeData != ""){
                if(typeof oriCode != "undefined" && oriCode != ""){
                    var tips = "教师已设置作答模板，是否确认替换当前代码？";
                    if(typeof workPop == "function"){
                        workPop(tips, "确认", "取消", function () {
                            setCodeContentByBusinessId(businessId, codeData.code);
                        });
                    }else {
                        $("#submitConfirmPop .popWord").html(tips);
                        $("#submitConfirmPop .confirm").attr('onclick','setCodeContentByBusinessId('+businessId+', '+JSON.stringify(codeData.code)+');$("#submitConfirmPop").fullFadeOut();');
                        $("#submitConfirmPop").fullFadeIn();
                    }
                }else {
                    setCodeContentByBusinessId(businessId, codeData.code);
                }
            }
        }catch(e){}
    }
}