/* [Vendored: github.com/fr0stb1rd/antalia-mini-web @ main, Apache-2.0 — bkz. ./NOTICE; ES modülüne çevrildi]
 * Antalia-2 Mini — tarayici ses son-isleme (PatientDesk AI, Apache-2.0).
 *
 * ORIJINAL: antalia_mini/post.py OutputChain (tone yolu) + api.py _pause.
 * Varsayilan release config'inde tone=[6.0,-9.0] oldugu icin gercek yol:
 *   lowshelf(210 Hz, +6 dB) -> highshelf(4 kHz, -9 dB) -> soft limiter
 * (make-up gain 0.0 dB = 1.0; resample 48k->48k = identity).
 * Katsayilar post.py RBJ formullerinden 16 ondalikla uretildi; Biquad
 * post.py lfilter ile ayni direct-form IIR'dir, filtre nesneleri parcalar
 * arasi tasinir (StreamFIR ile ayni: parca parca = butun ayni ornekler).
 *
 * KULLANIM (tarayici): <script src="audio.js"></script> (app.js'ten once)
 * KULLANIM (Node/test): const AntaliaAudio = require("./audio.js");
 */

const AntaliaAudio = (() => {
  // post.py: lowshelf(EQ_SHELF_HZ=210, +6dB [tone[0]], Q=0.707, fs=48000)
  const TONE_LOW = {
    b0: 1.0067698504364737, b1: -1.9670261142112211, b2: 0.9613064506769197,
    a1: -1.9672880375281616, a2: 0.9678143777964527,
  };
  // post.py: highshelf(4000.0, -9dB [tone[1]], Q=0.707, fs=48000)
  const TONE_HIGH = {
    b0: 0.4282380647227790, b1: -0.4673907653709056, b2: 0.1672663299532398,
    a1: -1.4337659737473694, a2: 0.5618796030524825,
  };
  // post.py: LIMIT_THRESHOLD (-1 dBFS) / LIMIT_CEILING (-0.1 dBFS)
  const LIMIT_THRESH = Math.pow(10, -1.0 / 20);
  const LIMIT_CEIL = Math.pow(10, -0.1 / 20);
  const LIMIT_ROOM = LIMIT_CEIL - LIMIT_THRESH;

  class Biquad {
    // post.py lfilter ile ayni: direct-form, durum nesnede tasinir.
    constructor(c) {
      this.b0 = c.b0; this.b1 = c.b1; this.b2 = c.b2;
      this.a1 = c.a1; this.a2 = c.a2;
      this.x1 = 0; this.x2 = 0;
      this.y1 = 0; this.y2 = 0;
    }
    process(x) {
      const y = new Float32Array(x.length);
      let { b0, b1, b2, a1, a2, x1, x2, y1, y2 } = this;
      for (let i = 0; i < x.length; i++) {
        const v = x[i];
        const out = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = v;
        y2 = y1; y1 = out;
        y[i] = out;
      }
      this.x1 = x1; this.x2 = x2;
      this.y1 = y1; this.y2 = y2;
      return y;
    }
  }

  function postProcessAudio(samples, low, high) {
    // post.py OutputChain.__call__ (tone yolu): fir -> soft_limit (gain 1.0).
    let s = low.process(samples);
    s = high.process(s);
    for (let i = 0; i < s.length; i++) {
      const v = s[i];
      const a = Math.abs(v);
      if (a > LIMIT_THRESH) {
        s[i] = Math.sign(v) * (LIMIT_THRESH + LIMIT_ROOM * Math.tanh((a - LIMIT_THRESH) / LIMIT_ROOM));
      }
    }
    return s;
  }

  function pauseSec(part) {
    // api.py _pause: cumle sonu 0.12 sn, diger 0.06 sn.
    const last = (part || "").trimEnd().slice(-1);
    return (last === "." || last === "?" || last === "!") ? 0.12 : 0.06;
  }

  return { TONE_LOW, TONE_HIGH, LIMIT_THRESH, LIMIT_CEIL, Biquad, postProcessAudio, pauseSec };
})();

export default AntaliaAudio;
