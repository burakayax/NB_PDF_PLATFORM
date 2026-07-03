import { Router } from "express";
import express from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { apiKeyAuth } from "./v1.middleware.js";
import {
  v1MeController,
  v1SummarizeController,
  v1ExtractController,
  v1TranslateController,
} from "./v1.controller.js";

/** B2B programatik API — API anahtarıyla kimlik doğrulanır (JWT DEĞİL). */
export const v1Router = Router();

// Büyük metinler için gövde sınırı yükseltilir.
v1Router.use(express.json({ limit: "2mb" }));
v1Router.use(asyncHandler(apiKeyAuth));

v1Router.get("/me", asyncHandler(v1MeController));
v1Router.post("/summarize", asyncHandler(v1SummarizeController));
v1Router.post("/extract", asyncHandler(v1ExtractController));
v1Router.post("/translate", asyncHandler(v1TranslateController));
