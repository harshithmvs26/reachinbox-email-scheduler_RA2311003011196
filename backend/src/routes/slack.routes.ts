import { Router } from 'express';
import axios from 'axios';
import { config } from '../config';
import prisma from '../services/db';

const router = Router();

router.get('/connect', (req, res) => {
  const { userId } = req.query;
  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId}&scope=incoming-webhook&redirect_uri=${config.slack.redirectUri}&state=${userId}`;
  res.redirect(slackAuthUrl);
});

router.get('/callback', async (req, res) => {
  const { code, state: userId } = req.query;

  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  try {
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        code,
        redirect_uri: config.slack.redirectUri
      }
    });

    const data = response.data;
    if (data.ok) {
      const webhookUrl = data.incoming_webhook.url;
      const accessToken = data.access_token;

      await prisma.user.update({
        where: { id: String(userId) },
        data: { slackToken: accessToken, slackWebhook: webhookUrl }
      });

      // Redirect back to frontend
      res.redirect('http://localhost:5173/?slack_connected=true');
    } else {
      res.status(400).send(`Slack OAuth Error: ${data.error}`);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
