import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppConfig, EmailConfig } from '../config/configuration';
import { EMAIL_PROVIDER, EmailProvider } from './interfaces/email-provider.interface';

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

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const resetLink = `${this.frontendUrl}/reset-password?token=${resetToken}`;

    await this.provider.send({
      to,
      subject: 'Reset your Brown Nation password',
      text: `We received a request to reset your password. Use the link below within the next few minutes to choose a new one:\n\n${resetLink}\n\nIf you did not request this, you can safely ignore this email.`,
      html: `<p>We received a request to reset your password.</p><p><a href="${resetLink}">Click here to reset your password</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
    });
  }

  async sendVerificationEmail(to: string, verificationToken: string): Promise<void> {
    const verifyLink = `${this.frontendUrl}/verify-email?token=${verificationToken}`;

    await this.provider.send({
      to,
      subject: 'Verify your email — Brown Nation',
      text: `Welcome to Brown Nation! Please verify your email address by visiting the link below:\n\n${verifyLink}\n\nIf you did not create this account, you can safely ignore this email.`,
      html: `<p>Welcome to Brown Nation!</p><p><a href="${verifyLink}">Click here to verify your email address</a></p><p>If you did not create this account, you can safely ignore this email.</p>`,
    });
  }

  async sendNewsletterWelcomeEmail(to: string): Promise<void> {
    await this.provider.send({
      to,
      subject: 'Welcome to Brown Nation',
      text: `Thanks for subscribing to the Brown Nation newsletter! You'll be the first to hear about new flavors and festive offers.\n\nVisit us any time: ${this.frontendUrl}`,
      html: `<p>Thanks for subscribing to the Brown Nation newsletter! You'll be the first to hear about new flavors and festive offers.</p><p><a href="${this.frontendUrl}">Visit Brown Nation</a></p>`,
    });
  }

  async sendEnquiryNotification(enquiry: {
    name: string;
    email: string;
    message: string;
  }): Promise<void> {
    await this.provider.send({
      to: this.contactNotificationEmail,
      subject: `New contact form enquiry from ${enquiry.name}`,
      text: `Name: ${enquiry.name}\nEmail: ${enquiry.email}\n\n${enquiry.message}`,
      html: `<p><strong>Name:</strong> ${enquiry.name}</p><p><strong>Email:</strong> ${enquiry.email}</p><p>${enquiry.message.replace(/\n/g, '<br>')}</p>`,
    });
  }

  async sendEnquiryAutoReply(to: string, name: string): Promise<void> {
    await this.provider.send({
      to,
      subject: "We've received your message — Brown Nation",
      text: `Hi ${name},\n\nThanks for reaching out to Brown Nation! We've received your message and will get back to you within 24-48 hours.\n\nVisit us any time: ${this.frontendUrl}`,
      html: `<p>Hi ${name},</p><p>Thanks for reaching out to Brown Nation! We've received your message and will get back to you within 24-48 hours.</p><p><a href="${this.frontendUrl}">Visit Brown Nation</a></p>`,
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
    const itemsHtml = order.items
      .map(
        (item) =>
          `<li>${item.productName} &times; ${item.quantity} — ${formatMoney(item.totalPrice, order.currency)}</li>`,
      )
      .join('');

    await this.provider.send({
      to: order.customerEmail,
      subject: `Order confirmed — #${order.orderNumber}`,
      text: `Hi ${order.customerName},\n\nThanks for your order! We've received your payment and your order #${order.orderNumber} is confirmed.\n\n${itemsText}\n\nTotal: ${formatMoney(order.totalAmount, order.currency)}\n\nTrack your order: ${orderLink}\n\nThanks for choosing Brown Nation!`,
      html: `<p>Hi ${order.customerName},</p><p>Thanks for your order! We've received your payment and your order <strong>#${order.orderNumber}</strong> is confirmed.</p><ul>${itemsHtml}</ul><p><strong>Total: ${formatMoney(order.totalAmount, order.currency)}</strong></p><p><a href="${orderLink}">Track your order</a></p><p>Thanks for choosing Brown Nation!</p>`,
    });
  }

  async sendOrderNotificationEmail(order: OrderEmailDetails): Promise<void> {
    const itemsText = order.items
      .map(
        (item) =>
          `- ${item.productName} x${item.quantity} — ${formatMoney(item.totalPrice, order.currency)}`,
      )
      .join('\n');
    const itemsHtml = order.items
      .map(
        (item) =>
          `<li>${item.productName} &times; ${item.quantity} — ${formatMoney(item.totalPrice, order.currency)}</li>`,
      )
      .join('');

    await this.provider.send({
      to: this.contactNotificationEmail,
      subject: `New paid order — #${order.orderNumber}`,
      text: `A new order has been paid.\n\nOrder: #${order.orderNumber}\nCustomer: ${order.customerName} (${order.customerEmail})\n\n${itemsText}\n\nTotal: ${formatMoney(order.totalAmount, order.currency)}`,
      html: `<p>A new order has been paid.</p><p><strong>Order:</strong> #${order.orderNumber}<br><strong>Customer:</strong> ${order.customerName} (${order.customerEmail})</p><ul>${itemsHtml}</ul><p><strong>Total: ${formatMoney(order.totalAmount, order.currency)}</strong></p>`,
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
