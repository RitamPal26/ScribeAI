// check_models.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config(); // Load your .env file

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ No API Key found in .env");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    // Note: We use a generic model to access the client, 
    // but we are just listing availability here.
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    console.log("Checking available models for your API key...");
    
    // There isn't a direct listModels method exposed easily in the high-level SDK 
    // without using the model manager, so the fastest test is to try the 
    // three standard strings and see which one doesn't crash.
    
    const candidates = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash-001",
        "gemini-1.5-flash-002",
        "gemini-1.0-pro",
        "gemini-2.5-flash-lite"
    ];

    for (const modelName of candidates) {
        try {
            const m = genAI.getGenerativeModel({ model: modelName });
            // Try a tiny generation to prove it works
            await m.generateContent("Hello");
            console.log(`✅ AVAILABLE: ${modelName}`);
        } catch (e: any) {
            if (e.message.includes("404")) {
                console.log(`❌ NOT FOUND: ${modelName}`);
            } else {
                console.log(`⚠️ ERROR (${modelName}): ${e.message}`);
            }
        }
    }

  } catch (error) {
    console.error("Critical Error:", error);
  }
}

listModels();