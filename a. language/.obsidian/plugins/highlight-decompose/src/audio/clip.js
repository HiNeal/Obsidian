const { getSettings } = require("./settings");

function applyPlaybackRate(audio) {
  const rate = Number(getSettings().playbackRate) || 1;
  if (rate > 0 && rate !== 1) audio.playbackRate = rate;
}

function prepareClip(plugin, path) {
  const audio = new Audio(plugin.app.vault.adapter.getResourcePath(path));
  audio.preload = "auto";
  applyPlaybackRate(audio);
  try { audio.load(); } catch (e) {}
  return { path, audio, blobUrl: null };
}

// 预取用：构造失败不应打断播放，返回 null 让调用方走常规路径。
function prepareClipSafe(plugin, path) {
  try {
    return prepareClip(plugin, path);
  } catch (err) {
    console.error("[TableSound] 预取失败:", path, err);
    return null;
  }
}

async function prepareClipViaBlob(plugin, path) {
  const arrayBuffer = await plugin.app.vault.adapter.readBinary(path);
  const blobUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: "audio/mpeg" }));
  plugin.currentBlobUrl = blobUrl;
  const audio = new Audio(blobUrl);
  applyPlaybackRate(audio);
  return { path, audio, blobUrl };
}

function releaseClip(plugin, clip) {
  if (!clip) return;
  if (clip.blobUrl) {
    try { URL.revokeObjectURL(clip.blobUrl); } catch (e) {}
    if (plugin.currentBlobUrl === clip.blobUrl) plugin.currentBlobUrl = null;
  }
  if (plugin.currentPlayingAudio === clip.audio) plugin.currentPlayingAudio = null;
  // 中止仍在进行的缓冲并释放已缓存数据（预取后未被播放的片段尤其需要）。
  try {
    clip.audio.pause();
    clip.audio.removeAttribute("src");
    clip.audio.load();
  } catch (e) {}
}

// 等待一条音频结束，返回 "ended" | "error" | "aborted"。
// stopCurrentAudio() 通过 currentPlaybackResolve 主动兑现，
// 避免它摘掉事件处理器之后等待方永远醒不过来。
function awaitClipPlayback(plugin, audio, isStillCurrent) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      audio.onended = null;
      audio.onerror = null;
      audio.onpause = null;
      if (plugin.currentPlaybackResolve === abort) plugin.currentPlaybackResolve = null;
      resolve(outcome);
    };
    const abort = () => finish("aborted");

    plugin.currentPlaybackResolve = abort;
    audio.onended = () => finish("ended");
    audio.onerror = () => {
      const code = audio.error ? audio.error.code : "unknown";
      console.error("[TableSound] 音频加载/解码失败, code:", code);
      finish("error");
    };
    audio.onpause = () => { if (!isStillCurrent()) finish("aborted"); };
    audio.play().catch(() => finish("error"));
  });
}

// 播放一条音频。prepared 可以是 prepareClip() 预取好的片段。
// 资源地址播放失败时，回落到 Blob 再试一次，保证不会因路径编码问题彻底放不出声。
async function playClip(plugin, path, isStillCurrent, prepared) {
  if (!isStillCurrent()) {
    releaseClip(plugin, prepared);
    return "aborted";
  }

  const clip = prepared || prepareClipSafe(plugin, path);
  if (clip) {
    plugin.currentPlayingAudio = clip.audio;
    const outcome = await awaitClipPlayback(plugin, clip.audio, isStillCurrent);
    releaseClip(plugin, clip);
    if (outcome !== "error") return outcome;
    console.warn("[TableSound] 资源地址播放失败，回落到 Blob 重试:", path);
  }

  if (!isStillCurrent()) return "aborted";
  let fallback = null;
  try {
    fallback = await prepareClipViaBlob(plugin, path);
  } catch (err) {
    console.error("[TableSound] 读取音频失败:", path, err);
    return "error";
  }
  if (!isStillCurrent()) {
    releaseClip(plugin, fallback);
    return "aborted";
  }

  plugin.currentPlayingAudio = fallback.audio;
  const outcome = await awaitClipPlayback(plugin, fallback.audio, isStillCurrent);
  releaseClip(plugin, fallback);
  return outcome;
}

module.exports = { applyPlaybackRate, prepareClip, prepareClipSafe, prepareClipViaBlob, releaseClip, awaitClipPlayback, playClip };
