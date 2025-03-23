import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(email: string, token: string) {
  const publicApiUrl = process.env.PUBLIC_API_URL;
  if (!publicApiUrl) {
    throw new Error("PUBLIC_API_URL is missing from environment variables!");
  }

  const verificationLink = `${publicApiUrl}/verify?token=${token}`;

  try {
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "Verify Your Email Address",
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h1 style="color: #4CAF50;">Welcome to Todo App!</h1>
        <p>Thank you for signing up! Please click the button below to verify your email address:</p>
        <a href="${verificationLink}" style="text-decoration: none;">
        <button style="background-color: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">
          Verify Email
        </button>
        </a>
        <p>If the button above doesn't work, you can copy and paste the following token into the verification page:</p>
        <p style="font-weight: bold; font-size: 14px; background-color: #f4f4f4; padding: 10px; border-radius: 5px; display: inline-block;">${token}</p>
        <p>This link will expire in 15 minutes. If you did not sign up for Todo App, please ignore this email.</p>
        <p style="font-size: 12px; color: #999;">- The Todo App Team</p>
      </div>
      `,
    });
    return data;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send verification email");
  }
}
