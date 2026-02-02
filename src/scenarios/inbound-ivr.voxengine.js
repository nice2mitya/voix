/**
 * Входящий IVR с Yandex SpeechKit
 *
 * Сценарий:
 * 1. Ответ на входящий звонок
 * 2. TTS: Приветствие и меню
 * 3. Ожидание DTMF (1, 2) или голосовой команды
 * 4. TTS: Ответ в зависимости от выбора
 * 5. Завершение
 */

require(Modules.ASR);

// Настройки голоса Yandex
const VOICE_OPTIONS = {
  language: VoiceList.Yandex.Neural.ru_RU,
  voice: VoiceList.Yandex.Neural.Alena,
  rate: 'medium',
  pitch: 'medium',
  volume: 'medium'
};

// Настройки распознавания
const ASR_OPTIONS = {
  profile: ASRProfileList.Yandex.ru_RU,
  language: ASRLanguage.RUSSIAN_RU,
  model: ASRModelList.Yandex.general
};

let call = null;
let asr = null;
let inputTimeout = null;
let dtmfInput = '';
let voiceInput = '';
let waitingForInput = false;

// Входящий звонок
VoxEngine.addEventListener(AppEvents.CallAlerting, function(e) {
  Logger.write('=== Входящий звонок ===');
  Logger.write('От: ' + e.callerid);

  call = e.call;

  call.addEventListener(CallEvents.Connected, onCallConnected);
  call.addEventListener(CallEvents.Disconnected, onCallDisconnected);

  // Отвечаем на звонок
  call.answer();
});

// Звонок соединен
function onCallConnected(e) {
  Logger.write('Звонок принят');

  // Включаем обработку DTMF
  call.handleTones(true);
  call.addEventListener(CallEvents.ToneReceived, onToneReceived);

  // Произносим приветствие
  call.say(
    'Здравствуйте! Добро пожаловать в систему Войкс. ' +
    'Нажмите 1 или скажите "тест" для проверки распознавания речи. ' +
    'Нажмите 2 или скажите "информация" для получения информации.',
    VOICE_OPTIONS
  );

  call.addEventListener(CallEvents.PlaybackFinished, onMenuFinished);
}

// Меню воспроизведено
function onMenuFinished(e) {
  call.removeEventListener(CallEvents.PlaybackFinished, onMenuFinished);
  Logger.write('Меню воспроизведено, ожидаем ввод');

  waitingForInput = true;
  dtmfInput = '';
  voiceInput = '';

  // Запускаем распознавание голоса
  startASR();

  // Таймаут на ввод (10 секунд)
  inputTimeout = setTimeout(function() {
    Logger.write('Таймаут ожидания ввода');
    stopASR();
    handleNoInput();
  }, 10000);
}

// Запуск распознавания речи
function startASR() {
  asr = VoxEngine.createASR(ASR_OPTIONS);

  asr.addEventListener(ASREvents.Result, onASRResult);
  asr.addEventListener(ASREvents.Error, onASRError);

  call.sendMediaTo(asr);
}

// Остановка распознавания
function stopASR() {
  if (asr) {
    call.stopMediaTo(asr);
    asr = null;
  }
}

// Получен DTMF тон
function onToneReceived(e) {
  Logger.write('DTMF: ' + e.tone);

  if (!waitingForInput) return;

  dtmfInput = e.tone;
  clearTimeout(inputTimeout);
  waitingForInput = false;
  stopASR();

  processInput('dtmf', e.tone);
}

// Получен результат распознавания
function onASRResult(e) {
  Logger.write('ASR: ' + e.text + ' (confidence: ' + e.confidence + ')');

  if (!waitingForInput) return;
  if (!e.text || !e.text.trim()) return;

  voiceInput = e.text.toLowerCase().trim();

  // Проверяем ключевые слова
  if (voiceInput.includes('тест') || voiceInput.includes('один') || voiceInput === '1') {
    clearTimeout(inputTimeout);
    waitingForInput = false;
    stopASR();
    processInput('voice', '1');
  } else if (voiceInput.includes('информация') || voiceInput.includes('два') || voiceInput === '2') {
    clearTimeout(inputTimeout);
    waitingForInput = false;
    stopASR();
    processInput('voice', '2');
  }
}

// Ошибка ASR
function onASRError(e) {
  Logger.write('ASR ошибка: ' + JSON.stringify(e));
}

// Обработка ввода
function processInput(inputType, value) {
  Logger.write('Обработка ввода: ' + inputType + ' = ' + value);

  if (value === '1') {
    // Тест распознавания
    call.say(
      'Вы выбрали тест распознавания. Скажите что-нибудь после сигнала.',
      VOICE_OPTIONS
    );
    call.addEventListener(CallEvents.PlaybackFinished, startTestMode);
  } else if (value === '2') {
    // Информация
    call.say(
      'Система Войкс - это платформа для тестирования телефонных звонков ' +
      'с использованием Voximplant и Яндекс Спичкит. ' +
      'Спасибо за звонок! До свидания!',
      VOICE_OPTIONS
    );
    call.addEventListener(CallEvents.PlaybackFinished, endCall);
  } else {
    handleInvalidInput();
  }
}

// Неверный ввод
function handleInvalidInput() {
  call.say(
    'Извините, я не понял ваш выбор. Попробуйте снова. ' +
    'Нажмите 1 для теста или 2 для информации.',
    VOICE_OPTIONS
  );
  call.addEventListener(CallEvents.PlaybackFinished, onMenuFinished);
}

// Нет ввода
function handleNoInput() {
  call.say(
    'Я не получил ответа. Пожалуйста, нажмите 1 или 2, или скажите команду.',
    VOICE_OPTIONS
  );
  call.addEventListener(CallEvents.PlaybackFinished, onMenuFinished);
}

// Режим тестирования STT
function startTestMode(e) {
  call.removeEventListener(CallEvents.PlaybackFinished, startTestMode);

  // Сигнал
  call.say('бип', {
    language: VoiceList.Yandex.Neural.ru_RU,
    voice: VoiceList.Yandex.Neural.Alena,
    rate: 'fast'
  });

  call.addEventListener(CallEvents.PlaybackFinished, onTestBeepFinished);
}

function onTestBeepFinished(e) {
  call.removeEventListener(CallEvents.PlaybackFinished, onTestBeepFinished);

  let testText = '';

  const testAsr = VoxEngine.createASR(ASR_OPTIONS);

  testAsr.addEventListener(ASREvents.Result, function(e) {
    if (e.text && e.text.trim()) {
      testText = e.text;
    }
  });

  call.sendMediaTo(testAsr);

  setTimeout(function() {
    call.stopMediaTo(testAsr);

    let response;
    if (testText) {
      response = 'Вы сказали: ' + testText + '. Отличный тест! Спасибо за звонок!';
    } else {
      response = 'К сожалению, я не смог распознать речь. Спасибо за звонок!';
    }

    Logger.write('Тест STT результат: ' + (testText || '(пусто)'));

    call.say(response, VOICE_OPTIONS);
    call.addEventListener(CallEvents.PlaybackFinished, endCall);
  }, 5000);
}

// Завершение звонка
function endCall(e) {
  call.removeEventListener(CallEvents.PlaybackFinished, endCall);
  Logger.write('Завершаем звонок');
  call.hangup();
}

// Звонок отключен
function onCallDisconnected(e) {
  Logger.write('Звонок завершен');
  Logger.write('=== Сессия окончена ===');
  VoxEngine.terminate();
}
