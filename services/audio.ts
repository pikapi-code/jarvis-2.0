// Helper to convert Blob to Base64
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (!result) {
        reject(new Error("Failed to read blob"));
        return;
      }
      // Remove data URL prefix (e.g., "data:audio/wav;base64,")
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper to decode base64 string to Uint8Array
function decodeBase64(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to play raw PCM data (standard for Gemini TTS)
// Gemini 2.5 TTS returns raw PCM 16-bit mono audio at 24kHz
// Helper to play raw PCM data (standard for Gemini TTS)
// Gemini 2.5 TTS returns raw PCM 16-bit mono audio at 24kHz
export const playAudioContent = async (base64Audio: string, sampleRate: number = 24000): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });

      const bytes = decodeBase64(base64Audio);

      // Gemini TTS returns raw PCM (Int16), not a container format like MP3/WAV.
      // We must manually decode the PCM data.

      // Create Int16Array from the buffer.
      // Ensure the byte length is even (it should be for 16-bit PCM).
      if (bytes.length % 2 !== 0) {
        console.warn("Audio data length is odd, truncating last byte for PCM16 decoding.");
      }
      const dataInt16 = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));

      const numChannels = 1;
      const frameCount = dataInt16.length;

      const audioBuffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);

      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
        // Normalize 16-bit integer to float [-1.0, 1.0]
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      source.onended = () => {
        source.disconnect();
        audioContext.close();
        resolve();
      };

      source.start(0);

    } catch (e) {
      console.error("Error playing audio", e);
      reject(e);
    }
  });
};