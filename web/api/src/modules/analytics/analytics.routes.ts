import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { attachOptionalAuth } from "../../middleware/auth.middleware.js";
import { journeyEventController, pageViewController } from "./analytics.controller.js";

export const analyticsRouter = Router();

analyticsRouter.post("/page-view", attachOptionalAuth, asyncHandler(pageViewController));
analyticsRouter.post("/event", attachOptionalAuth, asyncHandler(journeyEventController));
