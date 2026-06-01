var lang_cpjg = "测评结果";
var lang_ylch = "遗漏词汇";
var lang_zqdfx = "准确度分析";
$(function () {

    $(".recordAudio").on("click", function () {
        var qid = $(this).attr("dataid");
        var editor1 = UE.getEditor("answerUe" + qid);
        editor1.setContent('', false);
        var qid = $(this).attr("dataid");
        $("#question" + qid + " .edui-for-recording .edui-icon").click();
        var isNewCeyan = $("#isNewCeyan").val();
        if (isNewCeyan == "1") {
            var offsetTop = $('#question' + qid).offset().top;
            if (offsetTop > 0) {
                $('.edui-dialog.edui-for-recording').css("top", offsetTop + "px");
            }
        }
    });


    $(".matchAudio").click(function () {
        var qid = $(this).attr("dataid");
        $(".haveAudio"+qid+".matchAudio").hide();
        $(".matching"+qid).show();

        var eleRevert = function (){
            $(".matching"+qid).hide();
            $(".haveAudio"+qid+".matchAudio").show();
        }
        oralEvalMatch(qid,eleRevert);
    });
    if(typeof I18N_WORK != 'undefined'){
        lang_cpjg = I18N_WORK.cpResult;
        lang_ylch = I18N_WORK.ylch;
        lang_zqdfx = I18N_WORK.zqdfx;
    }
})

function oralEvalMatch(qid, callback) {
    var oralEvalSync = $("#oralEvalSync").val() || "";
    if (oralEvalSync == "2") {
        oralevalAction(qid, callback);
    } else {
        matchAudio(qid, callback);
    }
}

function matchAudio(qid,callback) {
    var matchEnc = $("#matchEnc").val();
    var answerid = $("#answerId").val();
    var objectid = $("#answer" + qid).attr("objectid");
    var audioName = $("#answer" + qid).attr("audioname");
    var readText = $("#readText" + qid).text();
    var lang = $("#answer" + qid).attr("lang");
    var slack = $("#answer" + qid).attr("slack");
    var courseId = $("#courseId").val() || "";
    var classId = $("#classId").val() || "";
    var cpi = $("#cpi").val() || "";
    var userId = $("#userId").val() || "";
    var fid = $("#cfid").val() || "";
    $.ajax({
        type: "post",
        url: "/ans-ext-proxy/oral-test/match",
        data: {
            courseid: courseId,
            clazzid: classId,
            cpi: cpi,
            userid: userId,
            fid: fid,
            diff: 1,
            expected: readText,
            objectid: objectid,
            enc: matchEnc,
            answerid: answerid,
            qid: qid,
            slack: slack,
            lang: lang
        },
        dataType: "json",
        success: function (data) {
            if (data.status) {

                if (typeof data.result != "undefined") {
                    var answer = [];
                    var item = {};
                    item.matchResult = data.result;
                    item.matchResultEnc = data.matchResultEnc;
                    item.objectId = objectid;
                    item.audioName = audioName;
                    answer[0] = item;
                    var answerStr = JSON.stringify(answer);
                    $("#answer" + qid).val(answerStr);

                    if (typeof data.result != "undefined") {
                        var result = fixMatchdata(data.result);
                    }
                    if (submitLock == 0) {
                        $("#matchResult" + qid).empty()
                        $("#matchResult" + qid).append('<div  class="mark_answer fs14" >' +
                            '<div class="mark_key clearfix">' +
                            '<dl class="mark_fill colorDeep">' +
                            '<dt><i class="fontWeight">' + lang_cpjg + '：</i></dt>' +
                            '<dd class="lostword">' + lang_ylch + '：' + result.missedStr + '</dd>' +
                            // '<dd>复读词汇：' + result.repeatedStr + '</dd>' +
                            '</dl>' +
                            // '<dl class="mark_fill">' +
                            // '<dd>句子语调：<!--<span class="colorGreen">-->' + result.intonationStr + '<!--</span>--></dd>' +
                            // '</dl>' +
                            // '<dl class="mark_fill">' +
                            // '<dd>平均语速：<!--<span class="colorRed">-->' + result.articulationRateStr + '<!--</span>--></dd>' +
                            // '<dd>停顿过长：<span>' + result.long_pause_count + ' 次</span></dd>' +
                            // '</dl>' +
                            '<dl class="mark_fill"><dd>' + lang_zqdfx + '：'+result.diffs+'</dd></dl>' +
                            '</div>' +
                            '</div>');
                    }
                } else {
                    oralTestError(qid, objectid, audioName);
                }
            } else {
                $.toast({type: 'notice', content: '口语题测评失败'});
            }
        }, complete: function () {
            callback && callback();
        }, error: function () {
            oralTestError(qid, objectid, audioName);
        }
    });
}

function oralTestError(qid,objectid,audioName){
    var answer = [];
    var item = {};
    item.objectId = objectid;
    item.audioName = audioName;
    answer[0] = item;
    var answerStr = JSON.stringify(answer);
    $("#answer" + qid).val(answerStr);
}
function fixMatchdata(data){

    var result = {}
    var missed = data.missed;
    var repeated = data.repeated;
    if (typeof missed != "undefined" && missed.length >0) {
        result.missedStr = missed.join(",");
    }else {
        result.missedStr = "无";
    }
    if (typeof repeated != "undefined" && repeated.length > 0) {
        result.repeatedStr = repeated.join(",");
    } else {
        result.repeatedStr = "无";
    }
    var intonation = data.intonation;
    if (typeof intonation != "undefined") {
        if (intonation == "FALL") {
            result.intonationStr = "降";
        }else if (intonation == "RISE") {
            result.intonationStr = "升";
        }else if (intonation == "LEVEL") {
            result.intonationStr = "平";
        }
    }
    var articulationRate = data.articulation_rate;
    if (typeof articulationRate != "undefined") {
        if (articulationRate == "slow") {
            result.articulationRateStr = "较慢";
        }else if (articulationRate == "normal") {
            result.articulationRateStr = "适中";
        }else if (articulationRate == "quick") {
            result.articulationRateStr = "较慢";
        }
    }
    result.long_pause_count = data.long_pause_count;;
    result.diffs = data.diffs;;
    return result;
}

function oralTestAddAudio(qid){
    var editor1 = UE.getEditor("answerUe"+qid);

    $("#recordVideoDiv"+qid).hide();
    var videohtml = editor1.getContent();
    $("#videoDiv"+qid).html(videohtml);
    $(".haveAudio"+qid).show()

    var objectid = $("#videoDiv"+qid+" iframe").attr("data");
    var audioname = $("#videoDiv"+qid+" iframe").attr("name");
    $("#answer"+qid).attr("objectid",objectid);
    $("#answer"+qid).attr("audioname",audioname);
    $("#answer"+qid).val("");

    var answerArray = [];
    var obj = {};
    obj.objectId = objectid;
    obj.audioName = audioname;
    answerArray.push(obj)
    var answer = JSON.stringify(answerArray);
    $("#answer" + qid).val(answer);

    $("#matchResult"+qid).empty();
}

var pollingStates = new Map();
var activePollingId = null;

function oralevalAction(questionId, callback) {
    if (activePollingId && activePollingId != questionId) {
        stopPolling(activePollingId);
    }
    activePollingId = questionId;

    var courseId = $("#courseId").val();
    var classId = $("#classId").val();
    var cpi = $("#cpi").val();
    var workId = $("#workId").val();
    var answerId = $("#answerId").val();
    var objectId = $("#answer" + questionId).attr("objectid");
    var audioName = $("#answer" + questionId).attr("audioname");

    var state = pollingStates.get(questionId) || {
        retryTimes: 0,
        maxTimes: 10,
        timeoutId: null,
        interval: 5000,
        isPolling: false
    };
    pollingStates.set(questionId, state);

    if (state.isPolling) {
        return;
    }
    state.isPolling = true;

    state.retryTimes = 1;

    $.ajax({
        type: "post",
        url: _HOST_CP2_ + "/oraleval/task",
        data: {
            courseId: courseId,
            classId: classId,
            cpi: cpi,
            workId: workId,
            answerId: answerId,
            questionId: questionId,
            objectId: objectId
        },
        dataType: "json",
        success: function (data) {
            if (!data.status) {
                $.toast({type: 'notice', content: '口语题测评失败'});
                clearPollingState(questionId);
                callback && callback();
                return;
            }

            var progress = data.progress;
            if (progress == 1) {
                processEvalResult(questionId, data, objectId, audioName);
                clearPollingState(questionId);
                callback && callback();
            } else if (progress === 0) {
                // 评测进行中，继续轮询
                if (state.retryTimes >= state.maxTimes) {
                    clearPollingState(questionId);
                    callback && callback();
                    return;
                }
                state.isPolling = false;
                state.timeoutId = setTimeout(() => {
                    oralevalAction(questionId, callback);
                }, state.interval);
                state.retryTimes++;
            } else {
                oralTestError(questionId, objectId, audioName);
                clearPollingState(questionId);
                callback && callback();
            }
        },
        error: function () {
            oralTestError(questionId, objectId, audioName);
            clearPollingState(questionId);
            callback && callback();
        }
    });
}

function processEvalResult(questionId, data, objectId, audioName) {
    if (!data.result) {
        return;
    }

    var jsonObject = JSON.parse(data.result);

    var answer = [{
        matchResult: jsonObject,
        matchResultEnc: data.matchResultEnc,
        objectId,
        audioName
    }];

    var answerStr = JSON.stringify(answer);
    $("#answer" + questionId).val(answerStr);

    var result = fixMatchdata(jsonObject);

    $("#matchResult" + questionId).empty()
    $("#matchResult" + questionId).append('<div  class="mark_answer fs14" >' +
        '<div class="mark_key clearfix">' +
        '<dl class="mark_fill colorDeep">' +
        '<dt><i class="fontWeight">' + lang_cpjg + '：</i></dt>' +
        '<dd class="lostword">' + lang_ylch + '：' + result.missedStr + '</dd>' +
        '</dl>' +
        '<dl class="mark_fill"><dd>' + lang_zqdfx + '：' + result.diffs + '</dd></dl>' +
        '</div>' +
        '</div>');
}

function stopPolling(questionId) {
    var state = pollingStates.get(questionId);
    if (state) {
        state.isPolling = false;
        clearPollingState(questionId);
    }
}

function clearPollingState(questionId) {
    var state = pollingStates.get(questionId);
    if (state) {
        state.isPolling = false;
        if (state.timeoutId) {
            clearTimeout(state.timeoutId);
            state.timeoutId = null;
        }
    }
    pollingStates.delete(questionId);

    if (activePollingId == questionId) {
        activePollingId = null;
    }
}