/* [Vendored: github.com/fr0stb1rd/antalia-mini-web @ main, Apache-2.0 — bkz. ./NOTICE; ES modülüne çevrildi]
 * Antalia-2 Mini — tarayici metin normalizer (PatientDesk AI, Apache-2.0).
 *
 * ORIJINAL: antalia_mini/text/normalize.py + antalia_mini/text/foreign.py +
 *           antalia_mini/text/__init__.py (turkish-tts @ 3ed2e60, birebir tasinmistir).
 * PYTHON SATIR REFERANSLARI [N:..] (normalize.py) / [F:..] (foreign.py) /
 * [I:..] (__init__.py) olarak isaretlidir; denetimde karsilastirin.
 *
 * KAPSAM VE SINIRLAR (bilincli tercihler):
 *  - normalize_for_asr_comparison / scoring / ctc_alignment PORT EDILMEDI:
 *    model cikti yolu degil (degerlendirme araclari), tarayicida kullanilmiyor.
 *  - CMU sozlugu (126k giris) tarayiciya GOMULMEDI. Bunun yerine:
 *      foreign_dict.json (80.328; export'ta is_english+respell on-hesabi),
 *      known_words.json  (6.276; known_in_turkish, esik 1000),
 *      english_i.json    (13.741; _english_i I-karari),
 *    setData() ile disaridan verilir (foreign_dict + foreign_parts + known_words
 *    + english_i). CamelCase PARCA cozumu sozlukler + LETTERS kurali ile Python
 *    ile aynidir; hicbir kaynakta olmayan parca null doner ve token oldugu gibi
 *    birakilir (Python da CMU disi parca icin None donerdi). Esitlik
 *    tests/fixtures.json uzerinde olculur.
 *
 * KULLANIM (tarayici, klasik script):
 *    <script src="normalize.js"></script>
 *    <script>AntaliaText.setData({foreign, known, englishI});</script>
 * KULLANIM (Node/test): const AntaliaText = require("./normalize.js");
 */

const AntaliaText = (() => {
  /* ---------- yardimcilar ---------- */
  // Python \b'nin birebir karsiligi (Python \w = unicode kelime karakteri;
  // JS \b yalnizca ASCII'dir, Turkce harflerde CALISMAZ).
  const B = "(?:(?<![\\p{L}\\p{N}_])(?=[\\p{L}\\p{N}_])|(?<=[\\p{L}\\p{N}_])(?![\\p{L}\\p{N}_]))";
  const WC = "\\p{L}\\p{N}_"; // Python \w'nun icerigi
  const W = `[${WC}]`;
  const L = "\\p{L}"; // Python [^\\W\\d_] (harf)
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Python re.IGNORECASE, i/I/i/I dordlusunu esit sayar (JS yalnizca ASCII).
  // "i" flag'li tum desenler R() ile kurulur; dordlu genisletilir.
  function R(src, flags) {
    // Sinif-icini bilen genisletme: [iu] -> [iIiu] (gecerli), iu disi -> [iIiu].
    if (!flags.includes("i")) return new RegExp(src, flags);
    let out = "", inClass = false, esc = false;
    const isQ = (c) => c === "i" || c === "I" || c === "\u0131" || c === "\u0130";
    for (let k = 0; k < src.length; k++) {
      const ch = src[k];
      if (esc) { out += "\\" + ch; esc = false; continue; }
      if (ch === "\\") {
        const m = src.slice(k).match(/^\\u013[01]/);
        if (m) { out += inClass ? "iI\u0131\u0130" : "[iI\u0131\u0130]"; k += m[0].length - 1; continue; }
        esc = true; continue; // tersbolge bir sonraki karakterle birlikte yazilir
      }
      if (ch === "[") { inClass = true; out += ch; continue; }
      if (ch === "]") { inClass = false; out += ch; continue; }
      if (isQ(ch)) { out += inClass ? "iI\u0131\u0130" : "[iI\u0131\u0130]"; continue; }
      out += ch;
    }
    return new RegExp(out, flags);
  }
  function list(s) { return [...s]; }
  const isUpperCase = (ch) => /\p{Lu}/u.test(ch);

  /* ---------- normalize.py tablolari ---------- */
  const ONES = ["sıfır", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"]; // [N:62]
  const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"]; // [N:63]
  const MONTHS = { 1: "ocak", 2: "şubat", 3: "mart", 4: "nisan", 5: "mayıs", 6: "haziran", 7: "temmuz", 8: "ağustos", 9: "eylül", 10: "ekim", 11: "kasım", 12: "aralık" }; // [N:64-77]
  // [N:78-127]
  const ABBREVIATIONS = {
    "dr.": "doktor", "prof.": "profesör", "vb.": "ve benzeri", "vs.": "vesaire",
    "örn.": "örneğin", "no.": "numara", "mg": "miligram", "kg": "kilogram",
    "gr": "gram", "km": "kilometre", "cm": "santimetre", "mm": "milimetre",
    "lt": "litre", "ml": "mililitre", "kb": "kilobayt", "mb": "megabayt",
    "gb": "gigabayt", "tb": "terabayt", "tl": "lira", "doç.": "doçent",
    "uzm.": "uzman", "op.": "operatör", "yrd.": "yardımcı",
    "öğr. üyesi": "öğretim üyesi", "öğr. gör.": "öğretim görevlisi",
    "dt.": "diş hekimi", "dyt.": "diyetisyen", "psk.": "psikolog",
    "fzt.": "fizyoterapist", "hemş.": "hemşire", "ecz.": "eczacı",
    "av.": "avukat", "müh.": "mühendis", "hz.": "hazreti", "bkz.": "bakınız",
    "vd.": "ve diğerleri", "mah.": "mahallesi", "cad.": "caddesi",
    "cd.": "caddesi", "sok.": "sokak", "sk.": "sokak", "bul.": "bulvarı",
    "blv.": "bulvarı", "apt.": "apartmanı", "ltd. şti.": "limited şirketi",
    "şti.": "şirketi",
  };
  const BEFORE_A_WORD = new Set(["doç.", "uzm.", "op.", "yrd.", "dt.", "dyt.", "psk.", "fzt.", "hemş.", "ecz.", "av.", "müh.", "hz.", "mah.", "cad.", "cd.", "sok.", "sk.", "bul.", "blv.", "apt."]); // [N:131-133]
  // [N:135-139]
  const NUMBER_UNITS = {
    "m": "metre", "g": "gram", "cc": "sisi", "mcg": "mikrogram", "μg": "mikrogram",
    "IU": "ünite", "kcal": "kilokalori", "mmHg": "milimetre cıva", "dk": "dakika",
    "sn": "saniye", "sa": "saat", "ms": "milisaniye", "dl": "desilitre",
  };
  const AREA_UNITS = { "m": "metre", "km": "kilometre", "cm": "santimetre" }; // [N:140]
  const ORDINAL_HEADS = "Dünya|Lig|Ordu|Kolordu|Tümen|Dönem|Meclis|Kurultay|Kongre|Uluslararası|Ulusal|Olağan|Olağanüstü|Geleneksel|Yıl|Yüzyıl|Sınıf|Kat|Blok|Etap|Bölge|Asliye|Ağır|Sulh|İcra|Aile|Selim|Murat|Murad|Mehmet|Mehmed|Mahmut|Mahmud|Ahmet|Ahmed|Osman|Bayezid|Beyazıt|Süleyman|Mustafa|Abdülhamid|Abdülmecid|Louis|Henry|Napolyon"; // [N:144-147]
  const WEEKDAYS = { "Pzt": "pazartesi", "Sal": "salı", "Çar": "çarşamba", "Per": "perşembe", "Cum": "cuma", "Cmt": "cumartesi", "Paz": "pazar" }; // [N:148-151]
  // [N:152-185]
  const LETTER_NAMES = {
    "A": "a", "B": "be", "C": "ce", "Ç": "çe", "D": "de", "E": "e", "F": "fe",
    "G": "ge", "Ğ": "yumuşak ge", "H": "he", "I": "ı", "İ": "i", "J": "je",
    "K": "ke", "L": "le", "M": "me", "N": "ne", "O": "o", "Ö": "ö", "P": "pe",
    "R": "re", "S": "se", "Ş": "şe", "T": "te", "U": "u", "Ü": "ü", "V": "ve",
    "Y": "ye", "Z": "ze", "Q": "kü", "W": "dabılyu", "X": "iks",
  };
  const INITIALISM_LETTERS = { ...LETTER_NAMES, "K": "ka", "I": "i" }; // [N:191]
  const ROMAN_VALUES = { "I": 1, "V": 5, "X": 10 }; // [N:193]
  // [N:194-217]
  const ORDINAL_EXCEPTIONS = {
    "bir": "birinci", "iki": "ikinci", "üç": "üçüncü", "dört": "dördüncü",
    "beş": "beşinci", "altı": "altıncı", "yedi": "yedinci", "sekiz": "sekizinci",
    "dokuz": "dokuzuncu", "on": "onuncu", "yirmi": "yirminci", "otuz": "otuzuncu",
    "kırk": "kırkıncı", "elli": "ellinci", "altmış": "altmışıncı",
    "yetmiş": "yetmişinci", "seksen": "sekseninci", "doksan": "doksanıncı",
    "yüz": "yüzüncü", "bin": "bininci", "milyon": "milyonuncu", "milyar": "milyarıncı",
  };
  // [N:29-41]
  const ADDRESS_WORDS = {
    "www": "dabılyu dabılyu dabılyu", "com": "kom", "net": "net", "org": "org",
    "gov": "gov", "info": "info", "gmail": "cimeyl", "hotmail": "hotmeyl",
    "outlook": "autluk", "yahoo": "yahu", "icloud": "ayklaud",
  };
  const PER_UNIT = { "sn": "saniye", "sa": "saat", "dk": "dakika" }; // [N:47]
  // [N:51-59]
  const CAPS_LEXICON = {
    "MR": "emar", "SMS": "esemes", "NTV": "entivi", "YÖK": "yök", "BİM": "bim",
    "ŞOK": "şok", "COVID": "kovid", "MEB": "meb", "İTÜ": "itü", "IBAN": "iban",
    "İETT": "ietete", "ALO": "alo", "MİT": "mit", "OK": "okey", "TSH": "teseha",
    "MHRS": "meharese", "HES": "hes", "CEO": "siio", "PR": "piar", "DJ": "dijey",
    "TV": "tivi", "FBI": "efbiay", "CNN": "sienen", "VIP": "viaypi", "HD": "heyçdi",
  };
  const VOWELS = new Set(list("aeıioöuüAEIİOÖUÜ")); // [N:46]
  const CURRENCY_CODES = { "TL": "₺", "USD": "$", "EUR": "€", "GBP": "£" }; // [N:512]
  const SYMBOLS_MAP = { "&": " ve ", "•": " , ", "▪": " , ", "►": " , ", "→": " , ", "⇒": " , " }; // [N:513]
  const DOSE_UNITS = { "mg": "miligram", "mcg": "mikrogram", "g": "gram", "ml": "mililitre" }; // [N:566]
  const DOSE_WORDS = "tablet|kapsül|şurup|ölçek|damla|doz|puf|kaşık|ampul|draje|saşe|fitil|iğne"; // [N:567]
  // [N:220-255] konusulan kokler (uzundan kisaya)
  const SPOKEN_STEMS = (() => {
    const s = new Set([
      ...ONES, ...TENS.filter(Boolean), "yüz", "bin", "milyon", "milyar", "trilyon",
      "lira", "kuruş", "dolar", "avro", "sent", "sterlin", "peni", "saniye", "dakika",
      "saat", "buçuk", "metrekare", "metreküp", "kilometrekare", "santimetrekare",
      "kilometreküp", "santimetreküp",
      ...Object.values(ABBREVIATIONS).map((v) => v.split(" ").at(-1)),
      ...Object.values(NUMBER_UNITS).map((v) => v.split(" ").at(-1)),
      ...Object.values(ORDINAL_EXCEPTIONS),
    ]);
    return [...s].sort((a, b) => b.length - a.length);
  })();
  const SPOKEN_STEM_SUFFIX = new RegExp(
    `${B}(${SPOKEN_STEMS.map(escRe).join("|")}|${W}+(?:inci|ıncı|üncü|uncu|nci|ncı|ncü|ncu))'([a-zçğıöşü]+)${B}`, "gu"); // [N:253-255]

  /* ---------- foreign.py tablolari ---------- */
  const EN_LETTERS = { // [F:42-46]
    "A": "ey", "B": "bi", "C": "si", "D": "di", "E": "i", "F": "ef", "G": "ci",
    "H": "eyç", "I": "ay", "J": "cey", "K": "key", "L": "el", "M": "em", "N": "en",
    "O": "o", "P": "pi", "Q": "kyu", "R": "ar", "S": "es", "T": "ti", "U": "yu",
    "V": "vi", "W": "dabılyu", "X": "eks", "Y": "vay", "Z": "zi",
  };
  const SYMBOLS = ["<pad>", "<bos>", "<eos>", ...list(" .,?!'-:;"), ...list("abcçdefgğhıijklmnoöpqrsştuüvwxyz"), ...list("âîû")]; // [I:16-18]
  const SYMBOL_TO_ID = Object.fromEntries(SYMBOLS.map((s, i) => [s, i]));
  const PAD = 0, BOS = 1, EOS = 2;

  // Gomulu lexicon: antalia_mini/text/data/lexicon.json ile birebir tutulur
  // (test esitligi assert eder; elle duzenlemeyin).
  const LEXICON = {
    "Adidas": "Adidas",
    "Airbnb": "Airbnb",
    "AirPods": "AirPods",
    "Akbank": "Akbank",
    "Amazon": "Amazon",
    "Android": "Android",
    "Apple": "Apple",
    "Binance": "Binance",
    "Bitcoin": "Bitcoin",
    "Bluetooth": "Bluetooth",
    "BluTV": "Blu Ti Vi",
    "Booking": "Booking",
    "Burger King": "Burger King",
    "Canva": "Canva",
    "ChatGPT": "Çet Ci Pi Ti",
    "check-in": "check-in",
    "check-out": "check-out",
    "Chrome": "Chrome",
    "Coca-Cola": "Koka Kola",
    "Copilot": "Copilot",
    "deadline": "dedlayn",
    "Discord": "Diskord",
    "Domino's": "Domino's",
    "Dropbox": "Dropbox",
    "e-Devlet": "e-Devlet",
    "e-mail": "e-mail",
    "Excel": "Excel",
    "Facebook": "Facebook",
    "feedback": "fidbek",
    "Figma": "Figma",
    "Firefox": "Fayırfoks",
    "Gemini": "Gemini",
    "Getir": "Getir",
    "Gmail": "Gmail",
    "Google": "Google",
    "Hepsiburada": "Hepsiburada",
    "Hotmail": "Hotmail",
    "HubSpot": "HubSpot",
    "iCloud": "Ayklaud",
    "IKEA": "IKEA",
    "Instagram": "Instagram",
    "iPad": "iPad",
    "iPhone": "iPhone",
    "iyzico": "iyzico",
    "Jira": "Jira",
    "LinkedIn": "LinkedIn",
    "mail": "mail",
    "Mastercard": "Mastercard",
    "McDonald's": "Mekdonalds",
    "meeting": "miting",
    "Microsoft": "Microsoft",
    "Netflix": "Netflix",
    "Nike": "Nike",
    "offline": "offline",
    "OneDrive": "Van Drayv",
    "online": "online",
    "OpenAI": "Opın Ey Ay",
    "Papara": "Papara",
    "PatientDesk": "Peyşınt Desk",
    "PayPal": "PayPal",
    "Pegasus": "Pegasus",
    "PlayStation": "Pleysteyşın",
    "PowerPoint": "PowerPoint",
    "Safari": "Safari",
    "Salesforce": "Salesforce",
    "Samsung": "Samsung",
    "Shopify": "Shopify",
    "Skype": "Skayp",
    "Slack": "Slack",
    "Spotify": "Spotifay",
    "Starbucks": "Starbucks",
    "startup": "startap",
    "Teams": "Teams",
    "Telegram": "Telegram",
    "Tesla": "Tesla",
    "TikTok": "TikTok",
    "Togg": "Togg",
    "Trello": "Trello",
    "Trendyol": "Trendyol",
    "Turkcell": "Turkcell",
    "Twitter": "Twitter",
    "Uber": "Uber",
    "Visa": "Visa",
    "Vodafone": "Vodafone",
    "WhatsApp": "WhatsApp",
    "Wi-Fi": "Wi-Fi",
    "Windows": "Windows",
    "Wolt": "Wolt",
    "Word": "Word",
    "Xbox": "Xbox",
    "Yemeksepeti": "Yemeksepeti",
    "YouTube": "YouTube",
    "Zara": "Zara",
    "Zoom": "Zoom",
  };

  /* ---------- calisma verisi (setData ile verilir) ---------- */
  let FOREIGN = new Map();
  let PARTS = new Map();
  let KNOWN = new Set();
  let ENGLISH_I = new Set();
  let dataLoaded = false;

  function foldKey(t) { // [F:217]
    return t.replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i").toLowerCase();
  }
  function trLower(w) { // [N:258-261] (+U+0307 temizligi)
    return w.replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase().replace(/̇/g, "");
  }
  function setData({ foreign, parts, lexicon, known, englishI }) {
    FOREIGN = new Map(Object.entries(foreign || {}));
    PARTS = new Map(Object.entries(parts || {}));
    if (lexicon) for (const [k, v] of Object.entries(lexicon)) LEXICON[k] = v;
    KNOWN = new Set(known || []);
    ENGLISH_I = new Set(englishI || []);
    dataLoaded = true;
  }
  function requireData() {
    if (!dataLoaded) throw new Error("AntaliaText: setData() cagrilmadan kullanilamaz");
  }

  /* ---------- foreign.py mantigi ---------- */
  function knownInTurkish(word) { // [F:102-103]
    return KNOWN.has(trLower(word)) || KNOWN.has(word.toLowerCase());
  }
  // foreign_dict'teki lexicon-identity girdileri (or. shopify->shopify) Python
  // CMU'sunda YOKTUR; gate + part lookup'ta yok sayilir (yoksa ShopIX sapmalari).
  function foreignGet(lw) {
    const v = FOREIGN.get(lw);
    return v !== undefined && v !== lw ? v : undefined;
  }
  function looksEnglish(word) { // [F:91-94]; CMU yerine english_i + foreign kapsami
    if (!/^[A-Za-z]+$/.test(word)) return false;
    const lw = word.toLowerCase();
    return ENGLISH_I.has(lw) || foreignGet(lw) !== undefined;
  }
  function hasInnerCapital(word) { // [F:106-107]
    return /[A-Z]/.test(word.slice(1)) && /[a-z]/.test(word);
  }
  const CAMEL_SRC = `[A-Z]{2,}(?=[A-Z][a-z]|${B}|[0-9]|$)|[A-Z]?[a-z]+|[A-Z]+|[0-9]+`; // [F:52] (\b->B)
  function splitCamel(word) { // [F:110-111]
    return word.match(new RegExp(CAMEL_SRC, "g")) || [word];
  }
  function englishI(word) { // [F:235-239]
    if (/^[A-Z]+$/.test(word) && word.length <= 5) return word;
    if (word.includes("I") && looksEnglish(word)) return word.replace(/I/g, "İ");
    return word;
  }
  function isUpperToken(p) { // Python str.isupper() karsiligi
    return /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(p) && p === p.toUpperCase();
  }
  function respellPart(part) { // [F:133-142] (CMU yerine sozluk; yoksa null)
    if (/^[0-9]+$/.test(part)) return part;
    if (isUpperToken(part) && part.length <= 5)
      return [...part].map((c) => (part.length > 1 ? EN_LETTERS[c][0].toUpperCase() + EN_LETTERS[c].slice(1) : EN_LETTERS[c])).join(" ");
    if (part === "i" || part === "e") return EN_LETTERS[part.toUpperCase()];
    const lw = part.toLowerCase();
    return foreignGet(lw) ?? PARTS.get(lw) ?? null;
  }
  function upFirst(t) { // [F:155-156]
    if (!t) return t;
    return (t[0] === "i" ? "İ" : t[0].toUpperCase()) + t.slice(1);
  }
  function respell(word) { // [F:145-166]
    const parts = hasInnerCapital(word) ? splitCamel(word) : [word];
    const spoken = [];
    for (const p of parts) {
      const r = respellPart(p);
      if (r === null || r === undefined) return null;
      spoken.push(r);
    }
    const upped = spoken.map((sp, k) =>
      (parts[k][0] && isUpperCase(parts[k][0])) || (k === 0 && word[0] && isUpperCase(word[0])) ? upFirst(sp) : sp);
    const merged = []; // [F:161-164]
    parts.forEach((p, k) => {
      const sp = upped[k];
      if (merged.length && ((!isUpperToken(p) && p.length <= 2) || (k === 1 && (parts[0] === "i" || parts[0] === "e"))))
        merged[merged.length - 1] += trLower(sp);
      else merged.push(sp);
    });
    const text = merged.join(" ");
    return (hasInnerCapital(word) || (word[0] && isUpperCase(word[0]))) ? upFirst(text) : text;
  }

  const PROTECTED_SRC = // [F:170-175]
    `[${WC}.+\\-]+@[${WC}\\-]+(?:\\.[${WC}\\-]+)+` +
    `|(?:https?://|www\\.)\\S+` +
    `|${B}[${WC}\\-]+(?:\\.[${WC}\\-]+)*\\.(?:com|net|org|ai|io|co|app|dev|gov|edu|tr|me|info)(?:\\.[a-z]{2})?${B}`;
  const TOKEN_SRC = `(?<![${WC}@./])([A-Za-z][A-Za-z0-9]*)(['’][a-zçğıöşü]+)?(?![${WC}@])`; // [F:51]

  function addressTerms(text, lexicon) { // [F:178-188]
    const spans = [...text.matchAll(R(PROTECTED_SRC, "giu"))].map((m) => m[0]);
    if (!spans.length) return {};
    const out = {};
    for (const [term, say] of Object.entries(lexicon)) {
      const re = R(`(?<![\\p{L}\\p{N}])${escRe(term)}(?![\\p{L}\\p{N}])`, "iu");
      if (spans.some((sp) => re.test(sp))) out[term] = say;
    }
    return out;
  }
  function autoSpan(text) { // [F:242-252]
    return text.replace(new RegExp(TOKEN_SRC, "gu"), (m, word, suffix) => {
      suffix = suffix || "";
      if (/^[A-Z]+$/.test(word) && word.length <= 5) return m;
      if (knownInTurkish(word) || !(hasInnerCapital(word) || foreignGet(word.toLowerCase()) !== undefined))
        return englishI(word) + suffix;
      const r = respell(word);
      return (r !== null && r !== undefined ? r : englishI(word)) + suffix;
    });
  }
  function respellSpan(text, lexicon, auto) { // [F:205-232]
    const terms = Object.keys(lexicon || {});
    if (!terms.length) return auto ? autoSpan(text) : text;
    const sorted = [...terms].sort((a, b) => b.length - a.length);
    const pat = R(`(?<!${W})(${sorted.map(escRe).join("|")})(?=['’]|[^${WC}]|$)`, "giu");
    const byLower = {};
    for (const t of sorted) byLower[foldKey(t)] = lexicon[t];
    let out = "", last = 0;
    for (const m of text.matchAll(pat)) {
      out += auto ? autoSpan(text.slice(last, m.index)) : text.slice(last, m.index);
      const term = m[1];
      const say = Object.prototype.hasOwnProperty.call(byLower, foldKey(term)) ? byLower[foldKey(term)] : null;
      if (say === null || say === undefined) { out += term; last = m.index + m[0].length; continue; }
      const kept = foldKey(say) === foldKey(term);
      out += auto ? (kept ? englishI(term) : say) : (kept ? term : say);
      last = m.index + m[0].length;
    }
    return out + (auto ? autoSpan(text.slice(last)) : text.slice(last));
  }
  function respellForeign(text, lexicon, auto) { // [F:191-202]
    let out = "", last = 0;
    for (const m of text.matchAll(R(PROTECTED_SRC, "giu"))) {
      out += respellSpan(text.slice(last, m.index), lexicon, auto);
      const span = m[0];
      out += span.includes("@") ? span.toLowerCase() : span;
      last = m.index + span.length;
    }
    return out + respellSpan(text.slice(last), lexicon, auto);
  }

  /* ---------- normalize.py mantigi ---------- */
  function turkishLower(text) { return trLower(text); } // [N:258-261]
  function turkishUpperChar(ch) { // [N:623-624]
    if (ch === "i") return "İ";
    if (ch === "ı") return "I";
    return ch.toUpperCase();
  }
  function normalizeOrthography(text) { // [N:264-267]
    const t = text.normalize("NFKC").replace(/[’‘`´]/g, "'").replace(/["“”„«»]/g, "");
    return t.replace(/''/g, "").replace(/\s+/gu, " ").trim();
  }
  function numberToWords(n) { // [N:480-498]
    if (n < 0) return `eksi ${numberToWords(-n)}`;
    if (n < 10) return ONES[n];
    if (n < 100) {
      const t = Math.floor(n / 10), o = n % 10;
      return o === 0 ? TENS[t] : `${TENS[t]} ${ONES[o]}`;
    }
    if (n < 1000) {
      const h = Math.floor(n / 100), r = n % 100;
      const pre = h === 1 ? "yüz" : `${ONES[h]} yüz`;
      return r === 0 ? pre : `${pre} ${numberToWords(r)}`;
    }
    for (const [s, label] of [[1000000000000, "trilyon"], [1000000000, "milyar"], [1000000, "milyon"], [1000, "bin"]]) {
      if (n >= s) {
        const c = Math.floor(n / s), r = n % s;
        const pre = (s === 1000 && c === 1) ? label : `${numberToWords(c)} ${label}`;
        return r === 0 ? pre : `${pre} ${numberToWords(r)}`;
      }
    }
    throw new Error(`number is too large: ${n}`);
  }
  function replaceDateParts(d, m, y, original) { // [N:505-509]
    const day = parseInt(d, 10), mon = parseInt(m, 10);
    if (!(day >= 1 && day <= 31) || !(mon in MONTHS))
      return original !== undefined ? original : `${y}-${m}-${d}`;
    return `${numberToWords(day)} ${MONTHS[mon]} ${numberToWords(parseInt(y, 10))}`;
  }
  function replaceSymbols(text) { // [N:516-525]
    text = text.replace(/(?<=\d)\s?°\s?C?(?!\p{L})/gu, " derece");
    text = text.replace(/(?<=\d)\s?\+\s?(?=\d)|(?<=\s)\+(?=\s)/gu, " artı ");
    text = text.replace(/(?<=[\d\s])=(?=[\d\s])/gu, " eşittir ");
    text = text.replace(new RegExp(`(?<![${WC}&])#(?=${L})`, "gu"), "heşteg ");
    text = text.replace(/\*+|_{2,}/g, "");
    text = [...text].map((ch) => SYMBOLS_MAP[ch] ?? ch).join("");
    text = [...text].filter((ch) => !/[\p{So}\p{Cs}\p{Co}]/u.test(ch)).join("");
    return text.replace(/️/g, "").replace(/‍/g, "");
  }
  function replaceIban(m, g1, g2, g3) { // [N:528-530]
    const groups = g2.includes(" ") ? [g1, ...g2.split(/\s+/), g3] : [g1, g2, g3];
    return "te re, " + groups.map(digitSequenceToWords).join(", ");
  }
  function replaceDottedInitialism(m) { // [N:533-534]
    return [...m].filter((c) => c !== ".").map((c) => INITIALISM_LETTERS[c]).join("");
  }
  function replaceBloodGroup(m, g, sign) { // [N:537-539]
    const grp = g === "0" ? "sıfır" : [...g].map((c) => INITIALISM_LETTERS[c]).join("");
    return `${grp} eraj ${sign === "+" ? "pozitif" : "negatif"}`;
  }
  function replaceRange(m, start, end) { // [N:542-549]
    if (/^\d{4}$/.test(start) && /^\d{2}$/.test(end) && parseInt(end, 10) === (parseInt(start, 10) + 1) % 100)
      return `${start} ${parseInt(end, 10)}`;
    if (/^\d+$/.test(start) && /^\d+$/.test(end) && parseInt(start, 10) > parseInt(end, 10))
      return `${start} ${end}`;
    return `${start} ile ${end}`;
  }
  function replaceLoneLetter(m, letter, dot, offset, string) { // [N:552-563]
    const end = offset + m.length;
    const following = string.slice(end, end + 1);
    if (letter === "O" || letter === "I" || ((letter === "A" || letter === "E") && [",", "!", "?"].includes(following)))
      return m;
    const initial = dot !== undefined || following === ".";
    const vitamin =
      R(`vitamin[${WC}]*\\s+(?:[${WC}]+\\s+ve\\s+)?$`, "iu").test(string.slice(0, offset)) ||
      R(`^\\s+vitamin`, "iu").test(string.slice(end));
    return (initial || vitamin ? INITIALISM_LETTERS : LETTER_NAMES)[letter];
  }
  function replaceTimes(m, daily, a, b, offset, string) { // [N:570-575]
    const first = numberToWords(parseInt(a, 10)), second = numberToWords(parseInt(b, 10));
    if (daily || R(`^\\s*(?:${DOSE_WORDS})`, "iu").test(string.slice(offset + m.length)))
      return `${daily || ""}${first} defa ${second}`;
    return `${withDative(first)} ${second}`;
  }
  function withDative(words) { // [N:578-584]
    if (words.endsWith("dört")) return words.slice(0, -1) + "de";
    const rev = [...words].reverse().find((c) => VOWELS.has(c)) || "e";
    const vowel = "aıou".includes(rev) ? "a" : "e";
    return `${words}${VOWELS.has(words[words.length - 1]) ? "y" : ""}${vowel}`;
  }
  function currencyWords(symbol, whole, fraction) { // [N:592-602]
    const pair = { "₺": ["lira", "kuruş"], "$": ["dolar", "sent"], "€": ["avro", "sent"], "£": ["sterlin", "peni"] }[symbol];
    let v = `${numberToWords(parseInt(whole.replace(/\./g, ""), 10))} ${pair[0]}`;
    if (fraction && parseInt(fraction, 10)) v += ` ${numberToWords(parseInt(fraction.padEnd(2, "0"), 10))} ${pair[1]}`;
    return v;
  }
  function replacePhone(m, country, trunk, a, b, c, d) { // [N:605-613]
    const spoken = country ? ["artı doksan"] : [];
    spoken.push(trunk ? `sıfır ${digitGroupToWords(a)}` : digitGroupToWords(a));
    for (const g of [b, c, d]) spoken.push(digitGroupToWords(g));
    return spoken.join(", ");
  }
  function digitGroupToWords(value) { // [N:616-620]
    const stripped = value.replace(/^0+/, "");
    const zeros = Array(value.length - stripped.length).fill("sıfır");
    return stripped ? [...zeros, numberToWords(parseInt(stripped, 10))].join(" ") : zeros.join(" ");
  }
  function replaceSlashPair(m, n1, n2) { // [N:627-635]
    const n = parseInt(n1, 10), d = parseInt(n2, 10);
    if (n > 0 && n < d && d <= 10) return `${withLocative(numberToWords(d))} ${numberToWords(n)}`;
    if ((n === 7 && d === 24) || (n === 24 && d === 7)) return `${numberToWords(n)} ${numberToWords(d)}`;
    return `${numberToWords(n)} bölü ${numberToWords(d)}`;
  }
  function withLocative(words) { // [N:638-642]
    const rev = [...words].reverse().find((c) => VOWELS.has(c)) || "e";
    const vowel = "aıou".includes(rev) ? "a" : "e";
    return `${words}${"çfhkpsşt".includes(words[words.length - 1]) ? "t" : "d"}${vowel}`;
  }
  function replaceAddress(m) { // [N:645-659]
    const addr = m.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    const out = [];
    for (const piece of addr.split(/([.@/_-])/)) {
      if (piece === ".") out.push("nokta");
      else if (piece === "@") out.push("et");
      else if (piece === "/") out.push("bölü");
      else if (piece === "_") out.push("alt tire");
      else if (piece === "-") out.push("tire");
      else if (piece) {
        const lw = piece.toLowerCase();
        if (ADDRESS_WORDS[lw] !== undefined) out.push(ADDRESS_WORDS[lw]);
        else if ([...piece].length <= 2 && /^\p{L}+$/u.test(lw)) // [N:656] isalpha() unicode'dur
          out.push([...trLower(lw)].map((ch) => LETTER_NAMES[turkishUpperChar(ch)] ?? ch).join(" "));
        else out.push(piece);
      }
    }
    return out.join(" ");
  }
  function replaceDuration(m, h, mi, s) { // [N:662-667]
    const parts = [];
    for (const [v, u] of [[parseInt(h, 10), "saat"], [parseInt(mi, 10), "dakika"]]) if (v) parts.push(`${numberToWords(v)} ${u}`);
    if (parseInt(s, 10) || !parts.length) parts.push(`${numberToWords(parseInt(s, 10))} saniye`);
    return parts.join(" ");
  }
  function attachSuffix(m, stem, suffix) { // [N:670-694]
    if (stem[stem.length - 1] && !VOWELS.has(stem[stem.length - 1]) && suffix.length > 1 && "yns".includes(suffix[0]) && VOWELS.has(suffix[1]))
      suffix = suffix.slice(1);
    if (VOWELS.has(suffix[0])) stem = stem.replace(/dört$/, "dörd").replace(/buçuk$/, "buçuğ");
    let vowel = [...stem].reverse().find((c) => VOWELS.has(c)) || "e";
    const out = [];
    [...suffix].forEach((char, i) => {
      if ("ae".includes(char)) char = "aıou".includes(vowel) ? "a" : "e";
      else if ("ıiuü".includes(char)) {
        const back = "aıou".includes(vowel), round = "ouöü".includes(vowel);
        char = (!back && !round) ? "i" : (!back && round) ? "ü" : (back && !round) ? "ı" : "u";
      } else if (i === 0 && "dt".includes(char)) char = "çfhkpsşt".includes(stem[stem.length - 1]) ? "t" : "d";
      if (VOWELS.has(char)) vowel = char;
      out.push(char);
    });
    return stem + out.join("");
  }
  function replaceTime(m, h, mi) { // [N:697-703]
    const hw = numberToWords(parseInt(h, 10));
    if (parseInt(mi, 10) === 0) return hw;
    return `${hw} ${mi.startsWith("0") ? digitSequenceToWords(mi) : numberToWords(parseInt(mi, 10))}`;
  }
  function numericToWords(v) { // [N:706-710]
    if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(v)) {
      const noDots = v.replace(/\./g, "");
      const ci = noDots.indexOf(",");
      if (ci !== -1) return decimalToWords(`${noDots.slice(0, ci)},${noDots.slice(ci + 1)}`);
      return numberToWords(parseInt(noDots, 10));
    }
    return /[,.]/.test(v) ? decimalToWords(v) : numberToWords(parseInt(v, 10));
  }
  function decimalToWords(v) { // [N:713-721]
    const i = v.search(/[,.]/);
    const whole = v.slice(0, i), frac = v.slice(i + 1);
    const ww = numberToWords(parseInt(whole, 10));
    if (frac === "5" && parseInt(whole, 10)) return `${ww} buçuk`;
    return `${ww} virgül ${frac.length <= 2 ? digitGroupToWords(frac) : digitSequenceToWords(frac)}`;
  }
  function digitSequenceToWords(v) { // [N:724-725]
    return [...v].map((d) => ONES[parseInt(d, 10)]).join(" ");
  }
  function ordinalToWords(n) { // [N:728-732]
    const w = numberToWords(n).split(" ");
    w[w.length - 1] = ORDINAL_EXCEPTIONS[w[w.length - 1]] ?? `${w[w.length - 1]}inci`;
    return w.join(" ");
  }
  function romanToInt(s) { // [N:735-740]
    let t = 0;
    [...s].forEach((c, i) => {
      const v = ROMAN_VALUES[c];
      t += (i + 1 < s.length && ROMAN_VALUES[s[i + 1]] > v) ? -v : v;
    });
    return t;
  }
  function replaceRoman(text) { // [N:743-749]
    const ROMAN = "(?:XX|XIX|XVIII|XVII|XVI|XV|XIV|XIII|XII|XI|IX|VIII|VII|VI|IV|III|II)";
    text = text.replace(new RegExp(`${B}(${ROMAN}|I(?=\\.\\s+Dünya))\\.\\s+(?=[A-ZÇĞİÖŞÜ])`, "gu"),
      (m, g) => ordinalToWords(romanToInt(g)) + " ");
    return text.replace(new RegExp(`${B}([A-ZÇĞİÖŞÜ]${L}*\\s+)(${ROMAN})${B}(?![.'’]?${L})`, "gu"),
      (m, pre, g) => pre + numberToWords(romanToInt(g)));
  }
  function lowerIfShouted(text) { // [N:752-758]
    const words = text.match(new RegExp(`${B}${L}{2,}${B}`, "gu")) || [];
    const caps = words.filter((w) => /^[A-ZÇĞİÖŞÜQWX]{2,}$/u.test(w));
    const spoken = caps.filter(isPronounceable).length;
    return (spoken >= 3 && caps.length >= 0.7 * words.length) ? trLower(text) : text;
  }
  function replaceInitialism(m) { // [N:761-768]
    if (CAPS_LEXICON[m] !== undefined) return CAPS_LEXICON[m];
    if (isPronounceable(m)) return m;
    return [...m].map((c) => INITIALISM_LETTERS[c]).join("");
  }
  function isPronounceable(word) { // [N:771-776]
    if (word.length < 4) return false;
    const v = [...word].filter((c) => VOWELS.has(c)).length;
    return v / word.length >= 0.3 && !/[^AEIİOÖUÜ]{3}/u.test(word);
  }

  function normalizeForModel(text) { // [N:302-451] SIRA PYTHON ILE AYNI
    let t = normalizeOrthography(text.replace(/−/g, "-"));
    t = lowerIfShouted(t);
    t = replaceRoman(t);
    t = t.replace(new RegExp(`'([A-ZÇĞİÖŞÜ]+)${B}`, "gu"), (m, g) => "'" + trLower(g));
    t = t.replace(R(`(?<!${B}sokak )(?<!${B}sokağı )(?<!${B}cadde )(?<!${B}caddesi )(?<!${B}bulvarı )(?<!${B}mahallesi )(?<!${B}apartmanı )(?<=${L} )no${B}\\.?:?(?=\\s)`, "giu"), "numarası");
    t = t.replace(R(`${B}no\\s*[:.]\\s*(?=\\d)`, "giu"), "numara ");
    t = t.replace(new RegExp(`${B}D\\s*:\\s*(?=\\d)`, "gu"), "daire ");
    t = t.replace(new RegExp(`${B}Tel\\s*:`, "gu"), "telefon:");
    t = t.replace(new RegExp(`${B}s\\.\\s*(?=\\d)`, "gu"), "sayfa ");
    t = t.replace(new RegExp(`${B}[${WC}.+\\-]+@[${WC}\\-]+(?:\\.[${WC}\\-]+)+${B}`, "gu"), replaceAddress); // [N:320]
    t = t.replace(R(`${B}(?:https?://)?(?:www\\.)?[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:com|net|org|gov|edu|info|io|ai|tr)${B}(?:/[${WC}./\\-]*)?`, "giu"), replaceAddress); // [N:321]
    t = replaceSymbols(t); // [N:322]
    t = t.replace(new RegExp(`${B}TR(\\d{2})((?:\\s?\\d{4}){5})\\s?(\\d{2})${B}`, "gu"), replaceIban); // [N:323]
    t = t.replace(/(?:[A-ZÇĞİÖŞÜ]\.){2,}/gu, replaceDottedInitialism); // [N:324]
    t = t.replace(new RegExp(`${B}pH${B}`, "gu"), "pe ha"); // [N:325]
    t = t.replace(new RegExp(`${B}H2O${B}`, "gu"), "haş iki o"); // [N:326]
    t = t.replace(R(`${B}H\\.\\s*pylori${B}`, "giu"), "ha pilori"); // [N:327]
    t = t.replace(R(`${B}X-?ray${B}`, "giu"), "iksrey"); // [N:328]
    t = t.replace(new RegExp(`${B}(hane(?:si|leri)?)\\s+(\\d{2,6})${B}`, "gu"), (m, a, b) => `${a} ${digitSequenceToWords(b)}`); // [N:329-330]
    t = t.replace(new RegExp(`${B}HbA1c${B}`, "gu"), "ha be a bir ce"); // [N:331]
    t = t.replace(new RegExp(`${B}(AB|A|B|0)\\s?Rh\\s?\\(?([+-])\\)?`, "gu"), replaceBloodGroup); // [N:332]
    t = t.replace(new RegExp(`${B}(\\d{2,3})/(\\d{2,3})\\s*mmHg${B}`, "gu"), // [N:333-337]
      (m, a, b) => `${withDative(numberToWords(parseInt(a, 10)))} ${numberToWords(parseInt(b, 10))} milimetre cıva`);
    t = t.replace(new RegExp(`(günde\\s+)?${B}(\\d+)\\s?[xX×]\\s?(\\d+)${B}`, "gu"), replaceTimes); // [N:338]
    t = t.replace(new RegExp(`(?<![\\d.,])(\\d+(?:,\\d+)?)\\s?km\\/(?:sa|s|h)${B}`, "gu"), (m, g) => `saatte ${numericToWords(g)} kilometre`); // [N:341-344]
    t = t.replace(new RegExp(`(?<![\\d.,])(\\d+(?:,\\d+)?)\\s?(mg|mcg|g|ml)\\/kg${B}`, "gu"), (m, num, unit) => `kilogram ba\u015f\u0131na ${numericToWords(num)} ${DOSE_UNITS[unit]}`); // [N:345-349]
    t = t.replace(/(?<=\d) ?(km|cm|m)([23])(?![\p{L}\p{N}_])/gu, // [N:350-354]
      (m, u, p) => " " + AREA_UNITS[u] + (p === "2" ? "kare" : "k\u00fcp"));
    t = t.replace(new RegExp(`(?<=\\d) ?(${Object.keys(NUMBER_UNITS).map(escRe).join("|")})(?![${WC}/])`, "gu"), // [N:355-359]
      (m, u) => " " + NUMBER_UNITS[u]);
    t = t.replace(new RegExp(`(?<=\\d) L${B}(?![/'\u2019])(?!\\s*\\d)`, "gu"), " litre"); // [N:360]
    t = t.replace(new RegExp(`${B}(${Object.keys(WEEKDAYS).join("|")})${B}\\.?(?=\\s*(?:[-\u2013,/]|\\d|$))`, "gu"), // [N:361-363]
      (m, d) => WEEKDAYS[d]);
    t = t.replace(R(`${B}(pazartesi|sal\u0131|\u00e7ar\u015famba|per\u015fembe|cuma|cumartesi|pazar)\\s*[-\u2013]\\s*(pazartesi|sal\u0131|\u00e7ar\u015famba|per\u015fembe|cuma|cumartesi|pazar)${B}`, "giu"), // [N:364-370]
      (m, a, b) => `${a} ile ${b}`);
    t = t.replace(/([\u20ba$\u20ac\u00a3])\s*((?:\d{1,3}(?:\.\d{3})+)|\d+)(?:[,.](\d{1,2}))?/gu, // [N:373]
      (m, sym, whole, frac) => currencyWords(sym, whole, frac));
    t = t.replace(new RegExp(`(?<![\\d.,])((?:\\d{1,3}(?:\\.\\d{3})+)|\\d+)(?:,(\\d{1,2}))?\\s?(?:([\\u20ba$\\u20ac\\u00a3])|(TL|USD|EUR|GBP)${B})`, "gu"), // [N:374-378]
      (m, whole, frac, sym, code) => currencyWords(sym || CURRENCY_CODES[code], whole, frac));
    t = t.replace(new RegExp(`(?<=\\d)[A-Z\u00c7\u011e\u0130\u00d6\u015eQWX]{1,6}(?=\\d|${B})|${B}[A-Z\u00c7\u011e\u0130\u00d6\u015eQWX]{1,6}(?=\\d)|(?<=\\d )[A-Z\u00c7\u011e\u0130\u00d6\u015eQWX]{2,6}(?= \\d)`, "gu"), // [N:380-385]
      (m) => (Object.prototype.hasOwnProperty.call(CAPS_LEXICON, m) || isPronounceable(m) ? m : " " + [...m].map((c) => INITIALISM_LETTERS[c]).join(" ") + " "));
    t = t.replace(/(?<=\p{L})(?=\d)|(?<=\d)(?=\p{L})/gu, " "); // [N:386] harf<->rakam ayirma
    t = t.replace(/(?<=\p{L})-(?=\d)/gu, " "); // [N:387] COVID-19
    t = t.replace(new RegExp(`${B}([A-Z\u00c7\u011e\u0130\u00d6\u015eQWX])(?= \\d)|(?<=\\d )([A-Z\u00c7\u011e\u0130\u00d6\u015eQWX])${B}`, "gu"), // [N:388]
      (m, a, b) => LETTER_NAMES[a || b]);
    t = t.replace(new RegExp(`${B}(\\d{1,2})[./-](\\d{1,2})[./-](\\d{4})${B}`, "gu"), // [N:389]
      (m, d, mo, y) => replaceDateParts(d, mo, y, m));
    t = t.replace(new RegExp(`${B}(\\d{4})-(\\d{1,2})-(\\d{1,2})${B}`, "gu"), // [N:390-392]
      (m, y, mo, d) => replaceDateParts(d, mo, y));
    t = t.replace(/%\s*(\d+(?:[,.]\d+)?)/gu, (m, g) => `y\u00fczde ${numericToWords(g)}`); // [N:393]
    t = t.replace(/(?<![\d.,])(\d+(?:,\d+)?)\s?%/gu, (m, g) => `yüzde ${numericToWords(g)}`); // [N:394-396]
    t = t.replace(/(?<!\d)(\+90[\s-]?)?(0?)\(?(\d{3})\)?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})(?!\d)/gu, replacePhone); // [N:397]
    t = t.replace(/(?<![\d\-–])(\d[\d.:,]*)\s*[-–]\s*(\d[\d.:,]*)(?![\d\-–])/gu, replaceRange); // [N:398]
    t = t.replace(/(?<![\p{L}\p{N}_.,:)\]])-(?=\d)/gu, "eksi "); // [N:399]
    t = t.replace(new RegExp(`${B}(\\d{1,2}):([0-5]\\d):([0-5]\\d)${B}`, "gu"), replaceDuration); // [N:400]
    t = t.replace(new RegExp(`${B}([01]?\\d|2[0-3])[:.]([0-5]\\d)${B}`, "gu"), replaceTime); // [N:401]
    t = t.replace(new RegExp(`${B}(\\d{1,2})/(\\d{1,2})${B}`, "gu"), replaceSlashPair); // [N:402]
    t = t.replace(new RegExp(`${B}(\\d+)/(\\d+)${B}`, "gu"), (m, a, b) => `${a} bölü ${b}`); // [N:403]
    t = t.replace(new RegExp(`${B}\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?${B}`, "gu"), (m) => numericToWords(m)); // [N:404]
    t = t.replace(new RegExp(`${B}(\\d+)[,.](\\d+)${B}`, "gu"), (m) => decimalToWords(m)); // [N:405]
    t = t.replace(new RegExp(`${B}(\\d+)'?(?:inci|ıncı|üncü|uncu|nci|ncı|ncü|ncu)${B}`, "gu"), (m, g) => ordinalToWords(parseInt(g, 10))); // [N:407-411]
    t = t.replace(new RegExp(`${B}(\\d+)\\.(?=[a-zçğıöşü])`, "gu"), (m, g) => ordinalToWords(parseInt(g, 10))); // [N:412]
    t = t.replace(new RegExp(`${B}([1-9]\\d*)\\.(?=\\s+(?:[a-zçğıöşü]|(?:${ORDINAL_HEADS})${B}))`, "gu"), (m, g) => ordinalToWords(parseInt(g, 10))); // [N:414-418]
    t = t.replace(new RegExp(`${B}\\d{5,}${B}`, "gu"), (m) => digitSequenceToWords(m)); // [N:419]
    t = t.replace(new RegExp(`${B}0\\d+${B}`, "gu"), (m) => digitGroupToWords(m)); // [N:420]
    t = t.replace(new RegExp(`${B}\\d+${B}`, "gu"), (m) => numberToWords(parseInt(m, 10))); // [N:421]
    t = t.replace(R(`${B}no\\.'?s[ıu]${B}`, "giu"), "numarası"); // [N:422]
    t = t.replace(R(`(?<=${W})/(sn|sa|dk)${B}`, "giu"), (m, g) => " bölü " + PER_UNIT[g.toLowerCase()]); // [N:424-426]
    t = t.replace(new RegExp(`${B}(mg|kg|g|km|m|cm|ml)/(kg|g|m|l|lt|ml|saat|gün)${B}`, "gu"), (m, a, b) => `${a} bölü ${b}`); // [N:427]
    t = t.replace(new RegExp(`${B}Sn\\.\\s*(?=[A-ZÇĞİÖŞÜ])`, "gu"), "sayın "); // [N:428]
    for (const abbr of Object.keys(ABBREVIATIONS).sort((a, b) => b.length - a.length)) { // [N:429-439]
      const exp = ABBREVIATIONS[abbr];
      if (abbr.endsWith(".")) {
        t = t.replace(R(`(?<!${W})${escRe(abbr)}\\s*(?=${W})`, "giu"), `${exp} `);
        if (BEFORE_A_WORD.has(abbr)) continue;
        t = t.replace(R(`(?<!${W})${escRe(abbr)}`, "giu"), exp);
      } else {
        t = t.replace(R(`(?<!${W})${escRe(abbr)}(?!${W})`, "giu"), exp);
      }
    }
    t = t.replace(new RegExp(`${B}[A-ZÇĞİÖŞÜQWX]{2,6}${B}`, "gu"), replaceInitialism); // [N:440]
    t = t.replace(new RegExp(`(?<![${WC}.'-])([A-ZÇĞİÖŞÜQWX])(\\.(?=\\s+[a-zçğıöşü]))?(?![${WC}-])`, "gu"), replaceLoneLetter); // [N:443-445]
    t = t.replace(SPOKEN_STEM_SUFFIX, attachSuffix); // [N:446]
    t = t.replace(/\s+\/\s+/g, ", "); // [N:447]
    t = t.replace(/(?<=\p{L})\/(?=\p{L})/gu, " "); // [N:448]
    t = t.replace(/\s+([,.;:!?])/g, "$1"); // [N:449]
    t = t.replace(/^[\s,]+|(?<=[,.;:!?])\s*,/gu, ""); // [N:450]
    t = t.replace(/\s+/gu, " ").trim(); // [N:451]
    return t;
  }

  function normalizeForCasedModel(text) { // [N:454-477]
    requireData();
    const merged = { ...LEXICON };
    const inAddr = addressTerms(text, merged);
    text = respellForeign(text, merged, true);
    let out = normalizeForModel(text);
    if (Object.keys(inAddr).length) out = respellForeign(out, inAddr, false);
    out = out.replace(new RegExp(`${B}[A-ZÇĞİÖŞÜQWX]{2,}${B}`, "gu"), (m) => trLower(m));
    return out.replace(/I/g, "ı").replace(/İ/g, "i");
  }

  /* ---------- __init__.py on-uclari ---------- */
  const FOLD_APOS = /[’‘`´]/g; // [I:20]
  function cleanModelText(s) { // [I:31-37]
    s = s.replace(FOLD_APOS, "'").replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, ".").replace(/[\u00a0\t\n]/g, " ");
    s = s.replace(/[^abcçdefgğhıijklmnoöpqrsştuüvwxyzâîû .,?!'\-:;]/g, " ");
    s = s.replace(/\s+([.,?!:;])/g, "$1");
    return s.replace(/\s+/g, " ").trim();
  }
  function toModelText(raw) { // [I:25-28] + api.model_text geri-donusu [api:126-133]
    try {
      const t = normalizeForCasedModel(String(raw).normalize("NFC"));
      return cleanModelText(trLower(t));
    } catch (e) {
      if (typeof console !== "undefined" && console.warn) console.warn(`text normaliser failed (${e}); reading the text as written`);
      return cleanModelText(trLower(String(raw).normalize("NFC")));
    }
  }
  function encode(modelText) { // [I:40-41]
    return [BOS, ...[...modelText].filter((c) => c in SYMBOL_TO_ID).map((c) => SYMBOL_TO_ID[c]), EOS];
  }

  return {
    version: "1.0.0-port1",
    source: "turkish-tts @ 3ed2e60",
    SYMBOLS, SYMBOL_TO_ID, PAD, BOS, EOS, LEXICON,
    setData, toModelText, cleanModelText, encode,
    _debug: { lowerIfShouted, replaceRoman, normalizeOrthography, R },
    turkishLower, normalizeForModel, normalizeForCasedModel,
  };
})();

export default AntaliaText;
