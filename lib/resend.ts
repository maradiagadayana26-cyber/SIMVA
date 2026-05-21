import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;

class MockResend {
  emails = {
    async send(payload: any) {
      console.warn(`[Resend Sandbox Warning]: Send email called, but RESEND_API_KEY is not defined in the environment. Email details logged below:\n`, JSON.stringify(payload, null, 2));
      return {
        data: { id: `mock-email-${Date.now()}` },
        error: null
      };
    }
  }
}

export const resend = apiKey ? new Resend(apiKey) : (new MockResend() as unknown as Resend);
