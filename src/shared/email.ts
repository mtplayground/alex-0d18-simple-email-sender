export type EmailDraft = {
  recipient: string;
  subject: string;
  message: string;
};

export type SendEmailRequest = EmailDraft;

export type SendEmailSuccess = {
  ok: true;
  messageId: string;
};

export type SendEmailFailure = {
  ok: false;
  error: string;
};

export type SendEmailResponse = SendEmailSuccess | SendEmailFailure;
