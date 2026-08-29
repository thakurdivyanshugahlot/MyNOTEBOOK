import { realtime, staticSchema } from "inngest";

export const queryChannel = realtime.channel({
  name: ({ requestId }) => `query:${requestId}`,

  topics: {
    token: {
      schema: staticSchema(),
    },

    done: {
      schema: staticSchema(),
    },

    error: {
      schema: staticSchema(),
    },
  },
});