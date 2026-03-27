const OPENROUTER_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";

function extractTranscript(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          "text" in part &&
          (part as { type?: string }).type === "text"
        ) {
          return String((part as { text: string }).text);
        }

        return "";
      })
      .join(" ")
      .trim();
  }

  return "";
}

export async function transcribeAudioWithOpenRouter(params: {
  audioBase64: string;
  format: string;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }

  const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a speech-to-text engine. Return only the transcription of the user's audio, with no commentary or formatting.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcribe this audio exactly. Return only the transcript.",
            },
            {
              type: "input_audio",
              input_audio: {
                data: params.audioBase64,
                format: params.format,
              },
            },
          ],
        },
      ],
    }),
  });

  const payload = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "OpenRouter transcription failed.");
  }

  const transcript = extractTranscript(payload.choices?.[0]?.message?.content);

  if (!transcript) {
    throw new Error("OpenRouter returned an empty transcript.");
  }

  return transcript;
}
