// src/provider.ts
import {
  createOpenAICompatible
} from "@ai-sdk/openai-compatible";
function createDevupAI(options = {}) {
  const baseURL = (options.baseURL ?? "https://api.devupai.com/v1").replace(
    /\/+$/,
    ""
  );
  return createOpenAICompatible({
    baseURL,
    name: "devupai",
    apiKey: options.apiKey ?? process.env.DEVUP_API_KEY ?? process.env.DEVUPAI_API_KEY,
    headers: options.headers
  });
}
var devupai = createDevupAI();
export {
  createDevupAI,
  devupai
};
