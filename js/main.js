// 初始化时钟选择器，页面加载完成后为所有 .clockpicker 元素启用时钟选择插件
$(document).ready(function() {
      $('.clockpicker').clockpicker();
});

// 主逻辑入口，页面加载完成后执行
$(document).ready(function() {
  // 控制番茄钟流程是否进行的标志，true表示正在计时，false表示暂停
  var processFlag = false;

  // 番茄钟统计信息对象
  // counts：已完成的番茄钟数量
  // short：已完成的短休息次数
  // long：已完成的长休息次数
  var numberInfoObj = {
    counts: 0,
    short: 0,
    long: 0
  }
  // 统计各阶段累计用时（单位：秒）
  var timeInfoObj = {
    worktime: 0,
    shorttime: 0,
    longtime: 0
  }

  // 定时器变量，用于控制工作、短休息、长休息的倒计时
  var workTimeInterval, shortTimeInterval, longTimeInterval;

  // 当前设置的番茄钟数量、工作时长、短休息时长、长休息时长（单位：秒）
  var tomatoCountState, workTimeState, shortTimeState, longTimeState;

  // 缓存常用的jQuery对象
  var $tomatoCount = $('#tomato-number'); // 番茄钟数量显示
  var $workTime = $('#work-period'); // 工作时长显示
  var $shortTime = $('#short-rest'); // 短休息时长显示
  var $longTime = $('#long-rest'); // 长休息时长显示

  var $eyeCare = $('#eyecare'); // 眼保健时长显示
  var $tomatoState = $('#tomato-state'); // 番茄钟状态显示

  // 用于存储设置到本地
  var tomatoStorage = {

  }

  // 从chrome本地储存读取所有设置，初始化页面和变量
  chrome.storage.local.get(null, function(result){
    if(!$.isEmptyObject(result)) {
      // 已有本地存储，读取设置并赋值到各变量和界面
      console.log('有storage');
      console.log(result);
      tomatoCountState = result.tomato_number;
      workTimeState = result.work_time*60;
      shortTimeState = result.short_rest*60;
      longTimeState = result.long_rest*60;
      audioArray = result.audioArr;
      audioSwitchArray = result.isAudioItems;
      drinkCheckArray = result.drinklist;
      showCountdown(workTimeState);
      audioResetView();
      audioResetButton();
      drinkResetView();
      $tomatoCount.val(tomatoCountState);
      $workTime.val(workTimeState/60);
      $shortTime.val(shortTimeState/60);
      $longTime.val(longTimeState/60);

      eyeTimeState = result.eye_care * 60;
      $eyeCare.val(result.eye_care);
    } else {
      // 没有本地存储，初始化默认设置并保存
      console.log('初始设置');
      tomatoCountState = $tomatoCount.val();
      workTimeState = $workTime.val()*60;
      shortTimeState = $shortTime.val()*60;
      longTimeState = $longTime.val()*60;
      eyeTimeState = $eyeCare.val()*60;
      audioSwitchArray = [true, true, true, true, true];
      audioArray = [7,3,11,0,2];
      getDrinkList();
      tomatoStorage = {
        tomato_number : tomatoCountState,
        work_time : workTimeState/60,
        short_rest : shortTimeState/60,
        long_rest : longTimeState/60,
        isAudioItems : [true, true, true, true, true],
        audioArr : audioArray,
        eye_care : eyeTimeState/60,
        drinklist : drinkCheckArray
      }

      chrome.storage.local.set( tomatoStorage, function(){
        console.log('storage complited')
      });

    }
  });

  // 监听chrome.storage的变化，便于调试和同步设置
  chrome.storage.onChanged.addListener(function(changes, namespace) {
         for (key in changes) {
           var storageChange = changes[key];
           console.log('Storage key "%s" in namespace "%s" changed. ' +
                       'Old value was "%s", new value is "%s".',
                       key,
                       namespace,
                       storageChange.oldValue,
                       storageChange.newValue);
         }
  });

  // 顶部导航栏切换页面显示
  var $navSeleting = $('header nav ul li'); // 使用 JQuery 选择器，获取到导航栏的所有 li 元素
  var $section = $('main > div');
  // 绑定点击事件，切换页面显示
  $navSeleting.bind("click", function(event){
    $(this).siblings('li').find('a').removeClass('nav-selected');
    $(this).find('a').addClass('nav-selected');
    $section.hide(); // 隐藏所有页面
    $section.eq( $(this).index() ).show(); // 显示当前点击对应的页面
  });

  // 配置页内导航切换，与上一块同理
  var $configSeleting = $('#configure nav ul li');
  var $configSection = $('#configure > div');
  $configSeleting.bind("click", function(event){
    $(this).siblings('li').find('a').removeClass('config-selected');
    $(this).find('a').addClass('config-selected');
    $configSection.hide();
    $configSection.eq( $(this).index() ).show();
  });

// 以下为统计信息相关变量和函数
var $messageFinished = $('#message-finished');
var $messageNember = $('#message-number');
var $thTomato = $('#th-tomato');
var $thShort = $('#th-short');
var $thLong = $('#th-long');
var $tdWorktime = $('#td-worktime');
var $tdShorttime = $('#td-shorttime');
var $tdLongtime = $('#td-longtime');
var $totalTime = $('#total-time');

// 显示统计信息到页面
function showMessage(){
  $messageFinished.html((numberInfoObj.counts/tomatoCountState).toFixed(2));
  $messageNember.html(tomatoCountState);
  $thTomato.html(numberInfoObj.counts);
  $thShort.html(numberInfoObj.short);
  $thLong.html(numberInfoObj.long);

  // 时间转换辅助函数，将秒数转为小时（res = 0）和分钟（res = 1）
  var transfer = function(time, res){
    var hour, minute;
    time = time / 60;
    hour = parseInt(time / 60);
    minute = Math.ceil(time % 60);
    if(res === 0){
      return hour;
    } else if (res === 1) {
      return minute;
    }
  }
  // 更新页面显示的工作时间、短休息时间、长休息时间和总时间
  var total = timeInfoObj.worktime+timeInfoObj.shorttime+timeInfoObj.longtime;
  $tdWorktime.html(transfer(timeInfoObj.worktime, 0)+'<span class="td-color">小时</span>'+transfer(timeInfoObj.worktime, 1)+'<span class="td-color">分钟</span>');
  $tdShorttime.html(transfer(timeInfoObj.shorttime, 0)+'<span class="td-color">小时</span>'+transfer(timeInfoObj.shorttime, 1)+'<span class="td-color">分钟</span>');
  $tdLongtime.html(transfer(timeInfoObj.longtime, 0)+'<span class="td-color">小时</span>'+transfer(timeInfoObj.longtime, 1)+'<span class="td-color">分钟</span>');
  $totalTime.html(transfer(total, 0) + '<span class="td-color">小时</span>' +transfer(total, 1) + '<span class="td-color">分钟</span>');
}
/*---------------*/

var messageInterval;
// 开始/停止按钮逻辑
$('#start-button').bind("click", function(){
  if(processFlag == true) {
    // 停止计时
    processFlag = false;
    $(this).removeClass('convert-button a').find('a').text('开始');
  } else {
    // 开始计时
    processFlag = true;
    $(this).addClass('convert-button a').find('a').text('停止');
  }
  if(processFlag) {
    // 启动主流程，统计信息定时刷新
    process();
    messageInterval = setInterval(function(){
      showMessage();
    }, 60000);
  } else {
    // 停止所有计时器，重置部分状态
    numberInfoObj.counts = 0;
    if(workTimeInterval)  clearInterval(workTimeInterval);
    if(shortTimeInterval)  clearInterval(shortTimeInterval);
    if(longTimeInterval)  clearInterval(longTimeInterval);
    clearInterval(messageInterval);
    $('#countdown').css('color', 'black');
    showCountdown(workTimeState);
    $tomatoState.html("无番茄");
  }
});

// 时钟设置变更保存，监听输入框变化并保存到chrome.storage
$('#clock-config input').change( function(){
  var tomatoCountValue = parseInt( $('#tomato-number').val());
  var longBreakTimeValue = parseInt( $('#long-rest').val());
  var shortBreakTimeValue = parseInt( $('#short-rest').val());
  var workTimeValue = parseInt( $('#work-period').val());

  var saveObj = {
    tomato_number : tomatoCountValue,
    work_time : workTimeValue,
    short_rest : shortBreakTimeValue,
    long_rest : longBreakTimeValue
  };
  chrome.storage.local.set(saveObj, function(){
    chrome.storage.local.get(saveObj, function(result){
      tomatoCountState = result.tomato_number;
      workTimeState = result.work_time * 60;
      shortTimeState = result.short_rest * 60;
      longTimeState = result.long_rest * 60;
      console.log('时钟设置已储存');
      showCountdown(workTimeState);

    });
  });

});

// 音频提醒相关设置
var $selectList = $('.notify-select');
var audioArray = new Array();
// 初始化音频选择数组
$selectList.each(function(index, el) {
  audioArray[index] = $(this).val();
});

// 音频选择变更事件
$('.notif-item select').change(function(event) {
  $selectList.each(function(index, el) {
    audioArray[index] = $(this).val();
    console.log('元素' + audioArray[index]);
  });

  var audio = {
    audioArr : audioArray
  };
  chrome.storage.local.set( audio, function(){
    chrome.storage.local.get( audio, function(result) {
      audioArray = result.audioArr;

      for(var i = 0; i < audioArray.length; i++) {
        console.log(audioArray[i] + ' :数字对应html里audio的声音');

      }
    });
    console.log('提醒声音已储存');
  });
  console.log('select改变了');

});

// 音频选择和默认选择相关
var $notifyAudioReset = $('.notif-item');
var audioResetStateArray = [7,3,11,0,2]; // 各个提醒音频的对应下标默认值
// 重置音频选择下拉框的选中项
function audioResetView(){
  $notifyAudioReset.find("select[name='work'] option").eq(audioArray[0]).prop('selected', true);
  $notifyAudioReset.find("select[name='shortrest'] option").eq(audioArray[1]).prop('selected', true);
  $notifyAudioReset.find("select[name='longrest'] option").eq(audioArray[2]).prop('selected', true);
  $notifyAudioReset.find("select[name='eyecare'] option").eq(audioArray[3]).prop('selected', true);
  $notifyAudioReset.find("select[name='drink'] option").eq(audioArray[4]).prop('selected', true);
}

// 音频重置按钮，恢复默认提醒音频
$('#reset1').bind("click", function(){
  $notifyAudioReset.find("select[name='work']").find("option[value='7']").prop('selected', true);
  $notifyAudioReset.find("select[name='shortrest']").find("option[value='3']").prop('selected', true);
  $notifyAudioReset.find("select[name='longrest']").find("option[value='11']").prop('selected', true);
  $notifyAudioReset.find("select[name='eyecare']").find("option[value='0']").prop('selected', true);
  $notifyAudioReset.find("select[name='drink']").find("option[value='2']").prop('selected', true);
  var audio = {
    audioArr : audioResetStateArray
  };
  chrome.storage.local.set( audio, function(){
    chrome.storage.local.get( audio, function(result) {
      audioArray = result.audioArr;
    });
  });
});

// 音频开关相关
var $audioSwitch = $('.audio-switch');

// 根据audioSwitchArray重置音频开关按钮状态
function audioResetButton(){
  $audioSwitch.each(function(index, el){
    if(audioSwitchArray[index]){
      $(this).prop("checked", true);
    } else{
      $(this).prop("checked", false);
    }
  });
}
// 音频开关点击事件，将状态保存到 chrome 本地
$audioSwitch.bind("click", function(){
  $audioSwitch.each(function(index, el) {
    if( $(this).is(":checked")){
      audioSwitchArray[index] = true;
    } else {
      audioSwitchArray[index] = false;
    }
    console.log(audioSwitchArray[index]+'....'+index);
  });
  var isAudioStorage = {
    isAudioItems: audioSwitchArray
  }
  chrome.storage.local.set( isAudioStorage, function(){
    chrome.storage.local.get( isAudioStorage, function(result) {
      audioSwitchArray = result.isAudioItems;
    });
  });

});

// 眼保健相关
var eyeSwitchState = false;
var $eyeSwitch = $('#eye-button');
// 眼保健开关点击事件
$eyeSwitch.bind("click", function(){
  if($(this).is(':checked')) {
    eyeSwitchState = true;
  } else {
    eyeSwitchState = false;
  }
  if(eyeSwitchState) {
    eyecareProcess();
  } else {
    clearInterval(eyeTimeInterval);
  }
});

var eyeTimeInterval;
// 眼保健倒计时时长（秒）
var eyeTimeState = parseInt( $eyeCare.val()) * 60;

// 眼保健时间设置变更事件
$eyeCare.change(function(event) {

  var eyeStorage = $eyeCare.val();
  chrome.storage.local.set( {'eye_care' : eyeStorage}, function(){

  });
  eyeTimeState = parseInt(eyeStorage) * 60;
});

// 喝水提醒相关
var drinkSwitch = $('#drink-button');
var drinkSwitchState = false;
// 喝水提醒开关点击事件
drinkSwitch.bind("click", function(){
  if($(this).is(':checked')) {
    console.log('喝水选中的');
    drinkSwitchState = true;
  } else {
    drinkSwitchState = false;
  }
  if(drinkSwitchState) {
    drinkProcess();
  } else {
    clearInterval(drinkTimeInterval);
  }
});

// 喝水时间设置相关
var $drinkInputList = $('.form-control');
var drinkInput = $('.clockpicker input');
var drinkCheckArray = new Array(); // 喝水时间列表，格式为"0830"（08:30）

// 喝水提醒视图重置，刷新输入框显示
function drinkResetView(){
  var arr = new Array();
  var st, end;
  console.log(drinkCheckArray)
  for( v in drinkCheckArray){
    if (drinkCheckArray.hasOwnProperty(v)) {
      // 将喝水时间"0830"格式化为"08:30"的形式，存入数组
      st = drinkCheckArray[v].substring(0, 2);
      end = drinkCheckArray[v].substring(2, 4);
      arr[v] = st + ':' + end;
    }
  }
  $drinkInputList.each(function(index, el){
    $(this).val(arr[index]);
  });

}

// 获取喝水时间列表，将输入框内容转为数组（如"08:30"转为"0830", 即为上面转换的逆变换
function getDrinkList(){
  var arr = new Array();
  $drinkInputList.each(function(index, el) {
    arr[index] = $(this).val();
  });

  var st, end;
  for (var v in arr) {
    if (arr.hasOwnProperty(v)) {
      st = arr[v].substring(0, 2);
      end = arr[v].substring(3, 5);
      arr[v] = st + end;
    }
  }
  drinkCheckArray = arr;
}

// 喝水时间变更保存，监听输入框变化并保存到 chrome 本地
drinkInput.change(function(event) {
  console.log('喝水设置改变了');
  getDrinkList();
  var drinkArrayStorage = {
    drinklist : drinkCheckArray
  }
  chrome.storage.local.set( drinkArrayStorage, function(){
    chrome.storage.local.get( drinkArrayStorage, function(result) {
      drinkCheckArray = result.drinklist;
    });
  });
});

var drinkTimeInterval;
// 喝水提醒主逻辑，每分钟检查一次当前时间是否需要提醒
function drinkProcess(){
  drinkTimeInterval = setInterval(function(){
    var drinkDate = new Date();
    var hours = drinkDate.getHours();
    var minutes = drinkDate.getMinutes(); // 获取当前时间
    console.log(hours+minutes+ '时钟相加');
    console.log(hours + ':' + minutes);
    for (var v in drinkCheckArray) {
      if (drinkCheckArray.hasOwnProperty(v)) {
        if (drinkCheckArray[v] == (hours * 100 + minutes)) { // 如果当前时间与喝水时间相同，则提醒
          console.log(hours + ':' + minutes + '喝水到');
          playAduio(4, audioArray, audioSwitchArray[4]);
          drinkNotify();
        }
      }
    }
  }, 60000);
}

// 番茄钟主流程，控制工作、短休息、长休息的切换与计时
function process() {
  if(processFlag) {
    timeColor(true);
    var workTime = workTimeState;
    var shortTime = shortTimeState;
    var longTime = longTimeState;
    playAduio(0, audioArray, audioSwitchArray[0]);
    workTimeNotify();
    tomatoState(0);
    var itemFlag = false;
    numberInfoObj.counts++;
    console.log('numberInfoObj.counts = ' + numberInfoObj.counts);
    showMessage();
    // 工作时间倒计时
    // 每秒检查一次，将计数器 -1，直到为 0 时触发提醒
      workTimeInterval = setInterval(function(){
      console.log('工作时间');
        workTime--;
        timeInfoObj.worktime++;
        showCountdown(workTime);
        // 工作结束，进入短休息
        if(workTime == 0 && numberInfoObj.counts % tomatoCountState != 0) {
          numberInfoObj.short++;
          timeColor(false);
          playAduio(1, audioArray, audioSwitchArray[1]);
          shortRestNotify();
          tomatoState(1);
          clearInterval(workTimeInterval); // 清除工作时间倒计时
          // 短休息时间倒计时，与上面的工作时间类似
          shortTimeInterval = setInterval(function(){
            console.log('短时间');
            shortTime--;
            timeInfoObj.shorttime++;
            showCountdown(shortTime);
            if(shortTime == 0) {
              itemFlag = true;
              clearInterval(shortTimeInterval);
              if(itemFlag) {
                process(); // 短休息结束，继续工作
              }
            }
          },1000);
        }
        // 工作结束，进入长休息
        // 累计完成的番茄钟数为设置番茄钟数量的整数倍时，即完成了一个周期，进入长休息
        if (workTime == 0 && numberInfoObj.counts % tomatoCountState == 0) {
          numberInfoObj.long++;
          timeColor(false);
          playAduio(2, audioArray, audioSwitchArray[2]);
          longRestNotify();
          tomatoState(2);
          clearInterval(workTimeInterval);
          // 长休息时间倒计时，与短时间同理
          longTimeInterval = setInterval(function(){
            console.log('长休息时间');
            longTime--;
            timeInfoObj.longtime++;
            showCountdown(longTime);
            if(longTime == 0) {
              itemFlag = true;
              clearInterval(longTimeInterval);
              if(itemFlag) {
                process();
              }
            }
          }, 1000);
        }
      },1000);
  }
}

// 眼保健流程，每隔eyeTimeState秒提醒一次
function eyecareProcess() {
  console.log('保护眼睛');
  var eyeTime = eyeTimeState;
  eyeTimeInterval = setInterval(function(){
    console.log("eye eyeTime = " + eyeTime);
    eyeTime--;
    if (eyeTime == 0) {
      playAduio(3, audioArray, audioSwitchArray[3]);
      eyecareNotify();
      clearInterval(eyeTimeInterval);
      eyecareProcess();
    }
  }, 1000); // 每秒检查一次，将计数器 -1，直到为 0 时触发提醒
}

// 播放音频提醒
// index: 音频类型索引，array: 音频选择数组，isPlay: 是否播放
function playAduio(index, array, isPlay){
  if(isPlay){
    var k = parseInt(array[index]);
    var audio = $('audio');
    audio[k].play();
  }
}

// 倒计时颜色切换，colorFlag为true时为蓝色，false为绿色
function timeColor(colorFlag) {
  if(colorFlag) {
    $('#countdown').css('color','rgb(31, 51, 116)');
  } else{
    $('#countdown').css('color','green');
  }
}

// 通知相关，使用chrome.notifications弹出桌面通知
function workTimeNotify() {
  chrome.notifications.create('workreminder', {
    type: 'basic',
    title: '学习工作啦！',
    iconUrl: 'assets/picture/work.jpg',
    message: '打起精神，开始学习工作！'
  });
}
function shortRestNotify() {
  chrome.notifications.create('shortrestreminder', {
    type: 'basic',
    title: '短休息',
    iconUrl: 'assets/picture/tea-cup.png',
    message: '工作时间结束，小小休息一下儿！'
  });
}

function longRestNotify() {
  chrome.notifications.create('longrestreminder', {
    type: 'basic',
    title: '长休息',
    iconUrl: 'assets/picture/rest.png',
    message: '工作时间结束，开启一段长休息！'
  });
}

function eyecareNotify() {
  chrome.notifications.create('eyecarereminder', {
    type: 'basic',
    title: '眼睛要好好保养',
    iconUrl: 'assets/picture/medical.png',
    message: '适当休息按摩眼睛，眼睛才会更漂亮！'
  });
}

function drinkNotify(){
  chrome.notifications.create('drinkreminder', {
    type: 'basic',
    title: '快去喝杯水吧',
    iconUrl: 'assets/picture/drink.png',
    message: '人体需要水分进行各类身体运动，快去补水吧！'
  });
}

// 状态显示，0-工作中，1-短休息，2-长休息
function tomatoState(state){
  switch(state){
    case 0:
      $tomatoState.html("工作中");
      break;
    case 1:
      $tomatoState.html("短休息");
      break;
    case 2:
      $tomatoState.html("长休息");
      break;
  }
}

// 显示倒计时，格式为 mm:ss
function showCountdown( time ) {
  var minutes = parseInt(time / 60);
  var seconds = time % 60;
  $('#countdown').text(checkTime(minutes) + ':' + checkTime(seconds) );
}

// 补零函数，个位数前补0
function checkTime(time) {
  if( time < 10) {
    time = '0' + time;
  }
  return time;
}


});
