import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export const sendEmail = async (to: string, subject: string, body: string) => {
  return transporter.sendMail({
    from: '"ReachInbox Scheduler" <scheduler@reachinbox.ai>',
    to,
    subject,
    text: body, // we'll use text for simplicity
  });
};
