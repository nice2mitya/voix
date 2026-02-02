/**
 * Персональный ассистент Мити Амбарцумяна
 * v5: Не прерываемся на приветствии + минимум филлеров
 */

require(Modules.ASR);

var CONFIG = {
  llm: { yandexApiKey: '', yandexFolderId: '' },
  voice: VoiceList.Yandex.Neural.ru_RU_filipp,

  systemPrompt: `Ты Филипп — ассистент Мити Амбарцумяна. Отвечай ТОЛЬКО одной короткой фразой.

ЗАДАЧА: узнать удобное время для звонка с Митей.

ВАЖНО: Если человек назвал конкретное время или день — подтверди и скажи "до свидания".

ФОРМАТ: только одно предложение, без кавычек, без ролей.

ПРИМЕРЫ:
- Человек: "завтра в три" → "Отлично, завтра в три. Митя позвонит. До свидания!"
- Человек: "в понедельник" → "Хорошо, в понедельник. Митя свяжется. До свидания!"
- Человек: "а зачем?" → "Митя хотел обсудить один рабочий вопрос. Когда удобно?"
- Человек: "не могу сейчас" → "Понял, когда лучше перезвонить?"
- Человек: "не интересно" → "Хорошо, извините за беспокойство. До свидания!"`,

  // Полное приветствие одной фразой - НЕ прерываемся
  greeting: 'Алло, здравствуйте! Это Филипп, ассистент Мити Амбарцумяна. Митя просил связаться с вами — хотел обсудить один вопрос. Когда вам удобно созвониться минут на десять?',

  // Только один филлер, с правильным произношением
  filler: 'Секу+нду.',

  endOfSpeechTimeout: 600,
  listenTimeout: 7000,
  maxTurns: 8
};

var call = null;
var asr = null;
var conversationHistory = [];
var currentTurn = 0;
var isFinished = false;
var isSpeaking = false;
var canListen = false; // Флаг: можно ли слушать (после приветствия)
var recognizedText = '';
var silenceTimeout = null;
var silenceCount = 0;
var usedFiller = false;

VoxEngine.addEventListener(AppEvents.Started, function(e) {
  Logger.write('=== Mitya Assistant v5 ===');

  var data = {};
  try { data = JSON.parse(VoxEngine.customData() || '{}'); } catch (err) {}

  if (data.yandexApiKey) CONFIG.llm.yandexApiKey = data.yandexApiKey;
  if (data.yandexFolderId) CONFIG.llm.yandexFolderId = data.yandexFolderId;

  if (!data.phone) {
    VoxEngine.terminate();
    return;
  }

  call = VoxEngine.callPSTN(data.phone, data.callerId || data.phone);
  call.addEventListener(CallEvents.Connected, onConnected);
  call.addEventListener(CallEvents.Disconnected, function() {
    Logger.write('=== End ===');
    VoxEngine.terminate();
  });
  call.addEventListener(CallEvents.Failed, function(e) {
    VoxEngine.terminate();
  });
});

function onConnected(e) {
  Logger.write('Connected');

  // ASR создаём, но НЕ слушаем до конца приветствия
  createASR();

  // Говорим полное приветствие БЕЗ прерывания
  canListen = false;
  speak(CONFIG.greeting, function() {
    // Теперь можно слушать
    canListen = true;
    Logger.write('Now listening...');
    startSilenceTimer();
  });
}

function createASR() {
  if (asr) return;

  asr = VoxEngine.createASR({
    profile: ASRProfileList.Yandex.ru_RU,
    model: ASRModelList.Yandex.general
  });

  asr.addEventListener(ASREvents.Result, function(e) {
    if (isFinished || !e.text || !e.text.trim()) return;

    // Игнорируем пока не закончили приветствие
    if (!canListen) {
      Logger.write('(ignored during greeting): ' + e.text);
      return;
    }

    Logger.write('>>> ' + e.text);
    recognizedText = e.text;
    silenceCount = 0;

    if (isSpeaking) {
      call.stopPlayback();
      isSpeaking = false;
    }

    clearTimeout(silenceTimeout);
    silenceTimeout = setTimeout(function() {
      processUserInput(recognizedText);
    }, CONFIG.endOfSpeechTimeout);
  });

  asr.addEventListener(ASREvents.InterimResult, function(e) {
    if (isFinished || !canListen || !e.text || !e.text.trim()) return;

    if (isSpeaking) {
      call.stopPlayback();
      isSpeaking = false;
    }
    clearTimeout(silenceTimeout);
  });

  call.sendMediaTo(asr);
}

function speak(text, callback) {
  Logger.write('Bot: ' + text);
  isSpeaking = true;

  call.say(text, {
    language: CONFIG.voice,
    progressivePlayback: true
  });

  call.addEventListener(CallEvents.PlaybackFinished, function onDone() {
    call.removeEventListener(CallEvents.PlaybackFinished, onDone);
    isSpeaking = false;
    if (callback && !isFinished) callback();
  });
}

function startSilenceTimer() {
  clearTimeout(silenceTimeout);
  silenceTimeout = setTimeout(function() {
    if (recognizedText) {
      processUserInput(recognizedText);
      return;
    }

    silenceCount++;
    if (silenceCount >= 3) {
      endConversation('Связь прервалась. Перезвоню позже. До свидания!');
      return;
    }

    var phrases = ['Алло?', 'Вы меня слышите?', 'Алло, вы на связи?'];
    speak(phrases[silenceCount - 1], function() {
      startSilenceTimer();
    });
  }, CONFIG.listenTimeout);
}

function processUserInput(text) {
  if (isFinished) return;

  currentTurn++;
  var input = text;
  recognizedText = '';
  clearTimeout(silenceTimeout);

  Logger.write('User [' + currentTurn + ']: ' + input);

  var lower = input.toLowerCase();

  // Быстрое завершение
  if (shouldEndCall(lower)) {
    endConversation(getFarewell(lower));
    return;
  }

  // Проверяем, назвали ли время
  if (hasTimeInResponse(lower)) {
    endConversation('Отлично, записал. Митя свяжется с вами. Спасибо! До свидания!');
    return;
  }

  if (currentTurn > CONFIG.maxTurns) {
    endConversation('Не буду больше отвлекать. Митя сам свяжется. Всего доброго!');
    return;
  }

  conversationHistory.push({ role: 'user', text: input });

  // Филлер только один раз за разговор
  if (!usedFiller) {
    usedFiller = true;
    speak(CONFIG.filler, function() {
      callYandexGPT(function(response) {
        handleGPTResponse(response);
      });
    });
  } else {
    // Без филлера
    callYandexGPT(function(response) {
      handleGPTResponse(response);
    });
  }
}

function handleGPTResponse(response) {
  if (isFinished) return;

  response = cleanResponse(response);
  Logger.write('Clean: ' + response);

  conversationHistory.push({ role: 'assistant', text: response });

  if (isEndPhrase(response)) {
    endConversation(response);
  } else {
    speak(response, function() {
      startSilenceTimer();
    });
  }
}

function hasTimeInResponse(text) {
  var timePatterns = [
    'завтра', 'послезавтра', 'сегодня',
    'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье',
    'на неделе', 'на следующей неделе', 'через неделю',
    'в час', 'в два', 'в три', 'в четыре', 'в пять', 'в шесть', 'в семь', 'в восемь', 'в девять', 'в десять', 'в одиннадцать', 'в двенадцать',
    'часов', 'часа', 'час ',
    'утром', 'днём', 'днем', 'вечером', 'ночью',
    'через час', 'через два', 'через полчаса', 'через пару часов',
    'после обеда', 'после работы', 'после шести', 'после семи',
    'минут через', 'позже сегодня', 'ближе к вечеру'
  ];

  for (var i = 0; i < timePatterns.length; i++) {
    if (text.indexOf(timePatterns[i]) >= 0) return true;
  }
  return false;
}

function cleanResponse(text) {
  text = text.replace(/Пользователь:.*$/gim, '');
  text = text.replace(/Ассистент:.*$/gim, '');
  text = text.replace(/User:.*$/gim, '');
  text = text.replace(/Assistant:.*$/gim, '');

  var sentences = text.split(/[.!?]/);
  if (sentences[0] && sentences[0].trim().length > 3) {
    text = sentences[0].trim();
    if (!/[.!?]$/.test(text)) text += '.';
  }

  return text.trim() || 'Когда вам удобно?';
}

function shouldEndCall(text) {
  var patterns = [
    'не звоните', 'не надо', 'не интересно', 'отстаньте',
    'в черный список', 'до свидания', 'всего доброго',
    'нет времени вообще', 'некогда совсем', 'занят очень',
    'не хочу', 'отвалите', 'прекратите'
  ];
  for (var i = 0; i < patterns.length; i++) {
    if (text.indexOf(patterns[i]) >= 0) return true;
  }
  return false;
}

function getFarewell(text) {
  if (text.indexOf('не звоните') >= 0 || text.indexOf('отстаньте') >= 0 || text.indexOf('отвалите') >= 0) {
    return 'Понял, извините за беспокойство. Всего доброго!';
  }
  if (text.indexOf('до свидания') >= 0 || text.indexOf('всего доброго') >= 0) {
    return 'До свидания!';
  }
  return 'Хорошо, не буду отвлекать. Всего доброго!';
}

function isEndPhrase(text) {
  var lower = text.toLowerCase();
  return lower.indexOf('до свидания') >= 0 ||
         lower.indexOf('всего доброго') >= 0 ||
         lower.indexOf('всего хорошего') >= 0;
}

function callYandexGPT(callback) {
  var messages = [{ role: 'system', text: CONFIG.systemPrompt }];
  messages.push({ role: 'assistant', text: CONFIG.greeting });

  for (var i = 0; i < conversationHistory.length; i++) {
    messages.push(conversationHistory[i]);
  }

  var body = JSON.stringify({
    modelUri: 'gpt://' + CONFIG.llm.yandexFolderId + '/yandexgpt/latest',
    completionOptions: {
      stream: false,
      temperature: 0.3,
      maxTokens: '60'
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
        callback('Когда вам удобно созвониться?');
      }
    } catch (err) {
      callback('Когда удобно будет?');
    }
  }).catch(function(err) {
    callback('Так когда лучше?');
  });
}

function endConversation(msg) {
  if (isFinished) return;
  isFinished = true;
  clearTimeout(silenceTimeout);

  if (asr) {
    call.stopMediaTo(asr);
    asr = null;
  }

  Logger.write('END: ' + msg);
  call.say(msg, { language: CONFIG.voice });
  call.addEventListener(CallEvents.PlaybackFinished, function() {
    call.hangup();
  });
}
