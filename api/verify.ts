import pool from "./lib/db";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const result = await verify({ queryStringParameters: req.query });
    res.status(result.statusCode).send(result.body);
  } catch (error) {
    console.error('Unexpected error in handler:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function verify(event: { queryStringParameters: { token?: string } }) {
  const { token } = event.queryStringParameters;
  const client = await pool.connect();
  if (!token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Verification token is required." }),
    };
  }
  try {
    console.log("Starting verification process...");
    await client.query("BEGIN");
    const result = await client.query(
      `DELETE FROM todo.pending_users
      WHERE verification_code = $1
      AND created_at >= NOW() - INTERVAL '15 minutes'
      RETURNING email, username, password_hash;`,
      [token]
    );
    if (result.rows.length === 0) {
      console.warn("Invalid or expired verification token.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid or expired verification token." }),
      };
    }
    const { email, username, password_hash } = result.rows[0];
    const insertResult = await client.query(
      `INSERT INTO todo.users (user_id, email, username, password_hash, created_at)
      VALUES (todo.uuid_generate_v7(), $1, $2, $3, NOW())
      ON CONFLICT (email, username) DO NOTHING
      RETURNING user_id;`,
      [email, username, password_hash]
    );

    if (insertResult.rows.length === 0) {
      console.warn("User is already verified.");
      return {
        statusCode: 409,
        body: JSON.stringify({ error: "User is already verified." }),
      };
    }
    await client.query("COMMIT");
    console.log("User verified successfully.");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "User verified successfully." }),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Verification error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "An unexpected error occurred during verification." }),
    };
  } finally {
    client.release();
  }
}