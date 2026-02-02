/**
 * Умный голосовой бот с YandexGPT
 * ОПТИМИЗИРОВАННАЯ ВЕРСИЯ: быстрый отклик + barge-in
 */

require(Modules.ASR);

// ============ НАСТРОЙКИ ============
var CONFIG = {
  llm: {
    yandexApiKey: '',
    yandexFolderId: ''
  },
  systemPrompt: 'Ты - дружелюбный голосовой помощник. Отвечай ОЧЕНЬ коротко - максимум 1 предложение. Говори на русском. Не используй эмодзи.',
  listenTimeout: 8000,
  endOfSpeechTimeout: 800, // Уменьшено с 1500 до 800мс
  maxTurns: 10
};

// ============ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ============
var call = null;
var asr = null;
var conversationHistory = [];
var currentTurn = 0;
var isFinished = false;
var isSpeaking = false;
var recognizedText = '';
var silenceTimeout = null;

// ============ СТАРТ ============
VoxEngine.addEventListener(AppEvents.Started, function(e) {
  Logger.write('=== Smart Bot Started ===');

  var data = {};
  try {
    data = JSON.parse(VoxEngine.customData() || '{}');
  } catch (err) {}

  if (data.yandexApiKey) CONFIG.llm.yandexApiKey = data.yandexApiKey;
  if (data.yandexFolderId) CONFIG.llm.yandexFolderId = data.yandexFolderId;

  if (!data.phone) {
    Logger.write('No phone');
    VoxEngine.terminate();
    return;
  }

  call = VoxEngine.callPSTN(data.phone, data.callerId || data.phone);
  call.addEventListener(CallEvents.Connected, onConnected);
  call.addEventListener(CallEvents.Disconnected, function() {
    Logger.write('=== Call Ended ===');
    VoxEngine.terminate();
  });
  call.addEventListener(CallEvents.Failed, function(e) {
    Logger.write('Call failed: ' + e.code);
    VoxEngine.terminate();
  });
});

// ============ СОЕДИНЕНИЕ ============
function onConnected(e) {
  Logger.write('Connected');

  // Сразу создаём ASR - будет слушать даже во время TTS (barge-in)
  createASR();

  speak('Здравствуйте! Чем могу помочь?', function() {
    startSilenceTimer();
  });
}

// ============ ASR (всегда активен для barge-in) ============
function createASR() {
  if (asr) return;

  asr = VoxEngine.createASR({
    profile: ASRProfileList.Yandex.ru_RU,
    model: ASRModelList.Yandex.general
  });

  asr.addEventListener(ASREvents.Result, function(e) {
    if (isFinished) return;
    if (!e.text || !e.text.trim()) return;

    Logger.write('ASR: ' + e.text);
    recognizedText = e.text;

    // Если бот говорит - перебиваем!
    if (isSpeaking) {
      Logger.write('>>> BARGE-IN!');
      call.stopPlayback();
      isSpeaking = false;
    }

    clearTimeout(silenceTimeout);
    silenceTimeout = setTimeout(function() {
      processUserInput(recognizedText);
    }, CONFIG.endOfSpeechTimeout);
  });

  asr.addEventListener(ASREvents.InterimResult, function(e) {
    if (isFinished || !e.text || !e.text.trim()) return;

    // Перебивание при промежуточных результатах тоже
    if (isSpeaking) {
      Logger.write('>>> BARGE-IN (interim)');
      call.stopPlayback();
      isSpeaking = false;
    }

    clearTimeout(silenceTimeout);
  });

  call.sendMediaTo(asr);
  Logger.write('ASR ready');
}

// ============ TTS (с barge-in) ============
function speak(text, callback) {
  Logger.write('TTS: ' + text);
  isSpeaking = true;

  // НЕ останавливаем ASR - он продолжает слушать для barge-in
  call.say(text, {
    language: VoiceList.Yandex.Neural.ru_RU_alena,
    progressivePlayback: true // Начинаем воспроизведение быстрее
  });

  call.addEventListener(CallEvents.PlaybackFinished, function onDone() {
    call.removeEventListener(CallEvents.PlaybackFinished, onDone);
    isSpeaking = false;
    Logger.write('TTS done');
    if (callback && !isFinished) callback();
  });
}

// ============ ТАЙМЕР ТИШИНЫ ============
function startSilenceTimer() {
  clearTimeout(silenceTimeout);
  silenceTimeout = setTimeout(function() {
    if (recognizedText) {
      processUserInput(recognizedText);
    } else {
      speak('Вы здесь?', function() {
        startSilenceTimer();
      });
    }
  }, CONFIG.listenTimeout);
}

// ============ ОБРАБОТКА ВВОДА ============
function processUserInput(text) {
  if (isFinished) return;

  currentTurn++;
  recognizedText = '';
  clearTimeout(silenceTimeout);

  Logger.write('User: ' + text);

  if (currentTurn > CONFIG.maxTurns) {
    endConversation('Спасибо! До свидания!');
    return;
  }

  conversationHistory.push({ role: 'user', text: text });

  callYandexGPT(function(response) {
    if (isFinished) return;

    Logger.write('Bot: ' + response);
    conversationHistory.push({ role: 'assistant', text: response });

    var lower = response.toLowerCase();
    if (lower.indexOf('до свидания') >= 0 || lower.indexOf('всего доброго') >= 0) {
      endConversation(response);
    } else {
      speak(response, function() {
        startSilenceTimer();
      });
    }
  });
}

// ============ YANDEXGPT ============
function callYandexGPT(callback) {
  var messages = [{ role: 'system', text: CONFIG.systemPrompt }];
  for (var i = 0; i < conversationHistory.length; i++) {
    messages.push(conversationHistory[i]);
  }

  var body = JSON.stringify({
    modelUri: 'gpt://' + CONFIG.llm.yandexFolderId + '/yandexgpt-lite',
    completionOptions: {
      stream: false,
      temperature: 0.5,
      maxTokens: '80' // Уменьшено для коротких ответов
    },
    messages: messages
  });

  Net.httpRequestAsync('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Api-Key ' + CONFIG.llm.yandexApiKey
    },
    postData: body
  }).then(function(result) {
    try {
      var resp = JSON.parse(result.text);
      if (resp.result && resp.result.alternatives && resp.result.alternatives[0]) {
        callback(resp.result.alternatives[0].message.text);
      } else {
        callback('Извините, ошибка.');
      }
    } catch (err) {
      callback('Ошибка обработки.');
    }
  }).catch(function(err) {
    callback('Проблема с сетью.');
  });
}

// ============ ЗАВЕРШЕНИЕ ============
function endConversation(msg) {
  if (isFinished) return;
  isFinished = true;
  clearTimeout(silenceTimeout);

  if (asr) {
    call.stopMediaTo(asr);
    asr = null;
  }

  call.say(msg, { language: VoiceList.Yandex.Neural.ru_RU_alena });
  call.addEventListener(CallEvents.PlaybackFinished, function() {
    call.hangup();
  });
}
