import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { email, doctorName } = await request.json();

    if (!email || !doctorName) {
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
      subject: 'OptiTrace Medical Access Approved',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #28a745;">Medical Access Verified & Approved</h2>
          <p>Dear ${doctorName},</p>
          <p>Congratulations! This is an automated notification to inform you that your medical credentials have been successfully reviewed and verified by the OptiTrace administration team.</p>
          <p>Your account has been officially upgraded. You can now log into the OptiTrace app to access the complete Doctor Dashboard features.</p>
          <br/>
          <p>Thank you for joining our platform,</p>
          <p><strong>OptiTrace Administration</strong></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ message: 'Email sent successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: 'Failed to send automated email' }, { status: 500 });
  }
}
