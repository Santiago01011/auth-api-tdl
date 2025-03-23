import pool from "./lib/db"
import bcrypt from "bcryptjs"
import type { VercelRequest, VercelResponse } from '@vercel/node';


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const result = await login({ body: JSON.stringify(req.body) });
    res.status(result.statusCode).send(result.body);
  } catch (error) {
    console.error('Unexpected error in handler:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function login(event: { body: string }) {
  const client = await pool.connect();
  try {
    const body = JSON.parse(event.body);
    const { username, email, password } = body;
    if( (!email && !username) || !password ) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email or username and password are required" }),
      }
    }
    const result = await client.query(
      `SELECT user_id, password_hash FROM todo.users WHERE email = $1 OR username = $2;`,
      [email, username]
    );

    if (result.rows.length === 0) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid credentials" }) };
    }
    const password_hash = result.rows[0].password_hash;
    const valid = await bcrypt.compare(password + process.env.PEPPER_SECRET!, password_hash);
    if (!valid) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid credentials" }),
      }
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Login successful", user_id: result.rows[0].user_id })
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Login error:", error.stack || error.message)
    } else {
      console.error("Login error:", error)
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "An unexpected error occurred during login" }),
    }
  } finally {
    client.release()
  }
}
