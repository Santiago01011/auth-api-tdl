import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { sendVerificationEmail } from "./lib/email";

export async function handleEmailVerification(
  email: string,
  username: string,
  password: string,
  pool: Pool
) {
  try {
    const pepper = process.env.PEPPER_SECRET;
    if (!pepper) {
      throw new Error("PEPPER_SECRET is missing from environment variables!");
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password + pepper, salt);
    const verificationToken = randomBytes(10).toString("hex");
    console.log("Sending verification email...");
    await sendVerificationEmail(email, verificationToken);
    console.log("Verification email sent to:", email);
    await pool.query(
      "INSERT INTO todo.pending_users (pending_id, username, email, password_hash, created_at, verification_code) VALUES (todo.uuid_generate_v7(), $1, $2, $3, NOW(), $4);",
      [username, email, hashedPassword, verificationToken]
    );
  } catch (error) {
    console.error("Error in email verification process:", error);
    throw error;
  }
}