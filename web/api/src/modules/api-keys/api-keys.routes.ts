import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
  createApiKeyController,
  listApiKeysController,
  revokeApiKeyController,
} from "./api-keys.controller.js";

export const apiKeysRouter = Router();

apiKeysRouter.get("/", requireAuth, asyncHandler(listApiKeysController));
apiKeysRouter.post("/", requireAuth, asyncHandler(createApiKeyController));
apiKeysRouter.delete("/:id", requireAuth, asyncHandler(revokeApiKeyController));
