import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { checkAccessController } from "./access.controller.js";

export const accessRouter = Router();

accessRouter.post("/check", asyncHandler(checkAccessController));
