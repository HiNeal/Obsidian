// 录音: 只播放 20. resource/<笔记路径>/audio/ 里已有的文件。缺失或损坏就跳过, 不合成语音, 不朗读释义。
// 目录清单每个卡组只列一次 (vault.adapter.list, 桌面与手机都可用), 之后的查找全在内存里。

const { AUDIO_ROOT, AUDIO_EXTENSIONS, LISTENING_CENTRAL, AUDIO_ITEM_TIMEOUT } = require("./constants");
const { slugVariants } = require("./text");

const key = (name) => name.normalize("NFC").toLowerCase();

class AudioLibrary {
  constructor(app) {
    this.app = app;
    this.listings = new Map(); // dir -> Promise<Map<小写文件名, vault 路径>>
  }

  clear() { this.listings.clear(); }

  list(dir) {
    if (!this.listings.has(dir)) this.listings.set(dir, this.readDir(dir));
    return this.listings.get(dir);
  }

  async readDir(dir) {
    const files = new Map();
    try {
      const adapter = this.app.vault.adapter;
      if (!(await adapter.exists(dir))) return files;
      for (const path of (await adapter.list(dir)).files) {
        const name = path.split("/").pop();
        if (AUDIO_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))) files.set(key(name), path);
      }
    } catch (e) { /* 读不到就当没有音频 */ }
    return files;
  }

  /** 笔记路径 → 音频目录。集中听力词块按行来源; 阅读笔记额外试去掉 (Cxx-Test x-Passage x) 的标题。 */
  directoriesFor(deckPath, card) {
    let note = deckPath;
    if (card.source) note = card.source;
    else if (LISTENING_CENTRAL.test(deckPath) && card.h1 && card.h1 !== "音义词块") note = `05. listening/${card.h1}.md`;
    const rel = note.replace(/\.md$/i, "");
    const dirs = [`${AUDIO_ROOT}/${rel}/audio`];
    if (/^(06\. reading|10\. practice\/reading)\//.test(rel)) {
      const clean = rel.replace(/\s+\([^/]*\)$/, "");
      if (clean !== rel) dirs.push(`${AUDIO_ROOT}/${clean}/audio`);
    }
    return dirs;
  }

  async find(dirs, text) {
    const slugs = slugVariants(text);
    for (const dir of dirs) {
      const files = await this.list(dir);
      if (!files.size) continue;
      for (const slug of slugs) {
        // 单词录音优先; 短语词条的录音按 chunk_ 命名, 作为后备
        const bases = [slug, `chunk_${slug}`, `cs_${slug}`];
        for (const base of bases) {
          for (const ext of AUDIO_EXTENSIONS) {
            const hit = files.get(key(base + ext));
            if (hit) return hit;
          }
        }
      }
    }
    return null;
  }

  /** 只播单词本身的录音。返回可直接给 <audio> 的资源地址, 没有录音时为空数组。 */
  async urlsFor(deckPath, card) {
    const path = await this.find(this.directoriesFor(deckPath, card), card.word);
    return path ? [this.app.vault.adapter.getResourcePath(path)] : [];
  }
}

class Player {
  constructor() {
    this.audio = null;
    this.generation = 0;
    this.abort = null;
  }

  stop() {
    this.generation++;
    if (this.abort) { this.abort(); this.abort = null; }
    this.release();
  }

  /** 去掉 src 后必须 load() 一次, 媒体元素才会真正丢掉已缓冲的数据和解码器。 */
  release() {
    const audio = this.audio;
    this.audio = null;
    if (!audio) return;
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    } catch (e) { /* 已释放 */ }
  }

  /** 依次播放; 全部结束 (坏文件跳过) 返回 true, 被 stop() 打断返回 false。 */
  async play(urls) {
    this.stop();
    const generation = this.generation;
    for (const url of urls) {
      if (generation !== this.generation) return false;
      await this.playOne(url);
    }
    return generation === this.generation;
  }

  playOne(url) {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      let timer = null;
      const finish = () => {
        clearTimeout(timer);
        audio.onended = audio.onerror = null;
        if (this.abort === finish) this.abort = null;
        if (this.audio === audio) this.release(); // 播完也释放, 不留着上一条录音
        resolve();
      };
      timer = setTimeout(finish, AUDIO_ITEM_TIMEOUT);
      audio.onended = finish;
      audio.onerror = finish;
      this.audio = audio;
      this.abort = finish;
      audio.play().catch(finish);
    });
  }
}

module.exports = { AudioLibrary, Player };
