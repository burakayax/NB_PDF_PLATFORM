import { prisma } from "../../lib/prisma.js";
import type { JourneyEventInput, PageViewInput } from "./analytics.schema.js";

type PageViewContext = {
  userId?: string;
  userAgent?: string;
};

export async function recordPageView(input: PageViewInput, context: PageViewContext = {}) {
  await prisma.pageView.create({
    data: {
      view: input.view,
      path: input.path,
      sessionId: input.sessionId,
      language: input.language,
      referrer: input.referrer || null,
      userAgent: context.userAgent || null,
      userId: context.userId || null,
    },
  });

  return {
    success: true,
  };
}

type JourneyEventContext = {
  userId?: string;
};

export async function recordJourneyEvent(input: JourneyEventInput, context: JourneyEventContext = {}) {
  await prisma.userJourneyEvent.create({
    data: {
      sessionId: input.sessionId,
      name: input.name,
      toolId: input.toolId || null,
      extra: input.extra ? JSON.stringify(input.extra) : null,
      userId: context.userId || null,
    },
  });

  return {
    success: true,
  };
}
