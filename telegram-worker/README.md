# Telegram Worker Setup

This worker receives review form submissions from GitHub Pages and forwards them to Telegram.

## 1) Create the Telegram bot and chat target

1. Open Telegram and talk to `@BotFather`.
2. Run `/newbot` and copy the bot token.
3. Send at least one message to your new bot from your Telegram account.
4. Get your chat id:
   - Open: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find `chat.id` in the response and copy it.

## 2) Deploy the worker

1. Install Wrangler:
   - `npm install -g wrangler`
2. Login:
   - `wrangler login`
3. From this folder:
   - `cd telegram-worker`
4. Add secrets:
   - `wrangler secret put TELEGRAM_BOT_TOKEN`
   - `wrangler secret put TELEGRAM_CHAT_ID`
5. Restrict origin (recommended):
   - `wrangler secret put ALLOWED_ORIGIN`
   - Value example: `https://ryuz-eng.github.io`
6. Deploy:
   - `wrangler deploy`

After deploy, you will get a worker URL like:
`https://tsum-story-telegram.<subdomain>.workers.dev`

Use this endpoint in the website:
`https://tsum-story-telegram.<subdomain>.workers.dev/notify`

## 3) Connect your website

In `review.html`, update `<body ...>`:

```html
<body class="review-page" data-telegram-endpoint="https://tsum-story-telegram.<subdomain>.workers.dev/notify">
```

Commit and push to GitHub Pages. Submissions will now notify Telegram.
