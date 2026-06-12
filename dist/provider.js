"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/provider.ts
var provider_exports = {};
__export(provider_exports, {
  createDevupAI: () => createDevupAI,
  devupai: () => devupai
});
module.exports = __toCommonJS(provider_exports);
var import_openai_compatible = require("@ai-sdk/openai-compatible");
function createDevupAI(options = {}) {
  const baseURL = (options.baseURL ?? "https://api.devupai.com/v1").replace(
    /\/+$/,
    ""
  );
  return (0, import_openai_compatible.createOpenAICompatible)({
    baseURL,
    name: "devupai",
    apiKey: options.apiKey ?? process.env.DEVUP_API_KEY ?? process.env.DEVUPAI_API_KEY,
    headers: options.headers
  });
}
var devupai = createDevupAI();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createDevupAI,
  devupai
});
