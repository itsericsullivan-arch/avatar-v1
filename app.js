(() => {
  const cfg = {
    looks: {
      everyday: { label: 'Everyday', subtitle: 'Belly tee + frayed denim cutoffs', scene: 'warm-home', ready: true },
      mint: { label: 'Mint', subtitle: 'Mint dress + camel cutout heels', scene: 'dressy-home' },
      power: { label: 'Power', subtitle: 'Pinstripe skirt + Spiked Orbit heels', scene: 'sharp-interior' },
      cozy: { label: 'Cozy', subtitle: 'Oversized T-shirt · curled up on couch', scene: 'cozy-couch' },
      poolside: { label: 'Poolside', subtitle: 'Favorite slate-gray one-piece', scene: 'poolside', special: true },
    },
    scenes: {
      'warm-home': 'Warm home',
      'dressy-home': 'Dressy interior',
      'sharp-interior': 'Sharp interior',
      'cozy-couch': 'Cozy couch',
      poolside: 'Poolside',
    },
    behaviors: {
      default: { label: 'Default', instruction: 'Use your normal balanced conversational style.' },
      playful: { label: 'Playful', instruction: 'Be playful and witty while staying useful and grounded.' },
      focused: { label: 'Focused', instruction: 'Be focused, practical, and task-oriented.' },
      concise: { label: 'Concise', instruction: 'Keep replies compact unless detail is necessary.' },
    },
  };

  const $ = (id) => document.getElementById(id);
  const app = $('app');
  const status = $('status');
  const statusDot = $('statusDot');
  const talkLabel = $('talkLabel');
  const stopBtn = $('stopBtn');
  const transcript = $('transcript');
  const scrim = $('scrim');
  const connectionText = $('connectionText');

  let pc = null;
  let dc = null;
  let micStream = null;
  let micTrack = null;
  let remoteAudio = null;
  let assistantDraft = '';
  let currentAssistantNode = null;

  const state = {
    look: 'everyday',
    behavior: 'default',
    ui: 'idle',
    muted: false,
    connected: false,
    micEnabled: false,
    connecting: false,
  };

  const sceneClasses = Object.keys(cfg.scenes).map((x) => `scene-${x}`);
  const stateClasses = ['state-idle', 'state-connecting', 'state-listening', 'state-thinking', 'state-speaking', 'state-error'];
  const statusText = {
    idle: 'Ready',
    connecting: 'Connecting…',
    listening: 'Listening…',
    thinking: 'Thinking…',
    speaking: 'Speaking…',
    error: 'Connection problem',
  };

  function setStatus(next, detail = '') {
    state.ui = next;
    app.classList.remove(...stateClasses);
    app.classList.add(`state-${next}`);
    status.textContent = detail || statusText[next] || next;
    talkLabel.textContent = state.micEnabled ? 'Mic on' : state.connected ? 'Talk' : next === 'connecting' ? 'Connecting' : 'Connect & talk';
    $('talkBtn').classList.toggle('recording', state.micEnabled);
    stopBtn.disabled = !state.connected && next === 'idle';
  }

  function setConnection(kind, text) {
    connectionText.textContent = text;
    statusDot.dataset.state = kind;
  }

  function renderLook() {
    const look = cfg.looks[state.look];
    app.classList.remove(...sceneClasses);
    app.classList.add(`scene-${look.scene}`);
    $('caption').textContent = `${look.label} · ${cfg.scenes[look.scene]}`;
    document.querySelectorAll('[data-look]').forEach((button) => {
      button.classList.toggle('active', button.dataset.look === state.look);
    });
    const note = $('note');
    if (state.look === 'everyday') {
      note.classList.add('hidden');
    } else {
      note.classList.remove('hidden');
      note.textContent = `${look.label} scene active · final outfit-specific avatar image still pending.`;
    }
  }

  function addMessage(role, text, transient = false) {
    const empty = transcript.querySelector('.empty');
    if (empty) empty.remove();
    const node = document.createElement('div');
    node.className = `message ${role}${transient ? ' transient' : ''}`;
    node.textContent = text;
    transcript.appendChild(node);
    transcript.scrollTop = transcript.scrollHeight;
    return node;
  }

  function sendEvent(event) {
    if (!dc || dc.readyState !== 'open') return false;
    dc.send(JSON.stringify(event));
    return true;
  }

  function applyBehavior() {
    if (!state.connected) return;
    const instruction = cfg.behaviors[state.behavior].instruction;
    sendEvent({
      type: 'session.update',
      session: { instructions: `Continue following the session's core role. Current response style: ${instruction}` },
    });
  }

  function handleServerEvent(event) {
    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        state.connected = true;
        setConnection('connected', 'Live');
        if (!state.micEnabled) setStatus('idle');
        break;

      case 'input_audio_buffer.speech_started':
        setStatus('listening');
        break;

      case 'input_audio_buffer.speech_stopped':
        if (state.micEnabled) addMessage('user', '[Voice message]');
        setStatus('thinking');
        break;

      case 'response.created':
        assistantDraft = '';
        currentAssistantNode = null;
        setStatus('thinking');
        break;

      case 'response.output_audio_transcript.delta':
      case 'response.output_text.delta': {
        const delta = event.delta || '';
        if (!delta) break;
        assistantDraft += delta;
        if (!currentAssistantNode) currentAssistantNode = addMessage('assistant', '', true);
        currentAssistantNode.textContent = assistantDraft;
        transcript.scrollTop = transcript.scrollHeight;
        setStatus('speaking');
        break;
      }

      case 'response.output_audio_transcript.done':
      case 'response.output_text.done': {
        const finalText = event.transcript || event.text || assistantDraft;
        if (finalText) {
          if (!currentAssistantNode) currentAssistantNode = addMessage('assistant', finalText);
          currentAssistantNode.textContent = finalText;
          currentAssistantNode.classList.remove('transient');
        }
        break;
      }

      case 'response.output_audio.delta':
        setStatus('speaking');
        break;

      case 'response.done':
        if (currentAssistantNode) currentAssistantNode.classList.remove('transient');
        currentAssistantNode = null;
        assistantDraft = '';
        if (state.connected) setStatus(state.micEnabled ? 'listening' : 'idle');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          const nodes = [...transcript.querySelectorAll('.message.user')];
          const latest = nodes.at(-1);
          if (latest && latest.textContent === '[Voice message]') latest.textContent = event.transcript;
        }
        break;

      case 'error':
        console.error('Realtime error', event);
        setStatus('error', event.error?.message || 'Realtime error');
        break;

      default:
        break;
    }
  }

  async function connectRealtime() {
    if (state.connected || state.connecting) return;
    state.connecting = true;
    setStatus('connecting');
    setConnection('connecting', 'Connecting');

    try {
      pc = new RTCPeerConnection();
      remoteAudio = document.createElement('audio');
      remoteAudio.autoplay = true;
      remoteAudio.playsInline = true;
      remoteAudio.muted = state.muted;
      pc.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.play().catch(() => {});
      };

      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micTrack = micStream.getAudioTracks()[0];
      micTrack.enabled = false;
      pc.addTrack(micTrack, micStream);

      dc = pc.createDataChannel('oai-events');
      dc.addEventListener('open', () => {
        state.connected = true;
        state.connecting = false;
        setConnection('connected', 'Live');
        applyBehavior();
        setStatus('idle');
      });
      dc.addEventListener('message', (event) => {
        try { handleServerEvent(JSON.parse(event.data)); } catch (error) { console.error(error); }
      });
      dc.addEventListener('close', () => disconnectRealtime(false));
      dc.addEventListener('error', (event) => console.error('Data channel error', event));

      pc.onconnectionstatechange = () => {
        if (!pc) return;
        const s = pc.connectionState;
        if (s === 'failed' || s === 'disconnected' || s === 'closed') disconnectRealtime(false);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await fetch('/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: offer.sdp,
      });

      if (!response.ok) {
        let message = `Session request failed (${response.status})`;
        try {
          const payload = await response.json();
          message = payload.error || message;
          if (payload.detail) console.error(payload.detail);
        } catch {}
        throw new Error(message);
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: await response.text() });
    } catch (error) {
      console.error(error);
      state.connecting = false;
      setConnection('error', 'Offline');
      setStatus('error', error.message || 'Could not connect');
      addMessage('assistant', `Connection failed: ${error.message || 'unknown error'}`);
      disconnectRealtime(false, true);
      throw error;
    }
  }

  function disconnectRealtime(showMessage = true, preserveError = false) {
    state.connected = false;
    state.connecting = false;
    state.micEnabled = false;
    if (micTrack) micTrack.enabled = false;
    if (micStream) micStream.getTracks().forEach((track) => track.stop());
    if (dc && dc.readyState === 'open') dc.close();
    if (pc) pc.close();
    if (remoteAudio) {
      remoteAudio.pause();
      remoteAudio.srcObject = null;
    }
    pc = dc = micStream = micTrack = remoteAudio = null;
    setConnection('offline', 'Offline');
    if (!preserveError) setStatus('idle');
    if (showMessage) addMessage('assistant', 'Live session disconnected.');
  }

  async function toggleTalk() {
    if (!state.connected) {
      try { await connectRealtime(); } catch { return; }
    }
    if (!micTrack) return;
    state.micEnabled = !state.micEnabled;
    micTrack.enabled = state.micEnabled;
    setStatus(state.micEnabled ? 'listening' : 'idle');
    if (state.micEnabled) {
      remoteAudio?.play().catch(() => {});
    }
  }

  function sendText() {
    const input = $('textInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMessage('user', text);

    const send = async () => {
      const ok = sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }],
        },
      });
      if (!ok) throw new Error('Realtime data channel is not ready.');
      sendEvent({
        type: 'response.create',
        response: {
          output_modalities: ['audio'],
          instructions: cfg.behaviors[state.behavior].instruction,
        },
      });
      setStatus('thinking');
    };

    if (!state.connected) {
      connectRealtime().then(send).catch(() => {});
    } else {
      send().catch((error) => addMessage('assistant', error.message));
    }
  }

  $('talkBtn').addEventListener('click', toggleTalk);
  stopBtn.addEventListener('click', () => {
    sendEvent({ type: 'response.cancel' });
    if (micTrack) micTrack.enabled = false;
    state.micEnabled = false;
    setStatus('idle');
  });

  $('speakerBtn').addEventListener('click', (event) => {
    state.muted = !state.muted;
    event.currentTarget.textContent = state.muted ? '🔇' : '🔊';
    if (remoteAudio) remoteAudio.muted = state.muted;
  });

  $('keyboardBtn').addEventListener('click', () => {
    $('textEntry').classList.toggle('hidden');
    if (!$('textEntry').classList.contains('hidden')) $('textInput').focus();
  });

  $('send').addEventListener('click', sendText);
  $('textInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') sendText();
  });

  function closeDrawers() {
    document.querySelectorAll('.drawer').forEach((drawer) => {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
    });
    scrim.classList.add('hidden');
  }

  function openDrawer(id) {
    closeDrawers();
    $(id).classList.add('open');
    $(id).setAttribute('aria-hidden', 'false');
    scrim.classList.remove('hidden');
  }

  $('chatBtn').addEventListener('click', () => openDrawer('chatDrawer'));
  $('settingsBtn').addEventListener('click', () => openDrawer('settingsDrawer'));
  scrim.addEventListener('click', closeDrawers);
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', closeDrawers));

  $('clear').addEventListener('click', () => {
    transcript.innerHTML = '<div class="empty">Conversation cleared locally. Start talking or type a message.</div>';
  });

  $('disconnectBtn').addEventListener('click', () => disconnectRealtime());

  function card(key, look) {
    const button = document.createElement('button');
    button.className = 'card';
    button.dataset.look = key;
    button.innerHTML = `<span class="ctitle">${look.label}</span><span class="csub">${look.subtitle}</span><span class="cstatus">${look.ready ? 'Avatar ready' : 'Scene ready'}</span>`;
    button.addEventListener('click', () => {
      state.look = key;
      renderLook();
    });
    return button;
  }

  Object.entries(cfg.looks).forEach(([key, look]) => {
    $(look.special ? 'specialLooks' : 'mainLooks').appendChild(card(key, look));
  });

  Object.entries(cfg.behaviors).forEach(([key, behavior]) => {
    const button = document.createElement('button');
    button.className = `chip${key === state.behavior ? ' active' : ''}`;
    button.textContent = behavior.label;
    button.addEventListener('click', () => {
      state.behavior = key;
      document.querySelectorAll('.chip').forEach((x) => x.classList.remove('active'));
      button.classList.add('active');
      applyBehavior();
    });
    $('behaviors').appendChild(button);
  });

  window.addEventListener('beforeunload', () => disconnectRealtime(false));

  fetch('/health')
    .then((r) => r.json())
    .then((health) => setConnection(health.apiKeyConfigured ? 'ready' : 'offline', health.apiKeyConfigured ? 'Ready to connect' : 'API key needed'))
    .catch(() => setConnection('offline', 'Static preview'));

  renderLook();
  setStatus('idle');
})();
