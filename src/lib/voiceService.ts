import { supabase } from "@/integrations/supabase/client";

export interface VoiceAssistantSettings {
  voice_enabled: boolean;
  voice_welcome_enabled: boolean;
  voice_time_in_enabled: boolean;
  voice_time_out_enabled: boolean;
  voice_error_enabled: boolean;
  voice_rate: number;
  voice_pitch: number;
  voice_volume: number;
}

export const defaultSettings: VoiceAssistantSettings = {
  voice_enabled: true,
  voice_welcome_enabled: true,
  voice_time_in_enabled: true,
  voice_time_out_enabled: true,
  voice_error_enabled: true,
  voice_rate: 1.0,
  voice_pitch: 1.0,
  voice_volume: 100,
};

// Fetch all settings dynamically
export async function getVoiceSettings(): Promise<VoiceAssistantSettings> {
  try {
    const { data, error } = await supabase.from("system_settings").select("key, value");
    if (error || !data) return defaultSettings;

    const settings = { ...defaultSettings };
    data.forEach((s) => {
      if (s.key === "voice_enabled") settings.voice_enabled = s.value === "true";
      else if (s.key === "voice_welcome_enabled") settings.voice_welcome_enabled = s.value === "true";
      else if (s.key === "voice_time_in_enabled") settings.voice_time_in_enabled = s.value === "true";
      else if (s.key === "voice_time_out_enabled") settings.voice_time_out_enabled = s.value === "true";
      else if (s.key === "voice_error_enabled") settings.voice_error_enabled = s.value === "true";
      else if (s.key === "voice_rate") settings.voice_rate = parseFloat(s.value) || 1.0;
      else if (s.key === "voice_pitch") settings.voice_pitch = parseFloat(s.value) || 1.0;
      else if (s.key === "voice_volume") settings.voice_volume = parseFloat(s.value) || 100;
    });
    return settings;
  } catch (e) {
    console.error("Failed to load voice settings", e);
    return defaultSettings;
  }
}

// Play custom MP3 from bucket or use TTS fallback
export async function playVoice(
  message: string,
  mp3FileName?: string,
  settingsTrigger?: keyof Omit<VoiceAssistantSettings, "voice_rate" | "voice_pitch" | "voice_volume">
) {
  const settings = await getVoiceSettings();

  // If globally disabled, do not play
  if (!settings.voice_enabled) return;

  // Check specific trigger switch
  if (settingsTrigger && !settings[settingsTrigger]) return;

  // 1. Try Custom MP3 play
  if (mp3FileName) {
    try {
      const publicUrl = supabase.storage.from("voice-assets").getPublicUrl(mp3FileName).data.publicUrl;
      // Head request or quick check if exists
      const testRes = await fetch(publicUrl, { method: "HEAD" });
      if (testRes.ok) {
        const audio = new Audio(publicUrl);
        audio.volume = settings.voice_volume / 100;
        await audio.play();
        return; // Success, skip TTS fallback
      }
    } catch (e) {
      console.warn(`Custom MP3 file (${mp3FileName}) could not be played, falling back to TTS`, e);
    }
  }

  // 2. TTS Fallback (Browser Speech Synthesis / Android Capacitor fallback)
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel(); // cancel any active speech

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = settings.voice_rate;
    utterance.pitch = settings.pitch || settings.voice_pitch;
    utterance.volume = settings.voice_volume / 100;

    // Retrieve voices
    const voices = window.speechSynthesis.getVoices();
    
    // Preferences: en-PH (Philippines Female / Male), fallback to en-US
    const preferredVoices = [
      "Google English Philippines",
      "Google English Philippines Male",
      "en-PH",
      "Google US English",
      "Microsoft David",
      "Microsoft Aria",
      "Microsoft Jenny",
      "en-US"
    ];

    let selectedVoice = null;
    for (const pref of preferredVoices) {
      selectedVoice = voices.find(v => v.name.includes(pref) || v.lang.toLowerCase() === pref.toLowerCase() || v.lang.startsWith(pref));
      if (selectedVoice) break;
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    } else {
      utterance.lang = "en-PH"; // standard browser fallback setting
    }

    window.speechSynthesis.speak(utterance);
  } else {
    // Platform Android Capacitor Native TTS fallback if Capacitor is imported or window.Capacitor is present
    const cap = (window as any).Capacitor;
    if (cap && cap.Plugins && cap.Plugins.TextToSpeech) {
      try {
        await cap.Plugins.TextToSpeech.speak({
          text: message,
          lang: "en-PH",
          rate: settings.voice_rate,
          pitch: settings.voice_pitch,
          volume: settings.voice_volume / 100,
        });
      } catch (e) {
        console.error("Capacitor Native TTS failed", e);
      }
    } else {
      console.warn("No Text-to-Speech API available on this device.");
    }
  }
}
