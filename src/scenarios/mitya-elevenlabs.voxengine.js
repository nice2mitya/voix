/**
 * Персональный ассистент Мити Амбарцумяна (Аиша)
 * v8: Потоковое воспроизведение коротких фраз + улучшенная логика
 */

require(Modules.ASR);

var CONFIG = {
  llm: { yandexApiKey: '', yandexFolderId: '' },
  elevenLabsApiKey: '',
  voiceId: 'rsotas5V9CH0fqkg0oNZ',

  systemPrompt: `Ты Аиша — ассистент Мити Амбарцумяна. Отвечай ТОЛЬКО одной короткой фразой.

ХАРАКТЕР: дружелюбная, тёплая, немного игривая, но деловая. Говоришь мягко и с улыбкой в голосе.

ЗАДАЧА: узнать КОНКРЕТНОЕ время для звонка с Митей (день недели + время).

ВАЖНО:
- Если человек назвал И день И время — радостно подтверди и скажи "до свидания"
- Если назвал только день без времени — мягко уточни время
- Если назвал только время без дня — уточни день
- При отказе — понимающе попрощайся

ФОРМАТ: только одно предложение, без кавычек, без ролей.

ФИШЕЧКИ: используй живые фразы типа "Записала!", "Ловлю!", "Поняла!"

ПРИМЕРЫ:
- "завтра в три" → "Супер, завтра в три! Записала, Митя позвонит. До свидания!"
- "в понедельник" → "Отлично, понедельник! А в какое время удобнее?"
- "в три часа" → "Поняла, в три! А какой день лучше?"
- "а зачем?" → "Митя хотел обсудить один вопрос с вами. Когда удобно будет?"
- "не интересно" → "Поняла, простите за беспокойство! Всего доброго!"`,

  // Разбитое приветствие на короткие фразы
  greetingParts: [
    'Алло, здравствуйте!',
    'Это Аиша, ассистент Мити Амбарцумяна.',
    'Митя просил связаться с вами — хотел обсудить один вопрос.',
    'Когда вам удобно созвониться минут на десять?'
  ],

  fullGreeting: 'Алло, здравствуйте! Это Аиша, ассистент Мити Амбарцумяна. Митя просил связаться с вами — хотел обсудить один вопрос. Когда вам удобно созвониться минут на десять?',

  filler: 'Секундочку!',

  endOfSpeechTimeout: 600,
  listenTimeout: 7000,
  maxTurns: 8
};

var call = null;
var asr = null;
var ttsPlayer = null;
var conversationHistory = [];
var currentTurn = 0;
var isFinished = false;
var isSpeaking = false;
var canListen = false;
var recognizedText = '';
var silenceTimeout = null;
var silenceCount = 0;
var currentPhraseIndex = 0;
var usedFiller = false;

VoxEngine.addEventListener(AppEvents.Started, function(e) {
  Logger.write('=== Mitya Assistant v8 (Aisha) ===');

  var data = {};
  try { data = JSON.parse(VoxEngine.customData() || '{}'); } catch (err) {}

  if (data.yandexApiKey) CONFIG.llm.yandexApiKey = data.yandexApiKey;
  if (data.yandexFolderId) CONFIG.llm.yandexFolderId = data.yandexFolderId;
  if (data.elevenLabsApiKey) CONFIG.elevenLabsApiKey = data.elevenLabsApiKey;
  if (data.voiceId) CONFIG.voiceId = data.voiceId;
  if (data.systemPrompt) CONFIG.systemPrompt = data.systemPrompt;
  if (data.greeting) {
    CONFIG.fullGreeting = data.greeting;
    // Split greeting into parts for streaming playback
    CONFIG.greetingParts = data.greeting.split(/[.!?]+/).filter(function(s) {
      return s.trim().length > 0;
    }).map(function(s) {
      return s.trim() + '.';
    });
  }

  if (!data.phone) {
    Logger.write('No phone number');
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
    Logger.write('Call failed: ' + e.code);
    VoxEngine.terminate();
  });
});

function onConnected(e) {
  Logger.write('Connected');

  createASR();
  canListen = false;

  // Играем приветствие по частям - каждая фраза генерируется отдельно
  Logger.write('Starting streaming greeting...');
  playNextGreetingPart();
}

// Потоковое воспроизведение - играем фразы одну за другой
function playNextGreetingPart() {
  if (isFinished) return;

  if (currentPhraseIndex >= CONFIG.greetingParts.length) {
    // Все фразы проиграны - начинаем слушать
    Logger.write('Greeting complete, now listening...');
    canListen = true;
    startSilenceTimer();
    return;
  }

  var phrase = CONFIG.greetingParts[currentPhraseIndex];
  Logger.write('Phrase ' + (currentPhraseIndex + 1) + '/' + CONFIG.greetingParts.length + ': ' + phrase);

  speakElevenLabs(phrase, function() {
    currentPhraseIndex++;
    // Небольшая пауза между фразами для естественности
    setTimeout(function() {
      playNextGreetingPart();
    }, 100);
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

    if (!canListen) {
      Logger.write('(ignored during greeting): ' + e.text);
      return;
    }

    Logger.write('>>> ' + e.text);
    recognizedText = e.text;
    silenceCount = 0;

    if (isSpeaking) {
      stopPlayback();
    }

    clearTimeout(silenceTimeout);
    silenceTimeout = setTimeout(function() {
      processUserInput(recognizedText);
    }, CONFIG.endOfSpeechTimeout);
  });

  asr.addEventListener(ASREvents.InterimResult, function(e) {
    if (isFinished || !canListen || !e.text || !e.text.trim()) return;

    if (isSpeaking) {
      stopPlayback();
    }
    clearTimeout(silenceTimeout);
  });

  call.sendMediaTo(asr);
}

function stopPlayback() {
  if (ttsPlayer) ttsPlayer.stop();
  call.stopPlayback();
  isSpeaking = false;
}

// ElevenLabs TTS для коротких ответов
function speakElevenLabs(text, callback) {
  Logger.write('Bot (ElevenLabs): ' + text);
  isSpeaking = true;

  if (!CONFIG.elevenLabsApiKey) {
    // Fallback на Yandex
    speakYandex(text, callback);
    return;
  }

  var voice = VoiceList.ElevenLabs.createBrandVoice(CONFIG.voiceId);

  ttsPlayer = VoxEngine.createTTSPlayer(text, {
    language: voice,
    apiKey: CONFIG.elevenLabsApiKey,
    progressivePlayback: true,
    request: {
      model_id: 'eleven_turbo_v2_5',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      }
    }
  });

  ttsPlayer.addEventListener(PlayerEvents.PlaybackFinished, function() {
    Logger.write('ElevenLabs TTS finished');
    isSpeaking = false;
    if (callback && !isFinished) callback();
  });

  ttsPlayer.sendMediaTo(call);
}

// Yandex TTS fallback (женский голос)
function speakYandex(text, callback) {
  Logger.write('Bot (Yandex): ' + text);
  isSpeaking = true;

  call.say(text, {
    language: VoiceList.Yandex.Neural.ru_RU_alena,
    progressivePlayback: true
  });

  call.addEventListener(CallEvents.PlaybackFinished, function onDone() {
    call.removeEventListener(CallEvents.PlaybackFinished, onDone);
    Logger.write('Yandex TTS finished');
    isSpeaking = false;
    if (callback && !isFinished) callback();
  });
}

function speak(text, callback) {
  if (CONFIG.elevenLabsApiKey) {
    speakElevenLabs(text, callback);
  } else {
    speakYandex(text, callback);
  }
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
      endConversation('Связь прервалась. Перезвоню позже. Всего доброго!');
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

  if (shouldEndCall(lower)) {
    endConversation(getFarewell(lower));
    return;
  }

  // Проверяем полное время (день + время)
  if (hasFullDateTime(lower)) {
    endConversation('Супер, записала! Митя свяжется с вами. Спасибо, до свидания!');
    return;
  }

  if (currentTurn > CONFIG.maxTurns) {
    endConversation('Не буду больше отвлекать. Митя сам свяжется. Всего доброго!');
    return;
  }

  conversationHistory.push({ role: 'user', text: input });

  if (!usedFiller) {
    usedFiller = true;
    speak(CONFIG.filler, function() {
      callLLM(function(response) {
        handleGPTResponse(response);
      });
    });
  } else {
    callLLM(function(response) {
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

// Проверяем наличие ДНЯ в ответе
function hasDayInResponse(text) {
  var dayPatterns = [
    'завтра', 'послезавтра', 'сегодня',
    'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье',
    'на неделе', 'на следующей неделе', 'через неделю'
  ];
  for (var i = 0; i < dayPatterns.length; i++) {
    if (text.indexOf(dayPatterns[i]) >= 0) return true;
  }
  return false;
}

// Проверяем наличие ВРЕМЕНИ в ответе
function hasTimeInResponse(text) {
  var timePatterns = [
    'в час', 'в два', 'в три', 'в четыре', 'в пять', 'в шесть', 'в семь', 'в восемь', 'в девять', 'в десять', 'в одиннадцать', 'в двенадцать',
    'часов', 'часа', 'час ',
    'утром', 'днём', 'днем', 'вечером',
    'через час', 'через два', 'через полчаса', 'через пару часов',
    'после обеда', 'после работы', 'после шести', 'после семи',
    'ближе к вечеру', 'в обед'
  ];
  for (var i = 0; i < timePatterns.length; i++) {
    if (text.indexOf(timePatterns[i]) >= 0) return true;
  }
  return false;
}

// Полное время = день + время (или комбинированные фразы)
function hasFullDateTime(text) {
  // Комбинированные фразы которые сразу содержат и день и время
  var combined = [
    'завтра утром', 'завтра днем', 'завтра днём', 'завтра вечером',
    'сегодня вечером', 'сегодня днем', 'сегодня днём',
    'послезавтра утром', 'послезавтра днем', 'послезавтра вечером',
    'завтра в ', 'сегодня в ', 'послезавтра в ',
    'через час', 'через полчаса', 'через пару часов', 'минут через'
  ];
  for (var i = 0; i < combined.length; i++) {
    if (text.indexOf(combined[i]) >= 0) return true;
  }

  // Или если есть и день и время отдельно
  return hasDayInResponse(text) && hasTimeInResponse(text);
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
    return 'Поняла, простите за беспокойство. Всего доброго!';
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

function callLLM(callback) {
  // Формат OpenAI API - content вместо text
  var messages = [
    { role: 'system', content: CONFIG.systemPrompt },
    { role: 'assistant', content: CONFIG.fullGreeting }
  ];

  for (var i = 0; i < conversationHistory.length; i++) {
    messages.push({
      role: conversationHistory[i].role,
      content: conversationHistory[i].text
    });
  }

  var modelUri = 'gpt://' + CONFIG.llm.yandexFolderId + '/aliceai-llm/latest';
  Logger.write('LLM request to: ' + modelUri);

  var body = JSON.stringify({
    model: modelUri,
    messages: messages,
    max_tokens: 80,
    temperature: 0.3
  });

  var startTime = Date.now();

  // OpenAI-совместимый endpoint для Qwen
  Net.httpRequestAsync('https://llm.api.cloud.yandex.net/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Api-Key ' + CONFIG.llm.yandexApiKey
    },
    postData: body
  }).then(function(result) {
    var elapsed = Date.now() - startTime;
    Logger.write('LLM response in ' + elapsed + 'ms');
    try {
      var resp = JSON.parse(result.text);
      if (resp.choices && resp.choices[0] && resp.choices[0].message) {
        var text = resp.choices[0].message.content;
        Logger.write('LLM raw: ' + text);
        callback(text);
      } else {
        Logger.write('LLM error: no choices - ' + result.text);
        callback('Когда вам удобно созвониться?');
      }
    } catch (err) {
      Logger.write('LLM parse error: ' + err + ' - ' + result.text);
      callback('Когда удобно будет?');
    }
  }).catch(function(err) {
    Logger.write('LLM network error: ' + err);
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

  // Гарантированное завершение через 10 секунд
  var hangupTimer = setTimeout(function() {
    Logger.write('Hangup by timeout');
    call.hangup();
  }, 10000);

  speak(msg, function() {
    clearTimeout(hangupTimer);
    Logger.write('Hangup after speech');
    call.hangup();
  });
}
