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
    const { email, doctorName, name, revokeReason } = await request.json();
    const resolvedName = name || doctorName;

    if (!email || !resolvedName || !revokeReason) {
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
      subject: 'OptiTrace Medical Access Revoked',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #d9534f;">Medical Access Revoked</h2>
          <p>Dear ${escapeHtml(resolvedName)},</p>
          <p>This is an automated notification to inform you that your doctor access privileges for OptiTrace have been revoked by administration.</p>
          <p><strong>Reason provided by the administrator:</strong></p>
          <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px; margin: 8px 0 16px 0;">
            ${escapeHtml(revokeReason)}
          </div>
          <p>Your account has been reverted to a standard user state. If you believe this action was taken in error, please contact our support team immediately.</p>
          <br/>
          <p>Sincerely,</p>
          <p><strong>OptiTrace Administration</strong></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: 'Failed to send automated email' }, { status: 500 });
  }
}
