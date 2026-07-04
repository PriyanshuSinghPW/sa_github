// language.js

// Always use English only
export let currentLang = 'en';

let translations = {};

export async function loadTranslations(path = 'wordsearch-translations.json') {
  console.log("[i18n] Loading translations from", path);
  const res = await fetch(path);
  translations = await res.json();
  return translations;
}

export function translateUI() {
  if (!translations[currentLang]) {
    console.warn("[i18n] No translations found for", currentLang);
    return;
  }

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[currentLang][key]) {
      el.innerText = translations[currentLang][key];
    }
  });

  // Translate <option> elements
  document.querySelectorAll('option[value]').forEach(opt => {
    const val = opt.value;
    if (translations[currentLang][val]) {
      opt.innerText = translations[currentLang][val];
    }
  });
}
