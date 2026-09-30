import axios from 'axios';

export const sendSlackNotification = async (webhookUrl: string, message: string) => {
  try {
    await axios.post(webhookUrl, { text: message });
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
  }
};
