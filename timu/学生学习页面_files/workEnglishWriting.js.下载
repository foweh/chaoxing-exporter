function initMaxWordQuestionType26(questionContent, id, minNum, maxNum) {
    var count = UE.Editor.prototype.pureWordCount(questionContent);
    if (Number(minNum) > 0 && count < minNum) {
        $("#tips" + id).hide();
        $("#errorTips" + id).show();
        $("#errorfontnum" + id).html(minNum - count);
    } else {
        $("#tips" + id).show();
        $("#errorTips" + id).hide();
    }

    if (Number(maxNum) > 0 && count > maxNum) {
        count = maxNum;
    }

    $("#fontnum" + id).html(count)
}

function controlWordMaxTextArea(richContent, wordMaxNum) {
    if (!richContent || !wordMaxNum || wordMaxNum <= 0) {
        return "";
    }
    var words = UE.Editor.prototype.pureWord(richContent);
    var wordsCount = words.length;
    if (wordsCount > wordMaxNum) {
        var keyWord = words[wordMaxNum - 1];
        var match = [];
        var index = richContent.indexOf(keyWord);
        var cycleSafeLimit = 6000;
        while (index !== -1 && match.length <= cycleSafeLimit) {
            match.push(index + keyWord.length);
            index = richContent.indexOf(keyWord, index + keyWord.length);
        }
        if (match.length > 0) {
            for (var i = match.length - 1; i >= 0; i--) {
                var subRichContent = richContent.substring(0, match[i]);
                var middleContainer = UE.getEditor('wordMaxMiddleContainer');
                middleContainer.setContent(subRichContent);
                if (middleContainer.pureWordCount() <= wordMaxNum) {
                    break;
                }
            }
        } else {
            var plainTxt = richContent;
            if (plainTxt) {
                plainTxt = plainTxt.replace(/<[^>]+>/g, '');
            }
            var plainTxtWords = plainTxt.split(' ');
            var subRichContent = plainTxtWords.slice(0, wordMaxNum).join(' ');
            var middleContainer = UE.getEditor('wordMaxMiddleContainer');
            middleContainer.setContent(subRichContent);
        }
        if (middleContainer.getPlainTxt() != richContent) {
            return middleContainer.getPlainTxt();
        } else {
            return "";
        }
    }
    return "";
}

function initWordMaxMiddleContainer() {
    if ($('#wordMaxMiddleContainer').length == 1) {
        return;
    }
    var ele = '<div style="display:none;"><textarea  id="wordMaxMiddleContainer"></textarea></div>';
    $('body').append(ele);
    UE.getEditor('wordMaxMiddleContainer', {'pasteplain': true});
}