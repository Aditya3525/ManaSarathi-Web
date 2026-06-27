import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';

import { useAuthStore } from '../stores/authStore';

type FontFamilyOption =
  | 'system'
  | 'arial'
  | 'times'
  | 'georgia'
  | 'verdana'
  | 'roboto'
  | 'openSans'
  | 'lato'
  | 'inter'
  | 'poppins'
  | 'montserrat'
  | 'workSans'
  | 'nunito'
  | 'helvetica';

export type ColorPaletteOption = 
  | 'default'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'lavender'
  | 'neutral';

type BooleanAccessibilitySettingKey = 'largeText' | 'highContrast' | 'screenReader' | 'reducedMotion' | 'voiceGuidance' | 'darkMode' | 'simpleLanguage';

export interface AccessibilitySettings {
  largeText: boolean;
  highContrast: boolean;
  screenReader: boolean;
  reducedMotion: boolean;
  voiceGuidance: boolean;
  darkMode: boolean;
  simpleLanguage: boolean;
  fontFamily: FontFamilyOption;
  colorPalette: ColorPaletteOption;
}

interface AccessibilityContextValue {
  settings: AccessibilitySettings;
  setSetting: (key: BooleanAccessibilitySettingKey, value: boolean, options?: FeedbackOptions) => void;
  toggleSetting: (key: BooleanAccessibilitySettingKey, options?: FeedbackOptions) => void;
  setFontFamily: (font: FontFamilyOption, options?: FeedbackOptions) => void;
  setColorPalette: (palette: ColorPaletteOption, options?: FeedbackOptions) => void;
  resetSettings: () => void;
  announce: (message: string) => void;
  speak: (message: string) => void;
  isVoiceGuidanceSupported: boolean;
}

interface FeedbackOptions {
  announce?: string;
  speak?: string;
}

const STORAGE_KEY = 'mw-accessibility-settings-v1';

const resolveStorageKey = (userId?: string | null): string => {
  if (!userId) {
    return STORAGE_KEY;
  }

  return `${STORAGE_KEY}:${userId}`;
};

const defaultSettings: AccessibilitySettings = {
  largeText: false,
  highContrast: false,
  screenReader: false,
  reducedMotion: false,
  voiceGuidance: false,
  darkMode: false,
  simpleLanguage: false,
  fontFamily: 'system',
  colorPalette: 'forest'
};

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(undefined);

const CLASS_MAP: Record<BooleanAccessibilitySettingKey, string | null> = {
  largeText: 'a11y-large-text',
  highContrast: 'a11y-high-contrast',
  screenReader: 'a11y-screen-reader',
  reducedMotion: 'a11y-reduced-motion',
  voiceGuidance: null,
  darkMode: null,
  simpleLanguage: null
};

const FONT_MAP: Record<FontFamilyOption, { stack: string | null; label: string }> = {
  system: {
    stack: null,
    label: 'System default'
  },
  arial: {
    stack: '"Arial", "Helvetica Neue", Helvetica, sans-serif',
    label: 'Arial'
  },
  times: {
    stack: '"Times New Roman", Times, serif',
    label: 'Times New Roman'
  },
  georgia: {
    stack: '"Georgia", "Times New Roman", serif',
    label: 'Georgia'
  },
  verdana: {
    stack: '"Verdana", "Geneva", sans-serif',
    label: 'Verdana'
  },
  roboto: {
    stack: '"Roboto", "Helvetica Neue", Helvetica, Arial, sans-serif',
    label: 'Roboto'
  },
  openSans: {
    stack: '"Open Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    label: 'Open Sans'
  },
  lato: {
    stack: '"Lato", "Helvetica Neue", Helvetica, Arial, sans-serif',
    label: 'Lato'
  },
  inter: {
    stack: '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif',
    label: 'Inter'
  },
  poppins: {
    stack: '"Poppins", "Helvetica Neue", Helvetica, Arial, sans-serif',
    label: 'Poppins'
  },
  montserrat: {
    stack: '"Montserrat", "Helvetica Neue", Helvetica, Arial, sans-serif',
    label: 'Montserrat'
  },
  workSans: {
    stack: '"Work Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
    label: 'Work Sans'
  },
  nunito: {
    stack: '"Nunito", "Helvetica Neue", Helvetica, Arial, sans-serif',
    label: 'Nunito'
  },
  helvetica: {
    stack: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    label: 'Helvetica'
  }
};

const loadStoredSettings = (storageKey: string): AccessibilitySettings => {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<AccessibilitySettings>;
    let fontFamily = parsed.fontFamily ?? defaultSettings.fontFamily;
    if (!(fontFamily in FONT_MAP)) {
      fontFamily = defaultSettings.fontFamily;
    }

    let colorPalette = parsed.colorPalette ?? defaultSettings.colorPalette;
    const validPalettes: ColorPaletteOption[] = ['default', 'ocean', 'forest', 'sunset', 'lavender', 'neutral'];
    if (!validPalettes.includes(colorPalette) || colorPalette === 'default') {
      colorPalette = 'forest';
    }

    return { ...defaultSettings, ...parsed, fontFamily, colorPalette };
  } catch (error) {
    console.warn('Unable to parse stored accessibility settings', error);
    return defaultSettings;
  }
};

const getInitialSettings = (storageKey: string): AccessibilitySettings => {
  const stored = loadStoredSettings(storageKey);
  if (stored.reducedMotion) return stored;

  if (typeof window !== 'undefined') {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return { ...stored, reducedMotion: true };
    }
  }

  return stored;
};

interface AccessibilityProviderProps {
  children: ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  const activeUserId = useAuthStore((state) => state.user?.id ?? null);
  const storageKey = useMemo(() => resolveStorageKey(activeUserId), [activeUserId]);
  const [settings, setSettings] = useState<AccessibilitySettings>(() => getInitialSettings(storageKey));
  const [liveMessage, setLiveMessage] = useState('');
  const liveMessageRef = useRef<HTMLDivElement | null>(null);

  const isVoiceGuidanceSupported = useMemo(() => typeof window !== 'undefined' && 'speechSynthesis' in window, []);
  const previousDarkMode = useRef(settings.darkMode);
  const themeTransitionTimeout = useRef<number | null>(null);

  const applySettingsToDom = useCallback((next: AccessibilitySettings) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    (Object.keys(CLASS_MAP) as BooleanAccessibilitySettingKey[]).forEach((key) => {
      const className = CLASS_MAP[key];
      if (!className) return;
      if (next[key]) {
        root.classList.add(className);
      } else {
        root.classList.remove(className);
      }
    });

    if (next.screenReader) {
      root.setAttribute('data-screen-reader', 'on');
    } else {
      root.removeAttribute('data-screen-reader');
    }

    if (next.darkMode) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }

    // Apply color palette
    if (next.colorPalette && next.colorPalette !== 'default') {
      root.setAttribute('data-color-palette', next.colorPalette);
    } else {
      root.removeAttribute('data-color-palette');
    }

    const fontEntry = FONT_MAP[next.fontFamily] ?? FONT_MAP.system;
    const resolvedStack = fontEntry.stack;

    if (resolvedStack) {
      root.style.setProperty('--default-font-family', resolvedStack);
      root.style.setProperty('--font-sans', resolvedStack);
      root.style.setProperty('--font-serif', resolvedStack);
    } else {
      root.style.removeProperty('--default-font-family');
      root.style.removeProperty('--font-sans');
      root.style.removeProperty('--font-serif');
    }
    root.setAttribute('data-font-family', next.fontFamily);

    // Sync browser theme-color meta tag
    if (typeof document !== 'undefined') {
      const themeColors: Record<ColorPaletteOption, { light: string; dark: string }> = {
        forest: { light: '#f9fbf7', dark: '#0a1e14' },
        ocean: { light: '#f0f9ff', dark: '#0f172a' },
        sunset: { light: '#fff7ed', dark: '#1c0f0a' },
        lavender: { light: '#faf5ff', dark: '#1a0f25' },
        neutral: { light: '#fafaf9', dark: '#1a1a1a' },
        default: { light: '#f9fbf7', dark: '#0a1e14' }
      };

      const palette = next.colorPalette || 'forest';
      const resolvedColor = next.darkMode
        ? themeColors[palette]?.dark || '#0a1e14'
        : themeColors[palette]?.light || '#f9fbf7';

      let metaTag = document.querySelector('meta[name="theme-color"]');
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('name', 'theme-color');
        document.head.appendChild(metaTag);
      }
      metaTag.setAttribute('content', resolvedColor);
    }
  }, []);

  useEffect(() => {
    setSettings(getInitialSettings(storageKey));
  }, [storageKey]);

  useEffect(() => {
    applySettingsToDom(settings);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, JSON.stringify(settings));
    }
  }, [settings, applySettingsToDom, storageKey]);

  useEffect(() => {
    if (!liveMessage || !liveMessageRef.current) return;
    const node = liveMessageRef.current;
    node.textContent = liveMessage;

    const timer = window.setTimeout(() => {
      node.textContent = '';
      setLiveMessage('');
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [liveMessage]);

  const speak = useCallback((message: string) => {
    if (!message || !isVoiceGuidanceSupported) return;

    try {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.lang = document.documentElement.lang || 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('Voice guidance failed', error);
    }
  }, [isVoiceGuidanceSupported]);

  const announce = useCallback((message: string) => {
    if (!message) return;
    setLiveMessage(message);
    if (settings.voiceGuidance) {
      speak(message);
    }
  }, [settings.voiceGuidance, speak]);

  const previousVoiceGuidance = useRef(settings.voiceGuidance);
  useEffect(() => {
    if (settings.voiceGuidance && !previousVoiceGuidance.current) {
      speak('Voice guidance enabled. I will read key updates aloud.');
    }

    if (!settings.voiceGuidance && previousVoiceGuidance.current) {
      setLiveMessage('Voice guidance disabled');
    }

    previousVoiceGuidance.current = settings.voiceGuidance;
  }, [settings.voiceGuidance, speak]);

  const triggerThemeTransition = useCallback((type: 'sunrise' | 'sunset') => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    if (themeTransitionTimeout.current) {
      window.clearTimeout(themeTransitionTimeout.current);
    }

    root.setAttribute('data-theme-transition', type);
    themeTransitionTimeout.current = window.setTimeout(() => {
      root.removeAttribute('data-theme-transition');
      themeTransitionTimeout.current = null;
    }, 1200);
  }, []);

  useEffect(() => {
    if (previousDarkMode.current === settings.darkMode) return;
    triggerThemeTransition(settings.darkMode ? 'sunset' : 'sunrise');
    previousDarkMode.current = settings.darkMode;
  }, [settings.darkMode, triggerThemeTransition]);

  useEffect(() => {
    return () => {
      if (themeTransitionTimeout.current) {
        window.clearTimeout(themeTransitionTimeout.current);
      }
    };
  }, []);

  const setSetting = useCallback<AccessibilityContextValue['setSetting']>((key, value, options) => {
    if (key === 'voiceGuidance' && value && !isVoiceGuidanceSupported) {
      announce('Voice guidance is not supported in this browser');
      return;
    }

    setSettings((prev) => {
      if (prev[key] === value) return prev;
      return { ...prev, [key]: value };
    });

    if (options?.announce) {
      announce(options.announce.replace('{state}', value ? 'enabled' : 'disabled'));
    }

    if (options?.speak && value) {
      speak(options.speak);
    }
  }, [announce, speak, isVoiceGuidanceSupported]);

  const toggleSetting = useCallback<AccessibilityContextValue['toggleSetting']>((key, options) => {
    setSettings((prev) => {
      const nextValue = !prev[key];
      if (key === 'voiceGuidance' && nextValue && !isVoiceGuidanceSupported) {
        announce('Voice guidance is not supported in this browser');
        return prev;
      }

      if (options?.announce) {
        announce(options.announce.replace('{state}', nextValue ? 'enabled' : 'disabled'));
      }

      if (options?.speak && nextValue) {
        speak(options.speak);
      }

      return { ...prev, [key]: nextValue };
    });
  }, [announce, speak, isVoiceGuidanceSupported]);

  const setFontFamily = useCallback<AccessibilityContextValue['setFontFamily']>((font, options) => {
    setSettings((prev) => {
      if (prev.fontFamily === font) return prev;
      return { ...prev, fontFamily: font };
    });

    if (options?.announce) {
      const fontLabel = FONT_MAP[font]?.label ?? font;
      announce(options.announce.replace('{font}', fontLabel));
    }

    if (options?.speak) {
      const fontLabel = FONT_MAP[font]?.label ?? font;
      speak(options.speak.replace('{font}', fontLabel));
    }
  }, [announce, speak]);

  const setColorPalette = useCallback<AccessibilityContextValue['setColorPalette']>((palette, options) => {
    setSettings((prev) => {
      if (prev.colorPalette === palette) return prev;
      return { ...prev, colorPalette: palette };
    });

    if (options?.announce) {
      const paletteNames: Record<ColorPaletteOption, string> = {
        default: 'Default Wellness',
        ocean: 'Ocean Calm',
        forest: 'Forest Zen',
        sunset: 'Sunset Warmth',
        lavender: 'Lavender Peace',
        neutral: 'Neutral Balance'
      };
      const paletteName = paletteNames[palette] ?? palette;
      announce(options.announce.replace('{palette}', paletteName));
    }

    if (options?.speak) {
      const paletteNames: Record<ColorPaletteOption, string> = {
        default: 'Default Wellness',
        ocean: 'Ocean Calm',
        forest: 'Forest Zen',
        sunset: 'Sunset Warmth',
        lavender: 'Lavender Peace',
        neutral: 'Neutral Balance'
      };
      const paletteName = paletteNames[palette] ?? palette;
      speak(options.speak.replace('{palette}', paletteName));
    }
  }, [announce, speak]);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
    announce('Accessibility preferences reset to defaults');
  }, [announce]);

  const value = useMemo<AccessibilityContextValue>(() => ({
    settings,
    setSetting,
    toggleSetting,
    setFontFamily,
    setColorPalette,
    resetSettings,
    announce,
    speak,
    isVoiceGuidanceSupported
  }), [announce, isVoiceGuidanceSupported, resetSettings, setFontFamily, setColorPalette, setSetting, settings, speak, toggleSetting]);

  return (
    <AccessibilityContext.Provider value={value}>
      <div className="sr-only" aria-live="polite" aria-atomic="true" ref={liveMessageRef} />
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = (): AccessibilityContextValue => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};
