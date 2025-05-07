import nodemailer from 'nodemailer';

// Email configuration
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || ''
  }
};

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);

// Send signup confirmation email
export async function sendSignupConfirmationEmail(email: string, name: string) {
  try {
    // Check if email credentials are provided
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('Email credentials not configured, skipping email send');
      return;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'church@example.com',
      to: email,
      subject: 'Welcome to Grace Church',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Grace Church, ${name}!</h2>
          <p>Thank you for creating an account with us. We're excited to have you as part of our community.</p>
          <p>With your new account, you can:</p>
          <ul>
            <li>Stay updated on upcoming events</li>
            <li>Listen to sermons online</li>
            <li>Make donations securely</li>
            <li>Connect with our church community</li>
          </ul>
          <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
          <p>Blessings,<br/>Grace Church Team</p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

// Send password reset email
export async function sendPasswordResetEmail(email: string, resetToken: string) {
  try {
    // Check if email credentials are provided
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('Email credentials not configured, skipping email send');
      return;
    }

    const resetUrl = `${process.env.WEBSITE_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'church@example.com',
      to: email,
      subject: 'Password Reset Request - Grace Church',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>You recently requested to reset your password for your Grace Church account. Click the button below to reset it.</p>
          <p style="text-align: center; margin: 20px 0;">
            <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Reset Password</a>
          </p>
          <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
          <p>This link is valid for 1 hour.</p>
          <p>Blessings,<br/>Grace Church Team</p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
}

// Send contact form confirmation email
export async function sendContactConfirmationEmail(email: string, name: string) {
  try {
    // Check if email credentials are provided
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('Email credentials not configured, skipping email send');
      return;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'church@example.com',
      to: email,
      subject: 'We Received Your Message - Grace Church',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Thank You for Contacting Us, ${name}!</h2>
          <p>We have received your message and will get back to you as soon as possible.</p>
          <p>If your inquiry is urgent, please call us at (123) 456-7890.</p>
          <p>Blessings,<br/>Grace Church Team</p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Contact confirmation email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('Failed to send contact confirmation email:', error);
    throw error;
  }
}

// Send donation receipt email
export async function sendDonationReceiptEmail(email: string, name: string, amount: number, date: Date) {
  try {
    // Check if email credentials are provided
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('Email credentials not configured, skipping email send');
      return;
    }

    const formattedAmount = amount.toFixed(2);
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'church@example.com',
      to: email,
      subject: 'Thank You for Your Donation - Grace Church',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Thank You for Your Generous Donation!</h2>
          <p>Dear ${name},</p>
          <p>We sincerely appreciate your donation of $${formattedAmount} on ${formattedDate}.</p>
          <p>Your generosity helps us continue our mission and support our community programs.</p>
          <p>This email serves as your receipt for tax purposes. Please save it for your records.</p>
          <p>Donation Details:</p>
          <ul>
            <li>Amount: $${formattedAmount}</li>
            <li>Date: ${formattedDate}</li>
            <li>Donor: ${name}</li>
          </ul>
          <p>With gratitude,<br/>Grace Church Team</p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Donation receipt email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('Failed to send donation receipt email:', error);
    throw error;
  }
}