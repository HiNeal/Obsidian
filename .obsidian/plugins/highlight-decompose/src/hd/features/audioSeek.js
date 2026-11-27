const { setIcon } = require("obsidian");

function seekAudio(audio, seconds) {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
  audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
}
class AudioSeekMethods {
  setupAudioSeek() {
    let lastAudio = null;
    let lastSource = null;
    let lastContainer = null;
    let lastAudioParent = null;
    let wantsPlayback = false;
    let recoveringAudio = false;
    let lastPosition = 0;
    let audioKeyboardActive = false;
    const audioDock = document.createElement('div');
    audioDock.hidden = true;
    document.body.appendChild(audioDock);
    this.audioControlDiagnostics = {};
    this.audioControlTarget = () => targetAudio();
    const isNoteAudio = audio => audio?.matches?.('.workspace-leaf-content audio[controls]');
    const remember = audio => {
      if (audio === lastAudio) return audio;
      if (lastAudio?.parentElement === audioDock) {
        lastAudio.pause();
        lastAudio.remove();
      }
      wantsPlayback = !audio.paused && !audio.ended;
      lastPosition = audio.currentTime || 0;
      lastAudio = audio;
      lastAudioParent = audio.parentElement;
      lastSource = audio.getAttribute('src');
      lastContainer = audio.closest('.workspace-leaf-content');
      watchAudio(audio);
      return audio;
    };
    const targetAudio = () => {
      if (lastAudio && !lastAudio.paused && !lastAudio.ended) return lastAudio;
      const all = [...document.querySelectorAll('.workspace-leaf-content audio[controls]')];
      const playing = all.filter(a => !a.paused && !a.ended);
      if (playing.length) return remember(playing.includes(lastAudio) ? lastAudio : playing[0]);
      if (lastAudio?.isConnected) return lastAudio;
      const replacement = all.find(a => a.getAttribute('src') === lastSource && a.closest('.workspace-leaf-content') === lastContainer);
      if (replacement) {
        // CodeMirror 重建播放器时保留暂停位置, 不把进度重置到开头。
        if (lastAudio && replacement !== lastAudio && lastAudio.currentTime > 0 && replacement.currentTime === 0) {
          const position = lastAudio.currentTime;
          if (replacement.readyState >= 1) replacement.currentTime = position;
          else replacement.addEventListener('loadedmetadata', () => {
            if (replacement.currentTime === 0) replacement.currentTime = Math.min(position, replacement.duration || position);
          }, { once: true });
        }
        return remember(replacement);
      }
      // 实时预览编辑/滚动会卸载媒体 DOM, 音频对象仍可正常播放与定位。
      if (lastAudio?.getAttribute('src')) return lastAudio;
      const active = this.app.workspace.getMostRecentLeaf?.()?.view?.containerEl;
      const audio = active?.querySelector('audio[controls]');
      return audio ? remember(audio) : null;
    };
    const play = () => targetAudio()?.play().catch(error => console.error('[HighlightDecompose] Audio playback failed', error));
    const pause = () => { wantsPlayback = false; targetAudio()?.pause(); };
    const togglePlayback = () => {
      const audio = targetAudio();
      if (audio) audio.paused ? play() : pause();
    };
    const seek = seconds => { const audio = targetAudio(); if (audio) { seekAudio(audio, seconds); syncSession(audio); } };
    const floating = document.createElement('div');
    floating.className = 'hd-floating-audio';
    floating.setAttribute('role', 'region');
    floating.setAttribute('aria-label', '悬浮音频播放器');
    floating.hidden = true;
    const button = (label, icon, action) => {
      const el = document.createElement('button');
      el.type = 'button';
      setIcon(el, icon);
      this.registerDomEvent(el, 'click', () => { action(); renderFloating(); });
      floating.appendChild(el);
      return el;
    };
    button('后退', 'rotate-ccw', () => seek(-5));
    const toggle = button('播放', 'play', togglePlayback);
    toggle.classList.add('hd-floating-audio-toggle');
    button('前进', 'rotate-cw', () => seek(5));
    const progress = document.createElement('input');
    progress.type = 'range';
    progress.min = '0';
    progress.step = '0.1';
    floating.appendChild(progress);
    const time = document.createElement('span');
    time.className = 'hd-floating-audio-time';
    floating.appendChild(time);
    const formatTime = value => {
      const seconds = Math.floor(Number.isFinite(value) ? value : 0);
      return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    };
    const positionFloating = () => {
      if (!lastContainer?.isConnected) return;
      // 直接锚定文章窗格, 避免窗口坐标与 Obsidian 缩放后的 CSS 坐标混用。
      if (floating.parentElement !== lastContainer) lastContainer.appendChild(floating);
      floating.style.setProperty('--hd-audio-pane-width', `${Math.max(0, lastContainer.clientWidth - 32)}px`);
    };
    const paneObserver = new ResizeObserver(positionFloating);
    let observedPane = null;
    const renderFloating = () => {
      const audio = lastAudio;
      floating.hidden = !audio || !lastContainer?.isConnected;
      if (floating.hidden) return;
      if (observedPane !== lastContainer) {
        paneObserver.disconnect();
        paneObserver.observe(lastContainer);
        observedPane = lastContainer;
      }
      positionFloating();
      const playing = !audio.paused && !audio.ended;
      const icon = playing ? 'pause' : 'play';
      if (toggle.dataset.icon !== icon) {
        setIcon(toggle, icon);
        toggle.dataset.icon = icon;
      }
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      progress.disabled = duration <= 0;
      progress.max = String(duration || 1);
      progress.value = String(audio.currentTime || 0);
      time.textContent = `${formatTime(audio.currentTime)} / ${formatTime(duration)}`;
    };
    this.registerDomEvent(progress, 'input', () => {
      const audio = targetAudio();
      if (audio && Number.isFinite(audio.duration)) {
        audio.currentTime = Math.max(0, Math.min(audio.duration, Number(progress.value)));
        syncSession(audio);
        renderFloating();
      }
    });
    document.body.appendChild(floating);
    this.registerDomEvent(window, 'resize', positionFloating);
    this.registerEvent(this.app.workspace.on('layout-change', positionFloating));
    this.registerEvent(this.app.workspace.on('resize', positionFloating));
    for (const [id, name, run] of [
      ['audio-rewind-5s', '音频后退 5 秒', () => seek(-5)],
      ['audio-toggle-playback', '音频暂停 / 继续', togglePlayback],
      ['audio-forward-5s', '音频前进 5 秒', () => seek(5)],
    ]) this.addCommand({ id, name, checkCallback: checking => {
      if (!targetAudio()) return false;
      if (!checking) run();
      return true;
    } });
    // 使用单一键盘入口, 不再同时注册默认快捷键, 避免一次触发两遍。
    this.registerDomEvent(window, 'keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing) return;
      const key = ({ MediaTrackPrevious: 'F7', MediaTrackNext: 'F9', MediaPlayPause: 'F8', AudioTrackPrevious: 'F7', AudioTrackNext: 'F9' })[event.key] || event.key;
      const localKey = [' ', 'ArrowLeft', 'ArrowRight'].includes(key);
      if (localKey && (!audioKeyboardActive || !lastContainer?.isConnected || floating.hidden)) return;
      if (!localKey && !['F7', 'F8', 'F9'].includes(key)) return;
      if (!targetAudio()) return;
      this.audioControlDiagnostics.lastKey = event.key;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (key === 'F8' || key === ' ') { if (!event.repeat) togglePlayback(); }
      else seek(key === 'F7' || key === 'ArrowLeft' ? -5 : 5);
    }, true);
    // Mac 媒体键通过系统媒体会话接入, 不要求焦点位于播放器。
    const session = navigator.mediaSession;
    const handlers = { previoustrack: () => seek(-5), nexttrack: () => seek(5),
      seekbackward: () => seek(-5), seekforward: () => seek(5), play, pause,
      seekto: detail => { const audio = targetAudio(); if (audio && Number.isFinite(detail.seekTime)) { audio.currentTime = Math.max(0, Math.min(audio.duration, detail.seekTime)); syncSession(audio); } } };
    let bound = false;
    const bind = () => {
      if (!session) return;
      for (const [action, handler] of Object.entries(handlers)) {
        try { session.setActionHandler(action, detail => { this.audioControlDiagnostics.lastAction = action; handler(detail); }); } catch (_) {}
      }
      bound = true;
    };
    const watched = new Set();
    const syncSession = audio => {
      renderFloating();
      if (!session || !audio) return;
      session.playbackState = audio.paused ? 'paused' : 'playing';
      if (!session.metadata && typeof MediaMetadata !== 'undefined') {
        session.metadata = new MediaMetadata({ title: 'Obsidian 音频' });
      }
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        try { session.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.max(0, Math.min(audio.duration, audio.currentTime)) }); } catch (_) {}
      }
    };
    const onAudioState = event => {
      if (event.target !== lastAudio) return;
      if (event.type === 'play') wantsPlayback = true;
      if (event.type === 'pause' && event.target.isConnected && !recoveringAudio) wantsPlayback = false;
      if (event.type === 'ended') wantsPlayback = false;
      if (event.target.currentTime > 0) lastPosition = event.target.currentTime;
      syncSession(event.target);
      // 原生播放器及宿主可能在播放事件中重设媒体会话, 在其后恢复控制入口。
      if (event.type === 'play') { bind(); queueMicrotask(bind); }
    };
    const watchAudio = audio => {
      if (watched.has(audio)) return;
      watched.add(audio);
      for (const type of ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'durationchange']) audio.addEventListener(type, onAudioState);
    };
    this.registerDomEvent(document, 'play', event => {
      if (isNoteAudio(event.target)) { remember(event.target); syncSession(event.target); bind(); queueMicrotask(bind); }
    }, true);
    for (const type of ['pointerdown', 'focusin']) this.registerDomEvent(document, type, event => {
      const audio = event.composedPath().find(isNoteAudio);
      // 点击播放器后接管按键; 回到文章或其他区域立即交还原有快捷键。
      audioKeyboardActive = !!audio || event.composedPath().includes(floating);
      if (audio) { remember(audio); bind(); renderFloating(); }
    }, true);
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => { audioKeyboardActive = false; if (targetAudio()) bind(); renderFloating(); }));
    // 实时预览滚动会卸载播放器。将同一个媒体节点暂存到页面外的隐藏容器,
    // 回滚时再交还给新建的播放器位置, 进度与原生控件共用同一音频对象。
    const keepAudioAlive = () => {
      if (!lastAudio || !lastContainer?.isConnected) return;
      if (lastAudio.parentElement !== audioDock && lastAudio.parentElement) lastAudioParent = lastAudio.parentElement;
      if (!lastAudio.isConnected) {
        recoveringAudio = true;
        audioDock.appendChild(lastAudio);
        if (!lastAudio.getAttribute('src') && lastSource) lastAudio.setAttribute('src', lastSource);
        if (lastAudio.currentTime === 0 && lastPosition > 0) {
          const restore = () => { lastAudio.currentTime = Math.min(lastPosition, lastAudio.duration || lastPosition); };
          if (lastAudio.readyState >= 1) restore();
          else lastAudio.addEventListener('loadedmetadata', restore, { once: true });
        }
        if (wantsPlayback && lastAudio.paused && !lastAudio.ended) {
          lastAudio.play().catch(error => console.error('[HighlightDecompose] Audio recovery failed', error))
            .finally(() => { recoveringAudio = false; });
        } else recoveringAudio = false;
      }
      if (lastAudio.parentElement === audioDock && lastAudioParent?.isConnected) {
        lastAudioParent.appendChild(lastAudio);
      }
      if (lastAudio.parentElement === audioDock) {
        const replacement = [...lastContainer.querySelectorAll('audio[controls]')]
          .find(audio => audio !== lastAudio && audio.getAttribute('src') === lastSource);
        if (replacement) { lastAudioParent = replacement.parentElement; replacement.replaceWith(lastAudio); }
      }
    };
    const audioObserver = new MutationObserver(records => {
      if (records.every(record => floating.contains(record.target))) return;
      keepAudioAlive();
      // 仅在显隐改变时刷新, 避免时间文字触发观察器循环。
      const hidden = !lastAudio || !lastContainer?.isConnected;
      if (floating.hidden !== hidden) renderFloating();
    });
    audioObserver.observe(document.body, { childList: true, subtree: true });
    const initialAudio = targetAudio();
    if (initialAudio) { bind(); syncSession(initialAudio); }
    this.register(() => {
      audioObserver.disconnect();
      paneObserver.disconnect();
      floating.remove();
      if (lastAudio?.parentElement === audioDock) {
        lastAudio.pause();
        // 重载时还原宿主持有的嵌入节点, 包括暂时被编辑器卸载的容器。
        if (lastAudioParent) lastAudioParent.appendChild(lastAudio);
      }
      audioDock.remove();
      for (const audio of watched) for (const type of ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'durationchange']) audio.removeEventListener(type, onAudioState);
      if (!bound) return;
      for (const action of Object.keys(handlers)) {
        try { session.setActionHandler(action, null); } catch (_) {}
      }
    });
  }
}
module.exports = { AudioSeekMethods, seekAudio };
