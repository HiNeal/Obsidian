const { AUDIO_ROOT, AUDIO_SUBDIR, VAULT_PREFIX } = require("./constants");
const { PHONEME_ALIASES, toSlug } = require("./extract");

function vaultPathExists(app, vaultPath) {
  if (!app || !app.vault || !vaultPath) return false;
  if (app.vault.getAbstractFileByPath(vaultPath)) return true;

  // MP3 files are deliberately excluded from the file explorer, so they do
  // not appear in Vault.getFiles(). Use the desktop adapter as a fallback.
  try {
    const adapter = app.vault.adapter;
    if (!adapter || typeof adapter.getFullPath !== "function") return false;
    return require("fs").existsSync(adapter.getFullPath(vaultPath));
  } catch (e) {
    return false;
  }
}

// 「源目录 => 音频目录」逐行映射
// 返回当前文章的音频目录：音频根目录 + 笔记完整相对路径，与文档目录 1:1 一致。
//   02. word/a. 雅思词汇真经/03-动物保护.md
// ➔ 20. resource/02. word/a. 雅思词汇真经/03-动物保护/audio/
function getArticleAudioDirectories(app, contextFile = null) {
  const activeFile = contextFile || (app && app.workspace && app.workspace.getActiveFile
    ? app.workspace.getActiveFile()
    : null);
  const activePath = typeof activeFile === "string" ? activeFile : (activeFile && activeFile.path ? activeFile.path : "");
  if (!activePath.toLowerCase().endsWith(".md")) return [];

  const vaultPrefix = activePath.startsWith(VAULT_PREFIX) ? VAULT_PREFIX : "";
  const articleRelPath = activePath.slice(vaultPrefix.length).replace(/\.md$/i, "");
  if (!articleRelPath) return [];

  const articlePaths = [articleRelPath];
  // Reading notes may carry the Cambridge/test tag in the filename while
  // their audio directory was generated from the clean article title, e.g.
  // `Roman shipbuilding and navigation (C16-Test 3-Passage 1).md` →
  // `Roman shipbuilding and navigation/`. Keep the exact path first, then
  // try the clean reading-title variant without weakening article isolation.
  if (articleRelPath.startsWith("06. reading/") || articleRelPath.startsWith("10. practice/reading/")) {
    const cleanArticlePath = articleRelPath.replace(/\s+\([^/]*\)$/, "");
    if (cleanArticlePath !== articleRelPath) articlePaths.push(cleanArticlePath);
  }

  return articlePaths.map((path) => `${vaultPrefix}${AUDIO_ROOT}/${path}/${AUDIO_SUBDIR}`);
}

function findAudioFilePath(app, targetWord, contextFile = null) {
  if (!targetWord) return null;

  // 没有活动的 .md 笔记就没有「这篇文章的音频目录」可言。
  // 按文章级隔离的约定，此时宁可报缺失，也不跨文章去捞同名音频。
  const articleAudioDirs = getArticleAudioDirectories(app, contextFile);
  if (!articleAudioDirs.length) return null;

  const exactSlug = toSlug(targetWord);
  const exactSlugNoPunct = targetWord.toLowerCase().trim()
    .replace(/[*_~`#'’`]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  const slugs = [exactSlug, exactSlugNoPunct];
  if (exactSlug.includes("_s_") || exactSlug.endsWith("_s")) {
    slugs.push(
      exactSlug.replace(/_s_/g, "_someone_s_").replace(/_s$/g, "_someone_s"),
      exactSlugNoPunct.replace(/_s_/g, "_someone_s_").replace(/_s$/g, "_someone_s")
    );
  }

  const articleCandidates = [...new Set(
    articleAudioDirs.flatMap((dir) =>
      slugs.flatMap((slug) => [
        `${dir}/${slug}.mp3`,
        `${dir}/${slug}.wav`,
        `${dir}/chunk_${slug}.mp3`,
        `${dir}/chunk_${slug}.wav`,
        `${dir}/cs_${slug}.mp3`,
        `${dir}/cs_${slug}.wav`,
        `${dir}/cs_chunk_${slug}.mp3`,
        `${dir}/cs_chunk_${slug}.wav`,
      ])
    )
  )];
  for (const candidate of articleCandidates) {
    if (vaultPathExists(app, candidate)) return candidate;
  }
  return null;
}

function findPhonemeAudioPath(app, phoneme, contextFile = null) {
  if (!phoneme) return null;
  const pClean = phoneme.trim().replace(/:/g, "ː");
  const aliases = PHONEME_ALIASES.get(pClean) || [pClean];
  if (!aliases.includes(pClean)) aliases.unshift(pClean);

  const articleAudioDirs = getArticleAudioDirectories(app, contextFile);
  const adapter = app && app.vault ? app.vault.adapter : null;
  const fs = require("fs");

  const searchSubDirs = [
    "",
    "01. 元音",
    "02. 辅音",
    "音标/01. 元音",
    "音标/02. 辅音",
    "音标"
  ];

  // 1. 优先在当前文章的音频目录及其子目录下查找（如 20. resource/01. base/a.phonemes/audio/）
  if (articleAudioDirs && articleAudioDirs.length && adapter) {
    try {
      for (const articleAudioDir of articleAudioDirs) {
        for (const sub of searchSubDirs) {
          const vaultDir = sub ? `${articleAudioDir}/${sub}` : articleAudioDir;
          const fullDir = adapter.getFullPath(vaultDir);
          if (!fs.existsSync(fullDir)) continue;
          const names = fs.readdirSync(fullDir);
          for (const name of names) {
            if (!name.toLowerCase().endsWith(".mp3")) continue;
            const basename = name.slice(0, -4);
            const pure = basename.replace(/^\d+[\.\-_\s]+/, "").trim();
            if (pure === pClean || aliases.includes(pure) || aliases.includes(pure.toLowerCase())) {
              return `${vaultDir}/${name}`;
            }
          }
        }
      }
    } catch (e) {}
  }

  // 自然拼读只使用本篇已同步的录音，缺失时不跨文章借用。
  if (articleAudioDirs.some((dir) => /\/01\. base\/d\.phonics\/audio$/i.test(`/${dir}`))) return null;

  // 2. 音标为全库公共基础音库：在当前文章未找到时，回退到全局音标目录
  if (adapter) {
    try {
      const globalPhonemeDirs = [
        `${VAULT_PREFIX}${AUDIO_ROOT}/01. base/a.phonemes/${AUDIO_SUBDIR}`,
        `${AUDIO_ROOT}/01. base/a.phonemes/${AUDIO_SUBDIR}`,
        "00. base/音标/01. 元音",
        "00. base/音标/02. 辅音",
        "00. base/音标"
      ];
      for (const gDir of globalPhonemeDirs) {
        const fullDir = adapter.getFullPath(gDir);
        if (!fs.existsSync(fullDir)) continue;
        const names = fs.readdirSync(fullDir);
        for (const name of names) {
          if (!name.toLowerCase().endsWith(".mp3")) continue;
          const basename = name.slice(0, -4);
          const pure = basename.replace(/^\d+[\.\-_\s]+/, "").trim();
          if (pure === pClean || aliases.includes(pure) || aliases.includes(pure.toLowerCase())) {
            return `${gDir}/${name}`;
          }
        }
      }
    } catch (e) {}
  }

  const files = getAudioFileIndex(app);

  // 3. 兜底：从文件索引中查找
  if (files && files.length) {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.extension === "mp3" && (f.path.includes("/01. base/a.phonemes/") || f.path.includes("/音标/"))) {
        const b = f.basename;
        const bPure = b.replace(/^\d+[\.\-\_\s]+/, "").trim();
        if (bPure === pClean || aliases.includes(b) || aliases.includes(bPure) || aliases.includes(bPure.toLowerCase())) {
          return f.path;
        }
      }
    }
  }

  return null;
}

// 音频索引缓存：库内有两万多个 mp3，每次点击都重扫全库并逐个 toLowerCase()
// 会造成明显启动延迟。这里只在库结构变化时重建一次。
let audioFileIndexCache = null;

function getAudioFileIndex(app) {
  if (audioFileIndexCache) return audioFileIndexCache;
  const entries = [];
  const all = app.vault.getFiles();
  for (let i = 0; i < all.length; i++) {
    const f = all[i];
    if (f.extension !== "mp3" && f.extension !== "wav") continue;
    entries.push({
      path: f.path,
      extension: f.extension,
      basename: f.basename,
      base: f.basename.toLowerCase(),  // 预先小写，避免每次查找重复分配字符串
    });
  }
  audioFileIndexCache = entries;
  return entries;
}

function invalidateAudioFileIndex() {
  audioFileIndexCache = null;
}

function findSentenceAudioPath(app, sentenceText, contextFile = null) {
  if (!sentenceText) return null;

  const articleAudioDirs = getArticleAudioDirectories(app, contextFile);
  if (!articleAudioDirs.length) return null;

  const sSlug = toSlug(sentenceText);
  const articleCandidates = articleAudioDirs.flatMap((dir) => [
    `${dir}/cs_${sSlug}.mp3`,
    `${dir}/${sSlug}.mp3`,
  ]);
  for (const candidate of articleCandidates) {
    if (vaultPathExists(app, candidate)) return candidate;
  }
  return null;
}

function findChunkAudioPath(app, chunkText, targetWord, contextFile = null) {
  if (!chunkText && !targetWord) return null;

  const articleAudioDirs = getArticleAudioDirectories(app, contextFile);
  if (!articleAudioDirs.length) return null;

  const rawTexts = [chunkText, targetWord].filter(Boolean);
  const slugs = [];
  for (const t of rawTexts) {
    const s = toSlug(t);
    if (!s) continue;
    slugs.push(s);
    if (s.includes("_s_") || s.endsWith("_s")) {
      slugs.push(s.replace(/_s_/g, "_someone_s_").replace(/_s$/g, "_someone_s"));
    }
  }

  const articleCandidates = [...new Set(
    articleAudioDirs.flatMap((dir) =>
      slugs.flatMap((sSlug) => [
        `${dir}/chunk_${sSlug}.mp3`,
        `${dir}/chunk_${sSlug}.wav`,
        `${dir}/cs_chunk_${sSlug}.mp3`,
        `${dir}/cs_chunk_${sSlug}.wav`,
        `${dir}/${sSlug}.mp3`,
        `${dir}/${sSlug}.wav`,
        `${dir}/cs_${sSlug}.mp3`,
        `${dir}/cs_${sSlug}.wav`,
      ])
    )
  )];
  for (const candidate of articleCandidates) {
    if (vaultPathExists(app, candidate)) return candidate;
  }
  return null;
}

module.exports = { vaultPathExists, getArticleAudioDirectories, findAudioFilePath, findPhonemeAudioPath, getAudioFileIndex, invalidateAudioFileIndex, findSentenceAudioPath, findChunkAudioPath };
