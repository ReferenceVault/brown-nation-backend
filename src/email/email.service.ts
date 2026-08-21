import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppConfig, EmailConfig } from '../config/configuration';
import { EMAIL_PROVIDER, EmailProvider } from './interfaces/email-provider.interface';
import { emailColors, escapeHtml, renderButton, renderEmailLayout } from './templates/email-layout';

@Injectable()
export class EmailService {
  private readonly frontendUrl: string;
  private readonly contactNotificationEmail: string;

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<AppConfig>('app')!.frontendUrl;
    this.contactNotificationEmail =
      this.configService.get<EmailConfig>('email')!.contactNotificationEmail;
  }

  private layout(previewText: string, bodyHtml: string): string {
    return renderEmailLayout({ frontendUrl: this.frontendUrl, previewText, bodyHtml });
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const resetLink = `${this.frontendUrl}/reset-password?token=${resetToken}`;

    await this.provider.send({
      to,
      subject: 'Reset your Brown Nation password',
      text: `We received a request to reset your password. Use the link below within the next few minutes to choose a new one:\n\n${resetLink}\n\nIf you did not request this, you can safely ignore this email.`,
      html: this.layout(
        'Reset your Brown Nation password',
        `<p style="margin:0 0 16px;font-size:16px;font-weight:bold;color:${emailColors.espresso};">Reset your password</p>
<p style="margin:0 0 16px;">We received a request to reset your Brown Nation account password. Click the button below to choose a new one — this link expires shortly.</p>
${renderButton(resetLink, 'Reset Password')}
<p style="margin:16px 0 0;font-size:13px;color:${emailColors.espressoMuted};">If you didn't request this, you can safely ignore this email — your password won't be changed.</p>`,
      ),
    });
  }

  async sendVerificationEmail(to: string, verificationToken: string): Promise<void> {
    const verifyLink = `${this.frontendUrl}/verify-email?token=${verificationToken}`;

    await this.provider.send({
      to,
      subject: 'Verify your email — Brown Nation',
      text: `Welcome to Brown Nation! Please verify your email address by visiting the link below:\n\n${verifyLink}\n\nIf you did not create this account, you can safely ignore this email.`,
      html: this.layout(
        'Verify your email address',
        `<p style="margin:0 0 16px;font-size:16px;font-weight:bold;color:${emailColors.espresso};">Verify your email</p>
<p style="margin:0 0 16px;">Welcome to Brown Nation! Please confirm your email address to activate your account.</p>
${renderButton(verifyLink, 'Verify Email')}
<p style="margin:16px 0 0;font-size:13px;color:${emailColors.espressoMuted};">If you didn't create this account, you can safely ignore this email.</p>`,
      ),
    });
  }

  async sendNewsletterWelcomeEmail(to: string): Promise<void> {
    await this.provider.send({
      to,
      subject: 'Welcome to Brown Nation',
      text: `Thanks for subscribing to the Brown Nation newsletter! You'll be the first to hear about new flavors and festive offers.\n\nVisit us any time: ${this.frontendUrl}`,
      html: this.layout(
        'Welcome to the Brown Nation newsletter',
        `<p style="margin:0 0 16px;font-size:16px;font-weight:bold;color:${emailColors.espresso};">You're on the list!</p>
<p style="margin:0 0 16px;">Thanks for subscribing to the Brown Nation newsletter. You'll be the first to hear about new flavors, festive offers, and exclusive deals.</p>
${renderButton(this.frontendUrl, 'Shop Now')}`,
      ),
    });
  }

  async sendEnquiryNotification(enquiry: {
    name: string;
    email: string;
    message: string;
  }): Promise<void> {
    const name = escapeHtml(enquiry.name);
    const email = escapeHtml(enquiry.email);
    const message = escapeHtml(enquiry.message).replace(/\n/g, '<br>');

    await this.provider.send({
      to: this.contactNotificationEmail,
      subject: `New contact form enquiry from ${enquiry.name}`,
      text: `Name: ${enquiry.name}\nEmail: ${enquiry.email}\n\n${enquiry.message}`,
      html: this.layout(
        `New enquiry from ${enquiry.name}`,
        `<p style="margin:0 0 16px;font-size:16px;font-weight:bold;color:${emailColors.espresso};">New contact form enquiry</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;">
  <tr>
    <td style="padding:4px 0;font-size:13px;color:${emailColors.espressoMuted};width:90px;">Name</td>
    <td style="padding:4px 0;font-size:14px;font-weight:600;">${name}</td>
  </tr>
  <tr>
    <td style="padding:4px 0;font-size:13px;color:${emailColors.espressoMuted};">Email</td>
    <td style="padding:4px 0;font-size:14px;font-weight:600;">${email}</td>
  </tr>
</table>
<div style="padding:16px;background-color:${emailColors.brand50};border-radius:12px;font-size:14px;line-height:1.6;">${message}</div>`,
      ),
    });
  }

  async sendEnquiryAutoReply(to: string, name: string): Promise<void> {
    const safeName = escapeHtml(name);

    await this.provider.send({
      to,
      subject: "We've received your message — Brown Nation",
      text: `Hi ${name},\n\nThanks for reaching out to Brown Nation! We've received your message and will get back to you within 24-48 hours.\n\nVisit us any time: ${this.frontendUrl}`,
      html: this.layout(
        "We've received your message",
        `<p style="margin:0 0 16px;font-size:16px;font-weight:bold;color:${emailColors.espresso};">Thanks for reaching out, ${safeName}!</p>
<p style="margin:0 0 16px;">We've received your message and our team will get back to you within 24-48 hours.</p>
${renderButton(this.frontendUrl, 'Visit Brown Nation')}`,
      ),
    });
  }

  async sendOrderConfirmationEmail(order: OrderEmailDetails): Promise<void> {
    const orderLink = `${this.frontendUrl}/account/orders/${order.orderId}`;
    const itemsText = order.items
      .map(
        (item) =>
          `- ${item.productName} x${item.quantity} — ${formatMoney(item.totalPrice, order.currency)}`,
      )
      .join('\n');
    const itemsRowsHtml = order.items
      .map(
        (item) =>
          `<tr>
        <td style="padding:8px 0;border-top:1px solid ${emailColors.brand50};font-size:14px;">${escapeHtml(item.productName)} &times; ${item.quantity}</td>
        <td style="padding:8px 0;border-top:1px solid ${emailColors.brand50};font-size:14px;text-align:right;white-space:nowrap;">${formatMoney(item.totalPrice, order.currency)}</td>
      </tr>`,
      )
      .join('');

    await this.provider.send({
      to: order.customerEmail,
      subject: `Order confirmed — #${order.orderNumber}`,
      text: `Hi ${order.customerName},\n\nThanks for your order! We've received your payment and your order #${order.orderNumber} is confirmed.\n\n${itemsText}\n\nTotal: ${formatMoney(order.totalAmount, order.currency)}\n\nTrack your order: ${orderLink}\n\nThanks for choosing Brown Nation!`,
      html: this.layout(
        `Your order #${order.orderNumber} is confirmed`,
        `<p style="margin:0 0 16px;font-size:16px;font-weight:bold;color:${emailColors.espresso};">Hi ${escapeHtml(order.customerName)}, your order is confirmed!</p>
<p style="margin:0 0 20px;">Thanks for your order! We've received your payment and order <strong>#${order.orderNumber}</strong> is being prepared.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  ${itemsRowsHtml}
  <tr>
    <td style="padding:12px 0 0;font-size:15px;font-weight:bold;text-align:right;" colspan="2">Total: ${formatMoney(order.totalAmount, order.currency)}</td>
  </tr>
</table>
${renderButton(orderLink, 'Track Your Order')}
<p style="margin:16px 0 0;">Thanks for choosing Brown Nation!</p>`,
      ),
    });
  }

  async sendOrderNotificationEmail(order: OrderEmailDetails): Promise<void> {
    const itemsText = order.items
      .map(
        (item) =>
          `- ${item.productName} x${item.quantity} — ${formatMoney(item.totalPrice, order.currency)}`,
      )
      .join('\n');
    const itemsRowsHtml = order.items
      .map(
        (item) =>
          `<tr>
        <td style="padding:8px 0;border-top:1px solid ${emailColors.brand50};font-size:14px;">${escapeHtml(item.productName)} &times; ${item.quantity}</td>
        <td style="padding:8px 0;border-top:1px solid ${emailColors.brand50};font-size:14px;text-align:right;white-space:nowrap;">${formatMoney(item.totalPrice, order.currency)}</td>
      </tr>`,
      )
      .join('');

    await this.provider.send({
      to: this.contactNotificationEmail,
      subject: `New paid order — #${order.orderNumber}`,
      text: `A new order has been paid.\n\nOrder: #${order.orderNumber}\nCustomer: ${order.customerName} (${order.customerEmail})\n\n${itemsText}\n\nTotal: ${formatMoney(order.totalAmount, order.currency)}`,
      html: this.layout(
        `New paid order #${order.orderNumber}`,
        `<p style="margin:0 0 16px;font-size:16px;font-weight:bold;color:${emailColors.espresso};">New paid order</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;">
  <tr>
    <td style="padding:4px 0;font-size:13px;color:${emailColors.espressoMuted};width:90px;">Order</td>
    <td style="padding:4px 0;font-size:14px;font-weight:600;">#${order.orderNumber}</td>
  </tr>
  <tr>
    <td style="padding:4px 0;font-size:13px;color:${emailColors.espressoMuted};">Customer</td>
    <td style="padding:4px 0;font-size:14px;font-weight:600;">${escapeHtml(order.customerName)} (${escapeHtml(order.customerEmail)})</td>
  </tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  ${itemsRowsHtml}
  <tr>
    <td style="padding:12px 0 0;font-size:15px;font-weight:bold;text-align:right;" colspan="2">Total: ${formatMoney(order.totalAmount, order.currency)}</td>
  </tr>
</table>`,
      ),
    });
  }
}

type OrderEmailDetails = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: string;
  currency: string;
  items: { productName: string; quantity: number; totalPrice: string }[];
};

function formatMoney(amount: string, currency: string): string {
  const formatted = Number(amount).toFixed(2);
  return currency === 'INR' ? `₹${formatted}` : `${currency} ${formatted}`;
}
