import pool from "./lib/db";
import { handleEmailVerification } from "./handleEmail";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const result = await register({ body: JSON.stringify(req.body) });
    res.status(result.statusCode).send(result.body);
  } catch (error) {
    console.error('Unexpected error in handler:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}


export async function register(event: { body: string }) {
    const client = await pool.connect();

    console.log("Register function invoked");

    try {
        console.log("Parsing request body...");
        const body = JSON.parse(event.body);
        const { email, password, username } = body;

        console.log("Request body parsed:", { email, username });

        if (!email || !password || !username) {
            console.warn("Missing required fields: email, password, or username");
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: "Email, password, and username are required",
                }),
            };
        }

        console.log("Checking if user already exists...");
        const existingUser = await client.query(
            `SELECT email FROM todo.users WHERE email = $1 OR username = $2;`,
            [email, username]
        );

        if (existingUser.rows.length > 0) {
            console.warn("User already exists with email or username:", { email, username });
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "Email or username already exists. Try logging in.",
                }),
            };
        }

        console.log("Checking if user is already pending verification...");
        const existingPending = await client.query(
            `SELECT email, created_at FROM todo.pending_users WHERE email = $1 OR username = $2;`,
            [email, username]
        );

        if (existingPending.rows.length > 0) {
            console.log("Pending verification found for user:", { email, username });
            const createdAt = new Date(existingPending.rows[0].created_at);
            const now = new Date();
            const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

            console.log("Time since pending verification created (minutes):", diffMinutes);

            if (diffMinutes < 15) {
                console.warn("Pending verification still valid for user:", { email, username });
                return {
                    statusCode: 409,
                    body: JSON.stringify({
                        error: "Account is already pending verification. Check your email.",
                    }),
                };
            }

            console.log("Pending verification expired. Deleting record...");
            await client.query(
                `DELETE FROM todo.pending_users WHERE email = $1 OR username = $2;`,
                [email, username]
            );
            console.log("Expired pending verification deleted.");
        }

        console.log("Sending verification email...");
        await handleEmailVerification(email, username, password, pool);
        console.log("Verification email sent successfully.");

        return {
            statusCode: 201,
            body: JSON.stringify({
                success: true,
                message: "Registration received. Verification email will be sent shortly.",
            }),
        };
    } catch (error) {
        console.error("Registration error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "An unexpected error occurred during registration" }),
        };
    } finally {
        console.log("Releasing database client...");
        client.release();
        console.log("Database client released.");
    }
}