import { GoogleGenAI } from "@google/genai";

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return Response.json({ error: "Prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "GEMINI_API_KEY is not set" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt,
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts;

    // Find the part that contains the image data
    const imagePart = parts?.find((p) => p.inlineData);

    if (!imagePart?.inlineData) {
      console.error("Gemini Image Generation Failed. Full Response:", JSON.stringify(response, null, 2));

      // Check for error finish reasons (SAFETY, RECITATION, etc.)
      // STOP is the normal completion status, not an error
      if (candidate?.finishReason && candidate.finishReason !== "STOP") {
        return Response.json({
          error: `Generation blocked with reason: ${candidate.finishReason}`,
          details: response
        }, { status: 500 });
      }

      return Response.json({
        error: "No image data found in response. The model may have returned only text.",
        details: response
      }, { status: 500 });
    }

    return Response.json({
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || "image/png",
    });

  } catch (error) {
    console.error("Gemini image generation error:", error);
    return Response.json(
      { 
        error: error instanceof Error ? error.message : "Failed to generate image",
        details: error
      },
      { status: 500 }
    );
  }
}
