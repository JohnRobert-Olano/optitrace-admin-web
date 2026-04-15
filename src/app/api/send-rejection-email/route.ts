import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: Request) {
  try {
    const { email, name, rejectionReason } = await request.json();

    if (!email || !name || !rejectionReason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"OptiTrace Admin" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Update on Your OptiTrace Verification Request',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #d9534f;">Verification Request Not Approved</h2>
          <p>Dear ${escapeHtml(name)},</p>
          <p>Thank you for your interest in joining OptiTrace as a verified medical professional.</p>
          <p>After reviewing your submission, we are unable to approve your verification request at this time.</p>
          <p><strong>Reason provided by the administrator:</strong></p>
          <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px; margin: 8px 0 16px 0;">
            ${escapeHtml(rejectionReason)}
          </div>
          <p>Please review this feedback and reapply when ready.</p>
          <br/>
          <p>Sincerely,</p>
          <p><strong>OptiTrace Administration</strong></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error sending rejection email:', error);
    return NextResponse.json({ error: 'Failed to send rejection email' }, { status: 500 });
  }
}
