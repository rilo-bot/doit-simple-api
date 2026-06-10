import { Router, type Request, type Response } from 'express';
import type { Db } from 'mongodb';
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';
import jwt from 'jsonwebtoken';
import type { User, OtpCode } from '../contract';
import { requireAuth, type AuthRequest } from '../middleware/auth';

const OTP_TTL_MINUTES = 10;

export function createAuthRouter(db: Db): Router {
  const router = Router();

  const users = db.collection<Omit<User, 'id'> & { _id?: unknown }>('users');
  const otpCodes = db.collection<Omit<OtpCode, 'id'> & { _id?: unknown }>('otp_codes');

  // ── POST /api/auth/request-code ──────────────────────────────────────────
  router.post('/request-code', async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'A valid email address is required' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Upsert user — create if first time, otherwise leave existing record.
    const now = new Date().toISOString();
    const existingUser = await users.findOne({ email: normalizedEmail });
    if (!existingUser) {
      await users.insertOne({
        id: crypto.randomUUID(),
        email: normalizedEmail,
        createdAt: now,
      });
    }

    // Invalidate any prior unexpired codes for this email.
    await otpCodes.deleteMany({ email: normalizedEmail });

    // Generate a 6-digit code.
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    await otpCodes.insertOne({
      id: crypto.randomUUID(),
      email: normalizedEmail,
      code,
      expiresAt,
      createdAt: now,
    });

    // Send email via SendGrid.
    const apiKey = process.env.EMAIL_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      res.status(500).json({ error: 'Email service is not configured' });
      return;
    }

    sgMail.setApiKey(apiKey);
    try {
      await sgMail.send({
        to: normalizedEmail,
        from,
        subject: 'Your DoIt Simple login code',
        text: `Your one-time login code is: ${code}\n\nIt expires in ${OTP_TTL_MINUTES} minutes.`,
        html: `
          <p>Your one-time login code for <strong>DoIt Simple</strong> is:</p>
          <h2 style="letter-spacing:4px">${code}</h2>
          <p>This code expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, you can safely ignore it.</p>
        `,
      });
    } catch (err) {
      console.error('SendGrid error:', (err as Error).message);
      res.status(502).json({ error: 'Failed to send email. Please try again.' });
      return;
    }

    res.json({ ok: true });
  });

  // ── POST /api/auth/verify-code ───────────────────────────────────────────
  router.post('/verify-code', async (req: Request, res: Response) => {
    const { email, code } = req.body as { email?: string; code?: string };

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'A valid email address is required' });
      return;
    }
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'A code is required' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const record = await otpCodes.findOne({ email: normalizedEmail });

    if (!record) {
      res.status(400).json({ error: 'No code found for this email. Please request a new one.' });
      return;
    }

    if (new Date(record.expiresAt) < new Date()) {
      await otpCodes.deleteOne({ email: normalizedEmail });
      res.status(400).json({ error: 'Code has expired. Please request a new one.' });
      return;
    }

    if (record.code !== code.trim()) {
      res.status(400).json({ error: 'Incorrect code. Please try again.' });
      return;
    }

    // Code is valid — consume it immediately.
    await otpCodes.deleteOne({ email: normalizedEmail });

    // Fetch the user (guaranteed to exist — created during request-code).
    const userDoc = await users.findOne({ email: normalizedEmail });
    if (!userDoc) {
      res.status(500).json({ error: 'User record not found. Please request a new code.' });
      return;
    }

    const user: User = {
      id: userDoc.id as string,
      email: userDoc.email as string,
      createdAt: userDoc.createdAt as string,
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
      return;
    }

    const token = jwt.sign(user, secret, { expiresIn: '30d' });

    res.json({ token, user });
  });

  // ── GET /api/auth/me ─────────────────────────────────────────────────────
  router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userDoc = await users.findOne({ id: userId });
    if (!userDoc) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user: User = {
      id: userDoc.id as string,
      email: userDoc.email as string,
      createdAt: userDoc.createdAt as string,
    };

    res.json(user);
  });

  return router;
}
