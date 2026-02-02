/**
 * Звонок с Avatar AI ботом
 * Avatar обрабатывает диалог и может делать HTTP запросы
 */

require(Modules.Avatar);

let call = null;
let avatar = null;

// Старт
VoxEngine.addEventListener(AppEvents.Started, function(e) {
  Logger.write('=== Avatar Call Started ===');

  let data = {};
  try {
    data = JSON.parse(VoxEngine.customData() || '{}');
  } catch (err) {
    Logger.write('Error parsing customData: ' + err);
  }

  if (!data.phone) {
    Logger.write('No phone number provided');
    VoxEngine.terminate();
    return;
  }

  Logger.write('Calling: ' + data.phone);

  call = VoxEngine.callPSTN(data.phone, data.callerId || data.phone);
  call.addEventListener(CallEvents.Connected, onConnected);
  call.addEventListener(CallEvents.Disconnected, onDisconnected);
  call.addEventListener(CallEvents.Failed, onFailed);
});

function onConnected(e) {
  Logger.write('Call connected, initializing Avatar...');

  // Конфигурация Avatar
  const avatarConfig = {
    avatarId: 'e803f6c5-4602-4d2b-9143-58cbedb2ad8f', // Твой Avatar ID
    // Данные для передачи в сценарий Avatar
    customData: JSON.stringify({
      phone: call.number(),
      callId: call.id()
    })
  };

  // Параметры ASR (Yandex SpeechKit)
  const asrParameters = {
    profile: ASRProfileList.Yandex.ru_RU,
    model: ASRModelList.Yandex.general
  };

  // Параметры TTS (Yandex Neural Voice)
  const ttsPlayerParameters = {
    language: VoiceList.Yandex.Neural.ru_RU_alena
  };

  // Создаём Voice Avatar
  avatar = VoximplantAvatar.createVoiceAvatar({
    call: call,
    avatarConfig: avatarConfig,
    asrParameters: asrParameters,
    ttsPlayerParameters: ttsPlayerParameters,
    asrEndOfPhraseDetectorTimeout: 1000, // 1 сек для определения конца фразы
    defaultListenTimeout: 10000, // 10 сек ожидания ответа

    // Обработка ошибок Avatar
    onErrorCallback: function(error) {
      Logger.write('Avatar error: ' + JSON.stringify(error));
      // Говорим об ошибке и кладём трубку
      call.say('Извините, произошла техническая ошибка. До свидания!', {
        language: VoiceList.Yandex.Neural.ru_RU_alena
      });
      call.addEventListener(CallEvents.PlaybackFinished, function() {
        call.hangup();
      });
    },

    // Завершение диалога Avatar
    onFinishCallback: function(result) {
      Logger.write('Avatar finished. Result: ' + JSON.stringify(result));
      call.hangup();
    }
  });

  // Обработка событий Avatar
  avatar.addEventListener(VoximplantAvatar.Events.Loaded, function(e) {
    Logger.write('Avatar loaded, starting conversation...');
    avatar.start();
  });

  avatar.addEventListener(VoximplantAvatar.Events.Reply, function(e) {
    Logger.write('Avatar reply: ' + JSON.stringify(e));
    // Avatar автоматически озвучит ответ через TTS

    // Если есть следующее состояние - переходим
    if (e.nextState) {
      avatar.goToState(e.nextState);
    }
  });

  avatar.addEventListener(VoximplantAvatar.Events.Error, function(e) {
    Logger.write('Avatar event error: ' + JSON.stringify(e));
  });
}

function onDisconnected(e) {
  Logger.write('Call disconnected');
  VoxEngine.terminate();
}

function onFailed(e) {
  Logger.write('Call failed: ' + e.code + ' - ' + e.reason);
  VoxEngine.terminate();
}
