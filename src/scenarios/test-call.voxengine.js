/**
 * Тестовый звонок с Yandex SpeechKit
 * Живой диалог с поддержкой перебивания (barge-in)
 */

require(Modules.ASR);

let call = null;
let asr = null;
let recognizedText = '';
let responseTimeout = null;
let isFinished = false;
let isSpeaking = false;

// Старт
VoxEngine.addEventListener(AppEvents.Started, function(e) {
  Logger.write('=== Старт ===');

  let data = {};
  try {
    data = JSON.parse(VoxEngine.customData() || '{}');
  } catch (err) {}

  if (!data.phone) {
    VoxEngine.terminate();
    return;
  }

  call = VoxEngine.callPSTN(data.phone, data.callerId || data.phone);
  call.addEventListener(CallEvents.Connected, onConnected);
  call.addEventListener(CallEvents.Disconnected, function() {
    Logger.write('=== Конец ===');
    VoxEngine.terminate();
  });
  call.addEventListener(CallEvents.Failed, function(e) {
    Logger.write('Ошибка: ' + e.code);
    VoxEngine.terminate();
  });
});

function onConnected(e) {
  Logger.write('Соединено');

  // Сразу создаём ASR чтобы слушать даже во время речи бота
  asr = VoxEngine.createASR({
    profile: ASRProfileList.Yandex.ru_RU,
    model: ASRModelList.Yandex.general
  });

  asr.addEventListener(ASREvents.Result, onSpeechRecognized);
  call.sendMediaTo(asr);

  // Говорим приветствие
  sayWithBargeIn('Здравствуйте! Как ваши дела сегодня?', function() {
    Logger.write('Приветствие сказано, жду ответ...');
    // Таймаут 10 сек на ответ
    responseTimeout = setTimeout(function() {
      respond();
    }, 10000);
  });
}

// TTS с поддержкой перебивания
function sayWithBargeIn(text, callback) {
  Logger.write('Говорю: ' + text);
  isSpeaking = true;

  call.say(text, {
    language: VoiceList.Yandex.Neural.ru_RU_alena
  });

  call.addEventListener(CallEvents.PlaybackFinished, function onDone() {
    call.removeEventListener(CallEvents.PlaybackFinished, onDone);
    isSpeaking = false;
    if (callback && !isFinished) callback();
  });
}

// Распознана речь
function onSpeechRecognized(e) {
  if (isFinished) return;
  if (!e.text || !e.text.trim()) return;

  Logger.write('Услышал: ' + e.text);
  recognizedText = e.text;

  // Если бот говорит - перебиваем его!
  if (isSpeaking) {
    Logger.write('>>> Перебивание! Останавливаю речь');
    call.stopPlayback();
    isSpeaking = false;
  }

  // Сбрасываем таймаут и ставим короткий (1.5 сек чтобы человек договорил)
  clearTimeout(responseTimeout);
  responseTimeout = setTimeout(function() {
    respond();
  }, 1500);
}

function respond() {
  if (isFinished) return;
  isFinished = true;
  clearTimeout(responseTimeout);

  // Останавливаем ASR
  if (asr) {
    call.stopMediaTo(asr);
    asr = null;
  }

  Logger.write('Распознано: ' + (recognizedText || 'ничего'));

  var text;
  if (recognizedText) {
    text = 'Вы сказали: ' + recognizedText + '. Отлично! Спасибо за разговор. До свидания!';
  } else {
    text = 'Жаль что не ответили. До свидания!';
  }

  call.say(text, {
    language: VoiceList.Yandex.Neural.ru_RU_alena
  });

  call.addEventListener(CallEvents.PlaybackFinished, function() {
    call.hangup();
  });
}
