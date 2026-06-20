import { createContext, useCallback, useContext, useState } from 'react'

// Lightweight i18n for Chennai relevance: English + Tamil. Keys are semantic;
// any screen can adopt t() incrementally. Missing keys fall back to English,
// then to the key itself, so partial coverage never breaks the UI.
const DICT = {
  en: {
    'nav.plan': 'Plan',
    'nav.home': 'Home',
    'nav.trips': 'Trips',
    'nav.profile': 'Profile',
    'nav.safety': 'Safety',
    'nav.safeMode': 'Safe Mode',

    'home.greeting': 'Where to?',
    'home.greetingName': 'Where to, {name}?',
    'home.subtitle': 'Compare metro, train, bus and auto — by time, cost and safety.',
    'home.from': 'Where are you?',
    'home.to': 'Where to?',
    'home.now': 'Now',
    'home.schedule': 'Schedule',
    'home.recent': 'Recent',
    'home.safeTitle': 'Women Safety Mode',
    'home.safeDesc': 'Re-routes using real crime data',
    'home.find': 'Find Routes →',
    'home.protect.guardianOn': 'Audio Guardian listening',
    'home.protect.guardianStart': 'Audio Guardian starting…',
    'home.protect.guardianErr': 'Mic blocked — tap Activate',
    'home.protect.crime': 'Crime-aware routing',
    'home.protect.havens': 'Safe-havens on map',
    'home.protect.safeWalk': 'Safe-Walk last-mile',

    'mode.bus': 'Bus',
    'mode.metro': 'Metro',
    'mode.train': 'Train',
    'mode.auto': 'Auto',
    'mode.walk': 'Walk',

    'guardian.title': 'AI Audio Guardian',
    'guardian.idle': 'Turns on with Safe Mode · auto-SOS on scream',
    'guardian.active': 'On-device AI listening for distress',
    'guardian.activate': 'Activate',
    'guardian.stop': 'Stop',
    'guardian.sensitivity': 'Sensitivity',
    'guardian.test': 'Test alert',
    'guardian.privacy': 'Runs fully on your device — no audio is recorded or leaves your phone.',

    'profile.language': 'Language',

    'sort.best': 'Best',
    'sort.fastest': 'Fastest',
    'sort.safest': 'Safest',
    'sort.cheapest': 'Cheapest',
    'results.compare': 'Compare',
    'results.list': 'List',
    'results.recommended': 'Recommended',
    'results.departingNow': 'Departing now',
    'results.departingAt': 'Departing {time}',
    'results.finding': 'finding routes…',
    'results.routeFound': '{n} {mode}route found',
    'results.routesFound': '{n} {mode}routes found',
    'reco.best': 'Recommended — Best Overall',
    'reco.fastest': 'Recommended — Fastest Route',
    'reco.safest': 'Recommended — Safest Route',
    'reco.cheapest': 'Recommended — Cheapest Route',

    'card.min': 'min',
    'card.total': 'total',
    'card.departsNow': 'Departs now',
    'card.departsIn': 'Departs in {n} min',
    'card.next': 'Next',
    'card.transfer': '{n} transfer',
    'card.transfers': '{n} transfers',
    'card.fixedFare': 'Fixed fare · no surge',
    'card.saves': 'Saves {v} CO₂',

    'map.routeDetails': 'Route Details',
    'map.totalTime': 'Total time',
    'map.estFare': 'Est. fare',
    'map.safetyScore': 'Safety score',

    'safety.title': 'Safety Center',
    'safety.subtitle': 'Your contacts, helplines and escape tools',
    'safety.call112': 'Call 112',
    'safety.shareLoc': 'Share location',
    'safety.shared': 'Shared',
    'safety.fakeCall': 'Fake call',
    'safety.helplines': 'Helplines',
    'safety.trusted': 'Trusted contacts',
    'safety.voiceWord': 'Voice safe word',
  },
  ta: {
    'nav.plan': 'திட்டம்',
    'nav.home': 'முகப்பு',
    'nav.trips': 'பயணங்கள்',
    'nav.profile': 'சுயவிவரம்',
    'nav.safety': 'பாதுகாப்பு',
    'nav.safeMode': 'பாதுகாப்பு முறை',

    'home.greeting': 'எங்கே செல்ல வேண்டும்?',
    'home.greetingName': '{name}, எங்கே செல்ல வேண்டும்?',
    'home.subtitle': 'மெட்ரோ, ரயில், பேருந்து, ஆட்டோ — நேரம், கட்டணம், பாதுகாப்பு அடிப்படையில் ஒப்பிடுங்கள்.',
    'home.from': 'நீங்கள் எங்கே இருக்கிறீர்கள்?',
    'home.to': 'எங்கே செல்ல வேண்டும்?',
    'home.now': 'இப்போது',
    'home.schedule': 'திட்டமிடு',
    'home.recent': 'சமீபத்தியவை',
    'home.safeTitle': 'பெண்கள் பாதுகாப்பு முறை',
    'home.safeDesc': 'உண்மையான குற்றத் தரவைப் பயன்படுத்தி பாதையை மாற்றுகிறது',
    'home.find': 'பாதைகளைக் கண்டறி →',
    'home.protect.guardianOn': 'ஒலி காவலர் கேட்கிறது',
    'home.protect.guardianStart': 'ஒலி காவலர் தொடங்குகிறது…',
    'home.protect.guardianErr': 'மைக் தடைபட்டது — இயக்கு',
    'home.protect.crime': 'குற்றம் அறிந்த பாதை',
    'home.protect.havens': 'வரைபடத்தில் பாதுகாப்பு இடங்கள்',
    'home.protect.safeWalk': 'கடைசி-மைல் பாதுகாப்பு நடை',

    'mode.bus': 'பேருந்து',
    'mode.metro': 'மெட்ரோ',
    'mode.train': 'ரயில்',
    'mode.auto': 'ஆட்டோ',
    'mode.walk': 'நடை',

    'guardian.title': 'AI ஒலி காவலர்',
    'guardian.idle': 'பாதுகாப்பு முறையுடன் இயங்கும் · கத்தினால் SOS',
    'guardian.active': 'சாதனத்தில் AI ஆபத்தைக் கேட்கிறது',
    'guardian.activate': 'இயக்கு',
    'guardian.stop': 'நிறுத்து',
    'guardian.sensitivity': 'உணர்திறன்',
    'guardian.test': 'சோதனை எச்சரிக்கை',
    'guardian.privacy': 'முழுவதும் உங்கள் சாதனத்தில் இயங்கும் — ஒலி பதிவு செய்யப்படாது, வெளியேறாது.',

    'profile.language': 'மொழி',

    'sort.best': 'சிறந்தது',
    'sort.fastest': 'வேகமானது',
    'sort.safest': 'பாதுகாப்பானது',
    'sort.cheapest': 'மலிவானது',
    'results.compare': 'ஒப்பிடு',
    'results.list': 'பட்டியல்',
    'results.recommended': 'பரிந்துரை',
    'results.departingNow': 'இப்போது புறப்படுகிறது',
    'results.departingAt': '{time} மணிக்கு புறப்படும்',
    'results.finding': 'பாதைகளைத் தேடுகிறது…',
    'results.routeFound': '{n} {mode}பாதை கிடைத்தது',
    'results.routesFound': '{n} {mode}பாதைகள் கிடைத்தன',
    'reco.best': 'பரிந்துரை — மொத்தத்தில் சிறந்தது',
    'reco.fastest': 'பரிந்துரை — வேகமான பாதை',
    'reco.safest': 'பரிந்துரை — பாதுகாப்பான பாதை',
    'reco.cheapest': 'பரிந்துரை — மலிவான பாதை',

    'card.min': 'நிமி',
    'card.total': 'மொத்தம்',
    'card.departsNow': 'இப்போது புறப்படும்',
    'card.departsIn': '{n} நிமிடத்தில் புறப்படும்',
    'card.next': 'அடுத்து',
    'card.transfer': '{n} மாற்றம்',
    'card.transfers': '{n} மாற்றங்கள்',
    'card.fixedFare': 'நிலையான கட்டணம் · சர்ஜ் இல்லை',
    'card.saves': '{v} CO₂ சேமிக்கும்',

    'map.routeDetails': 'பாதை விவரங்கள்',
    'map.totalTime': 'மொத்த நேரம்',
    'map.estFare': 'கட்டணம் (மதிப்பீடு)',
    'map.safetyScore': 'பாதுகாப்பு மதிப்பெண்',

    'safety.title': 'பாதுகாப்பு மையம்',
    'safety.subtitle': 'உங்கள் தொடர்புகள், உதவி எண்கள், தப்பிக்கும் கருவிகள்',
    'safety.call112': '112 அழை',
    'safety.shareLoc': 'இருப்பிடம் பகிர்',
    'safety.shared': 'பகிரப்பட்டது',
    'safety.fakeCall': 'போலி அழைப்பு',
    'safety.helplines': 'உதவி எண்கள்',
    'safety.trusted': 'நம்பகமான தொடர்புகள்',
    'safety.voiceWord': 'குரல் பாதுகாப்பு சொல்',
  },
}

const LangContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('marg_lang') || 'en' } catch { return 'en' }
  })
  const setLanguage = useCallback((l) => {
    setLang(l)
    try { localStorage.setItem('marg_lang', l) } catch {}
  }, [])
  const t = useCallback(
    (key, vars) => {
      let s = DICT[lang]?.[key] ?? DICT.en[key] ?? key
      if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k])
      return s
    },
    [lang],
  )
  return <LangContext.Provider value={{ lang, setLanguage, t }}>{children}</LangContext.Provider>
}

export function useT() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useT must be used within LanguageProvider')
  return ctx
}
