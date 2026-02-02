/**
 * Входящие звонки - Личный ассистент Мити (Аиша)
 * Принимает звонки, выслушивает, задаёт уточняющие вопросы, записывает в лог
 */

require(Modules.ASR);

var CONFIG = {
  llm: {
    yandexApiKey: '',  // Передаётся через customData
    yandexFolderId: ''
  },
  elevenLabsApiKey: '',  // Передаётся через customData
  voiceId: 'rsotas5V9CH0fqkg0oNZ',

  systemPrompt: `Ты Аиша — личный ассистент Мити Амбарцумяна. Ты принимаешь входящие звонки.

ХАРАКТЕР: дружелюбная, тёплая, немного игривая, но деловая. Говоришь мягко и располагающе.

ЗАДАЧА: вежливо выслушать звонящего, понять суть обращения, задать 1-2 уточняющих вопроса если нужно.

ПРАВИЛА:
- Отвечай ТОЛЬКО одной короткой фразой (1-2 предложения)
- Используй живые фразы: "Записала!", "Поняла!", "Ловлю!"
- Если человек что-то просит передать Мите — подтверди с энтузиазмом
- Если нужны уточнения — задай мягкий вопрос
- В конце тепло попрощайся

ПРИМЕРЫ:
- "Хочу поговорить с Митей" → "Мити сейчас нет, но я передам! Что ему сказать?"
- "Передайте что звонил Иван" → "Записала! Иван звонил. Номер у него ваш есть?"
- "Да, номер есть" → "Отлично, тогда Митя перезвонит! Спасибо за звонок!"
- "По поводу проекта" → "Поняла! А по какому именно проекту, подскажете?"`,

  greeting: 'Алло! Это Аиша, ассистент Мити. Слушаю вас!',

  endOfSpeechTimeout: 800,
  listenTimeout: 10000,
  maxTurns: 10
};

var call = null;
var asr = null;
var ttsPlayer = null;
var conversationHistory = [];
var conversationLog = [];
var currentTurn = 0;
var isFinished = false;
var isSpeaking = false;
var canListen = false;
var recognizedText = '';
var silenceTimeout = null;
var silenceCount = 0;
var callerNumber = '';

VoxEngine.addEventListener(AppEvents.CallAlerting, function(e) {
  Logger.write('=== Mitya Inbound Assistant (Aisha) ===');
  Logger.write('Incoming call from: ' + e.callerid);

  callerNumber = e.callerid;
  call = e.call;

  // Получаем конфиг из customData приложения или используем дефолт
  try {
    var appData = JSON.parse(VoxEngine.customData() || '{}');
    if (appData.yandexApiKey) CONFIG.llm.yandexApiKey = appData.yandexApiKey;
    if (appData.yandexFolderId) CONFIG.llm.yandexFolderId = appData.yandexFolderId;
    if (appData.elevenLabsApiKey) CONFIG.elevenLabsApiKey = appData.elevenLabsApiKey;
  } catch (err) {}

  call.addEventListener(CallEvents.Connected, onConnected);
  call.addEventListener(CallEvents.Disconnected, onDisconnected);
  call.addEventListener(CallEvents.Failed, function(e) {
    Logger.write('Call failed: ' + e.code);
    VoxEngine.terminate();
  });

  call.answer();
});

function onConnected(e) {
  Logger.write('Connected');

  conversationLog.push({
    time: new Date().toISOString(),
    event: 'call_started',
    caller: callerNumber
  });

  createASR();

  // Приветствие
  speak(CONFIG.greeting, function() {
    canListen = true;
    Logger.write('Now listening...');
    startSilenceTimer();
  });
}

function onDisconnected(e) {
  Logger.write('=== Call Summary ===');
  Logger.write('Caller: ' + callerNumber);
  Logger.write('Turns: ' + currentTurn);
  Logger.write('--- Conversation Log ---');

  for (var i = 0; i < conversationLog.length; i++) {
    var entry = conversationLog[i];
    if (entry.speaker) {
      Logger.write('[' + entry.speaker + ']: ' + entry.text);
    } else {
      Logger.write('[' + entry.event + ']');
    }
  }

  Logger.write('=== End ===');
  VoxEngine.terminate();
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
      Logger.write('(ignored during speech): ' + e.text);
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

function speak(text, callback) {
  Logger.write('Bot: ' + text);
  isSpeaking = true;
  canListen = false;

  if (!CONFIG.elevenLabsApiKey) {
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
    isSpeaking = false;
    canListen = true;
    if (callback && !isFinished) callback();
  });

  ttsPlayer.sendMediaTo(call);
}

function speakYandex(text, callback) {
  isSpeaking = true;

  call.say(text, {
    language: VoiceList.Yandex.Neural.ru_RU_alena,
    progressivePlayback: true
  });

  call.addEventListener(CallEvents.PlaybackFinished, function onDone() {
    call.removeEventListener(CallEvents.PlaybackFinished, onDone);
    isSpeaking = false;
    canListen = true;
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
      endConversation('Не слышу вас. Перезвоните, пожалуйста. До свидания!');
      return;
    }

    var phrases = ['Алло, слушаю!', 'Вы на связи?', 'Алло, вы тут?'];
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

  conversationLog.push({
    time: new Date().toISOString(),
    speaker: 'user',
    text: input
  });

  var lower = input.toLowerCase();

  // Проверяем завершающие фразы от пользователя
  if (isUserGoodbye(lower)) {
    endConversation('До свидания! Передам Мите.');
    return;
  }

  if (currentTurn > CONFIG.maxTurns) {
    endConversation('Хорошо, я всё записала. Митя свяжется с вами. До свидания!');
    return;
  }

  conversationHistory.push({ role: 'user', text: input });

  callLLM(function(response) {
    handleResponse(response);
  });
}

function handleResponse(response) {
  if (isFinished) return;

  response = cleanResponse(response);
  Logger.write('Clean: ' + response);

  conversationHistory.push({ role: 'assistant', text: response });
  conversationLog.push({
    time: new Date().toISOString(),
    speaker: 'assistant',
    text: response
  });

  if (isEndPhrase(response)) {
    endConversation(response);
  } else {
    speak(response, function() {
      startSilenceTimer();
    });
  }
}

function isUserGoodbye(text) {
  var patterns = ['до свидания', 'всего доброго', 'пока', 'спасибо до свидания', 'ладно пока'];
  for (var i = 0; i < patterns.length; i++) {
    if (text.indexOf(patterns[i]) >= 0) return true;
  }
  return false;
}

function isEndPhrase(text) {
  var lower = text.toLowerCase();
  return lower.indexOf('до свидания') >= 0 ||
         lower.indexOf('всего доброго') >= 0 ||
         lower.indexOf('спасибо за звонок') >= 0;
}

function cleanResponse(text) {
  text = text.replace(/Пользователь:.*$/gim, '');
  text = text.replace(/Ассистент:.*$/gim, '');
  text = text.replace(/User:.*$/gim, '');
  text = text.replace(/Assistant:.*$/gim, '');

  // Берём первые 2 предложения
  var sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  if (sentences.length > 2) {
    text = sentences.slice(0, 2).join(' ');
  }

  return text.trim() || 'Поняла вас. Что-то ещё?';
}

function callLLM(callback) {
  var messages = [
    { role: 'system', content: CONFIG.systemPrompt },
    { role: 'assistant', content: CONFIG.greeting }
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
    max_tokens: 100,
    temperature: 0.3
  });

  var startTime = Date.now();

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
        callback('Поняла вас. Передам Мите.');
      }
    } catch (err) {
      Logger.write('LLM parse error: ' + err + ' - ' + result.text);
      callback('Хорошо, записала. Что-то ещё?');
    }
  }).catch(function(err) {
    Logger.write('LLM network error: ' + err);
    callback('Поняла. Митя свяжется с вами.');
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

  conversationLog.push({
    time: new Date().toISOString(),
    speaker: 'assistant',
    text: msg
  });

  var hangupTimer = setTimeout(function() {
    Logger.write('Hangup by timeout');
    call.hangup();
  }, 10000);

  speak(msg, function() {
    clearTimeout(hangupTimer);
    Logger.write('Hangup after speech');
    setTimeout(function() {
      call.hangup();
    }, 500);
  });
}
