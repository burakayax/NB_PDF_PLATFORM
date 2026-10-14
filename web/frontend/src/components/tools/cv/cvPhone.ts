/**
 * CV telefon alanı: ülke kodu, yazdıkça biçimlendirme ve şehirden ülke tahmini.
 * Saf fonksiyonlar; tamamı cihazda çalışır.
 *
 * Saklanan değer her zaman "+90 532 123 45 67" biçimindedir (ülke kodu + ulusal numara).
 * Eski taslaklardaki serbest metin ("0532 123 45 67") okunurken varsayılan ülke (+90) varsayılır.
 */

export type CountryPhone = {
  iso: string;
  tr: string;
  en: string;
  dial: string;
  /** Ulusal numara kalıbı: # = rakam. Rakam sayısı = en çok rakam. */
  mask: string;
  /** Ulusal numara için en az rakam (kalıptan kısa olabilen ülkeler). */
  min?: number;
  /** Ulusal numaranın başındaki "0" gibi yerel ön ek (uluslararası yazımda atılır). */
  trunk?: string;
  /** Şehir/ülke eşleştirmesi için anahtar sözcükler (virgülle ayrılmış, sade yazım). */
  places: string;
};

const TR_PROVINCES =
  "adana,adiyaman,afyonkarahisar,afyon,agri,aksaray,amasya,ankara,antalya,ardahan,artvin,aydin,balikesir,bartin,batman,bayburt,bilecik,bingol,bitlis,bolu,burdur,bursa,canakkale,cankiri,corum,denizli,diyarbakir,duzce,edirne,elazig,erzincan,erzurum,eskisehir,gaziantep,giresun,gumushane,hakkari,hatay,igdir,isparta,istanbul,izmir,kahramanmaras,karabuk,karaman,kars,kastamonu,kayseri,kilis,kirikkale,kirklareli,kirsehir,kocaeli,konya,kutahya,malatya,manisa,mardin,mersin,mugla,mus,nevsehir,nigde,ordu,osmaniye,rize,sakarya,samsun,sanliurfa,siirt,sinop,sivas,sirnak,tekirdag,tokat,trabzon,tunceli,usak,van,yalova,yozgat,zonguldak,lefkosa,girne,gazimagusa,famagusta,guzelyurt,iskenderun,alanya,bodrum,marmaris,fethiye,turkiye,turkey,tr,kktc,trnc,northern cyprus,kuzey kibris";

export const COUNTRIES: CountryPhone[] = [
  { iso: "TR", tr: "Türkiye", en: "Türkiye", dial: "90", mask: "### ### ## ##", trunk: "0", places: TR_PROVINCES },
  { iso: "DE", tr: "Almanya", en: "Germany", dial: "49", mask: "### ########", min: 10, trunk: "0", places: "almanya,germany,deutschland,de,berlin,munich,munchen,hamburg,frankfurt,koln,cologne,stuttgart,dusseldorf,dortmund,essen,leipzig,bremen,hannover,nurnberg,nuremberg,mannheim" },
  { iso: "GB", tr: "Birleşik Krallık", en: "United Kingdom", dial: "44", mask: "#### ######", trunk: "0", places: "birlesik krallik,ingiltere,united kingdom,uk,gb,england,scotland,wales,london,manchester,birmingham,liverpool,leeds,glasgow,edinburgh,bristol,sheffield,cardiff,belfast,nottingham,newcastle,oxford,cambridge" },
  { iso: "US", tr: "ABD", en: "United States", dial: "1", mask: "(###) ###-####", places: "abd,amerika,united states,usa,us,new york,los angeles,chicago,houston,san francisco,seattle,boston,miami,washington,dallas,atlanta,denver,austin,san diego,philadelphia,phoenix,las vegas,orlando" },
  { iso: "CA", tr: "Kanada", en: "Canada", dial: "1", mask: "(###) ###-####", places: "kanada,canada,toronto,vancouver,montreal,ottawa,calgary,edmonton,winnipeg,quebec" },
  { iso: "FR", tr: "Fransa", en: "France", dial: "33", mask: "# ## ## ## ##", trunk: "0", places: "fransa,france,paris,lyon,marseille,toulouse,nice,nantes,strasbourg,bordeaux,lille,montpellier" },
  { iso: "NL", tr: "Hollanda", en: "Netherlands", dial: "31", mask: "# ########", trunk: "0", places: "hollanda,netherlands,holland,amsterdam,rotterdam,the hague,den haag,utrecht,eindhoven" },
  { iso: "BE", tr: "Belçika", en: "Belgium", dial: "32", mask: "### ## ## ##", min: 8, trunk: "0", places: "belcika,belgium,brussels,bruksel,antwerp,ghent,liege" },
  { iso: "IT", tr: "İtalya", en: "Italy", dial: "39", mask: "### ### ####", min: 9, places: "italya,italy,roma,rome,milan,milano,napoli,naples,torino,turin,venice,venedik,florence,floransa,bologna" },
  { iso: "ES", tr: "İspanya", en: "Spain", dial: "34", mask: "### ## ## ##", places: "ispanya,spain,madrid,barcelona,valencia,sevilla,seville,bilbao,malaga,zaragoza" },
  { iso: "PT", tr: "Portekiz", en: "Portugal", dial: "351", mask: "### ### ###", places: "portekiz,portugal,lisbon,lizbon,porto,faro" },
  { iso: "CH", tr: "İsviçre", en: "Switzerland", dial: "41", mask: "## ### ## ##", trunk: "0", places: "isvicre,switzerland,zurich,geneva,cenevre,basel,bern,lausanne" },
  { iso: "AT", tr: "Avusturya", en: "Austria", dial: "43", mask: "### ########", min: 9, trunk: "0", places: "avusturya,austria,vienna,viyana,wien,salzburg,graz,innsbruck" },
  { iso: "SE", tr: "İsveç", en: "Sweden", dial: "46", mask: "## ### ## ##", min: 8, trunk: "0", places: "isvec,sweden,stockholm,gothenburg,goteborg,malmo" },
  { iso: "NO", tr: "Norveç", en: "Norway", dial: "47", mask: "### ## ###", places: "norvec,norway,oslo,bergen,trondheim,stavanger" },
  { iso: "DK", tr: "Danimarka", en: "Denmark", dial: "45", mask: "## ## ## ##", places: "danimarka,denmark,copenhagen,kopenhag,aarhus,odense" },
  { iso: "FI", tr: "Finlandiya", en: "Finland", dial: "358", mask: "## ### ####", min: 8, trunk: "0", places: "finlandiya,finland,helsinki,espoo,tampere,turku" },
  { iso: "IE", tr: "İrlanda", en: "Ireland", dial: "353", mask: "## ### ####", min: 8, trunk: "0", places: "irlanda,ireland,dublin,cork,galway,limerick" },
  { iso: "PL", tr: "Polonya", en: "Poland", dial: "48", mask: "### ### ###", places: "polonya,poland,warsaw,varsova,krakow,gdansk,wroclaw,poznan,lodz" },
  { iso: "CZ", tr: "Çekya", en: "Czechia", dial: "420", mask: "### ### ###", places: "cekya,czechia,czech republic,prague,prag,brno,ostrava" },
  { iso: "SK", tr: "Slovakya", en: "Slovakia", dial: "421", mask: "### ### ###", trunk: "0", places: "slovakya,slovakia,bratislava,kosice" },
  { iso: "HU", tr: "Macaristan", en: "Hungary", dial: "36", mask: "## ### ####", places: "macaristan,hungary,budapest,debrecen,szeged" },
  { iso: "RO", tr: "Romanya", en: "Romania", dial: "40", mask: "### ### ###", trunk: "0", places: "romanya,romania,bucharest,bukres,cluj,constanta,timisoara,iasi" },
  { iso: "BG", tr: "Bulgaristan", en: "Bulgaria", dial: "359", mask: "## ### ####", min: 8, trunk: "0", places: "bulgaristan,bulgaria,sofia,sofya,plovdiv,varna,burgas" },
  { iso: "GR", tr: "Yunanistan", en: "Greece", dial: "30", mask: "### ### ####", places: "yunanistan,greece,athens,atina,thessaloniki,selanik,patras" },
  { iso: "HR", tr: "Hırvatistan", en: "Croatia", dial: "385", mask: "## ### ####", min: 8, trunk: "0", places: "hirvatistan,croatia,zagreb,split,rijeka,dubrovnik" },
  { iso: "SI", tr: "Slovenya", en: "Slovenia", dial: "386", mask: "## ### ###", trunk: "0", places: "slovenya,slovenia,ljubljana,maribor" },
  { iso: "RS", tr: "Sırbistan", en: "Serbia", dial: "381", mask: "## ### ####", min: 8, trunk: "0", places: "sirbistan,serbia,belgrade,belgrad,novi sad,nis" },
  { iso: "BA", tr: "Bosna Hersek", en: "Bosnia and Herzegovina", dial: "387", mask: "## ### ###", trunk: "0", places: "bosna hersek,bosna,bosnia,sarajevo,mostar,banja luka" },
  { iso: "MK", tr: "Kuzey Makedonya", en: "North Macedonia", dial: "389", mask: "## ### ###", trunk: "0", places: "kuzey makedonya,makedonya,north macedonia,macedonia,skopje,uskup" },
  { iso: "AL", tr: "Arnavutluk", en: "Albania", dial: "355", mask: "## ### ####", min: 8, trunk: "0", places: "arnavutluk,albania,tirana,durres" },
  { iso: "XK", tr: "Kosova", en: "Kosovo", dial: "383", mask: "## ### ###", trunk: "0", places: "kosova,kosovo,pristina,prizren" },
  { iso: "UA", tr: "Ukrayna", en: "Ukraine", dial: "380", mask: "## ### ## ##", trunk: "0", places: "ukrayna,ukraine,kyiv,kiev,kharkiv,odesa,odessa,lviv,dnipro" },
  { iso: "RU", tr: "Rusya", en: "Russia", dial: "7", mask: "### ###-##-##", places: "rusya,russia,moscow,moskova,saint petersburg,st petersburg,petersburg,novosibirsk,kazan" },
  { iso: "LT", tr: "Litvanya", en: "Lithuania", dial: "370", mask: "### #####", trunk: "0", places: "litvanya,lithuania,vilnius,kaunas" },
  { iso: "LV", tr: "Letonya", en: "Latvia", dial: "371", mask: "## ### ###", places: "letonya,latvia,riga" },
  { iso: "EE", tr: "Estonya", en: "Estonia", dial: "372", mask: "#### ####", min: 7, places: "estonya,estonia,tallinn,tartu" },
  { iso: "IS", tr: "İzlanda", en: "Iceland", dial: "354", mask: "### ####", places: "izlanda,iceland,reykjavik" },
  { iso: "AZ", tr: "Azerbaycan", en: "Azerbaijan", dial: "994", mask: "## ### ## ##", trunk: "0", places: "azerbaycan,azerbaijan,baku,bakü,ganja,gence,nahcivan" },
  { iso: "GE", tr: "Gürcistan", en: "Georgia", dial: "995", mask: "### ## ## ##", places: "gurcistan,georgia,tbilisi,batumi,kutaisi" },
  { iso: "KZ", tr: "Kazakistan", en: "Kazakhstan", dial: "7", mask: "### ###-##-##", places: "kazakistan,kazakhstan,almaty,astana,nur-sultan,shymkent" },
  { iso: "UZ", tr: "Özbekistan", en: "Uzbekistan", dial: "998", mask: "## ### ## ##", places: "ozbekistan,uzbekistan,tashkent,taskent,samarkand,semerkant,bukhara,buhara" },
  { iso: "KG", tr: "Kırgızistan", en: "Kyrgyzstan", dial: "996", mask: "### ### ###", trunk: "0", places: "kirgizistan,kyrgyzstan,bishkek,bisikek,osh" },
  { iso: "TM", tr: "Türkmenistan", en: "Turkmenistan", dial: "993", mask: "## ######", trunk: "8", places: "turkmenistan,ashgabat,asgabat" },
  { iso: "CY", tr: "Kıbrıs (Rum)", en: "Cyprus", dial: "357", mask: "## ######", places: "kibris,cyprus,nicosia,limassol,larnaca,paphos" },
  { iso: "SA", tr: "Suudi Arabistan", en: "Saudi Arabia", dial: "966", mask: "## ### ####", trunk: "0", places: "suudi arabistan,saudi arabia,riyadh,riyad,jeddah,cidde,mecca,mekke,medina,medine,dammam" },
  { iso: "AE", tr: "Birleşik Arap Emirlikleri", en: "United Arab Emirates", dial: "971", mask: "## ### ####", min: 8, trunk: "0", places: "birlesik arap emirlikleri,bae,uae,united arab emirates,dubai,abu dhabi,sharjah,sarja,ajman" },
  { iso: "QA", tr: "Katar", en: "Qatar", dial: "974", mask: "#### ####", places: "katar,qatar,doha" },
  { iso: "KW", tr: "Kuveyt", en: "Kuwait", dial: "965", mask: "#### ####", places: "kuveyt,kuwait" },
  { iso: "IQ", tr: "Irak", en: "Iraq", dial: "964", mask: "### ### ####", trunk: "0", places: "irak,iraq,baghdad,bagdat,erbil,basra,mosul,musul,kerkuk,kirkuk,sulaymaniyah,suleymaniye" },
  { iso: "IR", tr: "İran", en: "Iran", dial: "98", mask: "### ### ####", trunk: "0", places: "iran,tehran,tahran,isfahan,tabriz,tebriz,shiraz,mashhad" },
  { iso: "SY", tr: "Suriye", en: "Syria", dial: "963", mask: "### ### ###", min: 8, trunk: "0", places: "suriye,syria,damascus,sam,aleppo,halep,homs,hama,latakia,lazkiye" },
  { iso: "JO", tr: "Ürdün", en: "Jordan", dial: "962", mask: "# #### ####", trunk: "0", places: "urdun,jordan,amman" },
  { iso: "LB", tr: "Lübnan", en: "Lebanon", dial: "961", mask: "## ### ###", min: 7, trunk: "0", places: "lubnan,lebanon,beirut,beyrut" },
  { iso: "IL", tr: "İsrail", en: "Israel", dial: "972", mask: "## ### ####", trunk: "0", places: "israil,israel,tel aviv,jerusalem,kudus,haifa" },
  { iso: "EG", tr: "Mısır", en: "Egypt", dial: "20", mask: "### ### ####", trunk: "0", places: "misir,egypt,cairo,kahire,alexandria,iskenderiye,giza" },
  { iso: "LY", tr: "Libya", en: "Libya", dial: "218", mask: "## #######", trunk: "0", places: "libya,tripoli,trablus,benghazi,bingazi" },
  { iso: "TN", tr: "Tunus", en: "Tunisia", dial: "216", mask: "## ### ###", places: "tunus,tunisia" },
  { iso: "DZ", tr: "Cezayir", en: "Algeria", dial: "213", mask: "### ## ## ##", trunk: "0", places: "cezayir,algeria,algiers,oran" },
  { iso: "MA", tr: "Fas", en: "Morocco", dial: "212", mask: "### ######", trunk: "0", places: "fas,morocco,casablanca,rabat,marrakech,marakes" },
  { iso: "ZA", tr: "Güney Afrika", en: "South Africa", dial: "27", mask: "## ### ####", trunk: "0", places: "guney afrika,south africa,johannesburg,cape town,durban,pretoria" },
  { iso: "NG", tr: "Nijerya", en: "Nigeria", dial: "234", mask: "### ### ####", trunk: "0", places: "nijerya,nigeria,lagos,abuja" },
  { iso: "KE", tr: "Kenya", en: "Kenya", dial: "254", mask: "### ######", trunk: "0", places: "kenya,nairobi,mombasa" },
  { iso: "IN", tr: "Hindistan", en: "India", dial: "91", mask: "##### #####", places: "hindistan,india,mumbai,delhi,new delhi,bangalore,bengaluru,hyderabad,chennai,kolkata,pune" },
  { iso: "PK", tr: "Pakistan", en: "Pakistan", dial: "92", mask: "### #######", trunk: "0", places: "pakistan,karachi,lahore,islamabad" },
  { iso: "AF", tr: "Afganistan", en: "Afghanistan", dial: "93", mask: "## ### ####", trunk: "0", places: "afganistan,afghanistan,kabul" },
  { iso: "BD", tr: "Bangladeş", en: "Bangladesh", dial: "880", mask: "#### ######", trunk: "0", places: "banglades,bangladesh,dhaka" },
  { iso: "CN", tr: "Çin", en: "China", dial: "86", mask: "### #### ####", places: "cin,china,beijing,pekin,shanghai,sanghay,shenzhen,guangzhou,hong kong" },
  { iso: "JP", tr: "Japonya", en: "Japan", dial: "81", mask: "## #### ####", min: 9, trunk: "0", places: "japonya,japan,tokyo,osaka,kyoto,yokohama,nagoya" },
  { iso: "KR", tr: "Güney Kore", en: "South Korea", dial: "82", mask: "## #### ####", min: 9, trunk: "0", places: "guney kore,south korea,korea,seoul,seul,busan" },
  { iso: "SG", tr: "Singapur", en: "Singapore", dial: "65", mask: "#### ####", places: "singapur,singapore" },
  { iso: "MY", tr: "Malezya", en: "Malaysia", dial: "60", mask: "## ### ####", min: 8, trunk: "0", places: "malezya,malaysia,kuala lumpur,penang" },
  { iso: "ID", tr: "Endonezya", en: "Indonesia", dial: "62", mask: "### #### ####", min: 9, trunk: "0", places: "endonezya,indonesia,jakarta,bali,surabaya" },
  { iso: "TH", tr: "Tayland", en: "Thailand", dial: "66", mask: "## ### ####", trunk: "0", places: "tayland,thailand,bangkok,phuket,chiang mai" },
  { iso: "PH", tr: "Filipinler", en: "Philippines", dial: "63", mask: "### ### ####", trunk: "0", places: "filipinler,philippines,manila,cebu" },
  { iso: "VN", tr: "Vietnam", en: "Vietnam", dial: "84", mask: "## ### ## ##", min: 9, trunk: "0", places: "vietnam,hanoi,ho chi minh,saigon" },
  { iso: "AU", tr: "Avustralya", en: "Australia", dial: "61", mask: "### ### ###", trunk: "0", places: "avustralya,australia,sydney,melbourne,brisbane,perth,adelaide,canberra" },
  { iso: "NZ", tr: "Yeni Zelanda", en: "New Zealand", dial: "64", mask: "## ### ####", min: 8, trunk: "0", places: "yeni zelanda,new zealand,auckland,wellington,christchurch" },
  { iso: "BR", tr: "Brezilya", en: "Brazil", dial: "55", mask: "## ##### ####", min: 10, trunk: "0", places: "brezilya,brazil,sao paulo,rio de janeiro,brasilia,salvador" },
  { iso: "MX", tr: "Meksika", en: "Mexico", dial: "52", mask: "## #### ####", places: "meksika,mexico,mexico city,guadalajara,monterrey,cancun" },
  { iso: "AR", tr: "Arjantin", en: "Argentina", dial: "54", mask: "## #### ####", places: "arjantin,argentina,buenos aires,cordoba" },
  { iso: "CL", tr: "Şili", en: "Chile", dial: "56", mask: "# #### ####", places: "sili,chile,santiago" },
  { iso: "CO", tr: "Kolombiya", en: "Colombia", dial: "57", mask: "### ### ####", places: "kolombiya,colombia,bogota,medellin" },
  { iso: "PE", tr: "Peru", en: "Peru", dial: "51", mask: "### ### ###", places: "peru,lima" },
];

export const DEFAULT_COUNTRY = "TR";

export const countryByIso = (iso: string): CountryPhone => COUNTRIES.find((c) => c.iso === iso) ?? COUNTRIES[0];

/** Karşılaştırma için: küçük harf + Türkçe/aksanlı harfleri sadeleştir. */
function fold(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

let placeIndex: Map<string, string> | null = null;
function buildIndex(): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of COUNTRIES) {
    for (const p of c.places.split(",")) {
      const k = fold(p);
      // Aynı ad iki ülkede varsa ilk yazılan (daha yaygın) kazanır; "Georgia" Gürcistan yerine ABD olmasın diye ülke adları ayrı tutulur.
      if (k && !m.has(k)) m.set(k, c.iso);
    }
  }
  return m;
}

/** "Londra, UK" / "Berlin" / "İstanbul" → ülke kodu; bulunamazsa null. */
export function countryFromCity(city: string): string | null {
  const text = fold(city);
  if (!text) return null;
  placeIndex ??= buildIndex();
  // Sondan başa: "Şehir, Ülke" biçiminde ülke sondadır ve daha güvenilirdir.
  const tokens = text.split(/[,/;|()]|\s-\s|\s–\s/).map((t) => t.trim()).filter(Boolean).reverse();
  for (const t of tokens) {
    const hit = placeIndex.get(t);
    if (hit) return hit;
  }
  // Tek parça yazıldıysa ("New York USA"): son kelime/iki kelime ülke olabilir.
  const words = text.split(/\s+/);
  for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
    const hit = placeIndex.get(words.slice(-n).join(" "));
    if (hit) return hit;
  }
  return null;
}

// ── Biçimlendirme ──────────────────────────────────────────────────────────

const maxDigits = (c: CountryPhone): number => (c.mask.match(/#/g) ?? []).length;

/** Rakamları kalıba yerleştirir; rakam bittiği yerde durur (sondaki ayraç kalmaz). */
export function applyMask(digits: string, mask: string): string {
  let out = "";
  let i = 0;
  for (const ch of mask) {
    if (i >= digits.length) break;
    if (ch === "#") out += digits[i++];
    else out += ch;
  }
  return out.replace(/[\s\-(]+$/, "").replace(/\($/, "");
}

/** Ulusal numara için temizlenmiş rakamlar (yerel "0" ön eki atılır, uzunluk sınırlanır). */
export function nationalDigits(raw: string, c: CountryPhone): string {
  let d = raw.replace(/\D/g, "");
  if (c.trunk && d.startsWith(c.trunk)) d = d.slice(c.trunk.length);
  return d.slice(0, maxDigits(c));
}

export function formatNational(raw: string, c: CountryPhone): string {
  return applyMask(nationalDigits(raw, c), c.mask);
}

/** Alana yazılan ulusal metni, saklanacak uluslararası biçime çevirir. Boşsa "". */
export function composePhone(national: string, c: CountryPhone): string {
  const f = formatNational(national, c);
  return f ? `+${c.dial} ${f}` : "";
}

const DIAL_SORTED = [...new Set(COUNTRIES.map((c) => c.dial))].sort((a, b) => b.length - a.length);

/** Saklı değeri ülke + ulusal numaraya ayırır. "+" ile başlamıyorsa varsayılan ülke varsayılır. */
export function parsePhone(value: string, fallbackIso: string = DEFAULT_COUNTRY): { country: CountryPhone; national: string } {
  const v = value.trim();
  if (v.startsWith("+") || v.startsWith("00")) {
    const digits = v.replace(/\D/g, "").replace(/^00/, "");
    for (const dial of DIAL_SORTED) {
      if (digits.startsWith(dial)) {
        const sameDial = COUNTRIES.filter((c) => c.dial === dial);
        const fb = sameDial.find((c) => c.iso === fallbackIso);
        const country = fb ?? sameDial[0];
        return { country, national: nationalDigits(digits.slice(dial.length), country) };
      }
    }
  }
  const country = countryByIso(fallbackIso);
  return { country, national: nationalDigits(v, country) };
}

/** Ulusal numara eksik mi? (CV uyarısı için). Bilinmeyen/serbest metinde null döner. */
export function phoneLooksIncomplete(value: string): boolean | null {
  const v = value.trim();
  if (!v) return null;
  if (!v.startsWith("+")) return null;
  const { country, national } = parsePhone(v);
  const need = country.min ?? maxDigits(country);
  return national.length < need;
}
