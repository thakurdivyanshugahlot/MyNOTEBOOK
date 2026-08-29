import { realtime, staticSchema } from "inngest";

export const queryChannel = realtime.channel({
  name: ({ requestId }: { requestId: string }) =>
    `query:${requestId}`,

  topics: {
    token: {
      schema: staticSchema<{
        content: string;
      }>(),
    },

    done: {
      schema: staticSchema<{
        citations: unknown[];
      }>(),
    },

    error: {
      schema: staticSchema<{
        message: string;
      }>(),
    },
  },
});