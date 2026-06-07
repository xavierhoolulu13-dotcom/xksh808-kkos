// 808 MONEY PRINTER — TELEGRAM BOT COMMAND CENTER
// Node.js + Telegraf
// Deploy: Railway, Heroku, or local with ngrok

require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');

const bot = new Telegraf(process.env.TG_BOT_TOKEN);
const NETLIFY_FUNCTION = process.env.NETLIFY_FUNCTION_URL || 'https://your-site.netlify.app/.netlify/functions/808-scrape-score';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LEAD STORAGE (local JSON)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LEADS_FILE = './leads.json';

const loadLeads = () => {
  if (fs.existsSync(LEADS_FILE)) {
    return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
  }
  return [];
};

const saveLeads = (leads) => {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMANDS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

bot.start((ctx) => {
  ctx.reply(`
🔥 808 MONEY PRINTER — LEAD MACHINE 🔥

Commands:
/scrape <URL>  — Scrape + score a website
/hot           — Show HOT leads (75+ score)
/warm          — Show WARM leads (50-75 score)
/cold          — Show COLD leads (<50 score)
/all           — Show ALL leads
/contacted <ID> — Mark lead as contacted
/close <ID>    — Close lead (retainer won)
/export        — Get CSV of all leads
/reset         — Clear all leads
  `);
});

// ━━━━━━━━━━ /SCRAPE <URL> ━━━━━━━━━━
bot.command('scrape', async (ctx) => {
  const url = ctx.message.text.replace('/scrape ', '').trim();

  if (!url || !url.startsWith('http')) {
    return ctx.reply('❌ Usage: /scrape https://example.com');
  }

  ctx.reply(`🔍 Scraping ${url}...`);

  try {
    // Call Netlify function
    const response = await axios.post(NETLIFY_FUNCTION, { url }, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });

    const scored = response.data;

    // Format response
    const tierEmoji = scored.scoring.tier === 'HOT' ? '🔴' : scored.scoring.tier === 'WARM' ? '🟡' : '🔵';
    const message = `
${tierEmoji} **${scored.source.url}**

Score: ${scored.scoring.score}/100
Tier: ${scored.scoring.tier}
Pain Points: ${scored.scoring.pain_points || 'N/A'}

Flags: ${scored.scoring.flags.join(', ') || 'None'}

Video Ready: ${scored.outreach.video_url ? '✅ YES' : '❌ NO'}
Email Ready: ${scored.outreach.ready_for_email ? '✅ YES' : '❌ NO'}

Subject: "${scored.outreach.recommended_subject}"
    `;

    ctx.reply(message, { parse_mode: 'Markdown' });

    // Save to local leads
    const leads = loadLeads();
    leads.push({
      id: `lead-${Date.now()}`,
      url: scored.source.url,
      score: scored.scoring.score,
      tier: scored.scoring.tier,
      flags: scored.scoring.flags,
      pain_points: scored.scoring.pain_points,
      video_url: scored.outreach.video_url,
      subject: scored.outreach.recommended_subject,
      status: 'new',
      timestamp: new Date().toISOString()
    });
    saveLeads(leads);

    ctx.reply(`✅ Lead saved (ID: lead-${Date.now()})`);

  } catch (err) {
    console.error('Scrape error:', err.message);
    ctx.reply(`❌ Error: ${err.message}`);
  }
});

// ━━━━━━━━━━ /HOT ━━━━━━━━━━
bot.command('hot', (ctx) => {
  const leads = loadLeads().filter(l => l.score >= 75 && l.status === 'new');
  
  if (leads.length === 0) {
    return ctx.reply('🔵 No HOT leads found.');
  }

  let message = `🔴 **HOT LEADS (${leads.length})**\n\n`;
  leads.forEach((lead, i) => {
    message += `${i + 1}. ${lead.url}\n   Score: ${lead.score} | Status: ${lead.status}\n\n`;
  });

  ctx.reply(message, { parse_mode: 'Markdown' });
});

// ━━━━━━━━━━ /WARM ━━━━━━━━━━
bot.command('warm', (ctx) => {
  const leads = loadLeads().filter(l => l.score >= 50 && l.score < 75 && l.status === 'new');
  
  if (leads.length === 0) {
    return ctx.reply('🔵 No WARM leads found.');
  }

  let message = `🟡 **WARM LEADS (${leads.length})**\n\n`;
  leads.forEach((lead, i) => {
    message += `${i + 1}. ${lead.url}\n   Score: ${lead.score} | Status: ${lead.status}\n\n`;
  });

  ctx.reply(message, { parse_mode: 'Markdown' });
});

// ━━━━━━━━━━ /COLD ━━━━━━━━━━
bot.command('cold', (ctx) => {
  const leads = loadLeads().filter(l => l.score < 50 && l.status === 'new');
  
  if (leads.length === 0) {
    return ctx.reply('🔵 No COLD leads found.');
  }

  let message = `🔵 **COLD LEADS (${leads.length})**\n\n`;
  leads.forEach((lead, i) => {
    message += `${i + 1}. ${lead.url}\n   Score: ${lead.score} | Status: ${lead.status}\n\n`;
  });

  ctx.reply(message, { parse_mode: 'Markdown' });
});

// ━━━━━━━━━━ /ALL ━━━━━━━━━━
bot.command('all', (ctx) => {
  const leads = loadLeads();
  
  if (leads.length === 0) {
    return ctx.reply('🔵 No leads yet.');
  }

  let message = `📊 **ALL LEADS (${leads.length})**\n\n`;
  leads.forEach((lead, i) => {
    message += `${i + 1}. ${lead.url}\n   Score: ${lead.score} | Tier: ${lead.tier} | Status: ${lead.status}\n\n`;
  });

  ctx.reply(message, { parse_mode: 'Markdown' });
});

// ━━━━━━━━━━ /CONTACTED <ID> ━━━━━━━━━━
bot.command('contacted', (ctx) => {
  const id = ctx.message.text.replace('/contacted ', '').trim();
  const leads = loadLeads();
  const lead = leads.find(l => l.id === id);

  if (!lead) {
    return ctx.reply(`❌ Lead ${id} not found.`);
  }

  lead.status = 'contacted';
  lead.contacted_at = new Date().toISOString();
  saveLeads(leads);

  ctx.reply(`✅ Marked ${lead.url} as CONTACTED`);
});

// ━━━━━━━━━━ /CLOSE <ID> ━━━━━━━━━━
bot.command('close', (ctx) => {
  const id = ctx.message.text.replace('/close ', '').trim();
  const leads = loadLeads();
  const lead = leads.find(l => l.id === id);

  if (!lead) {
    return ctx.reply(`❌ Lead ${id} not found.`);
  }

  lead.status = 'closed';
  lead.closed_at = new Date().toISOString();
  saveLeads(leads);

  ctx.reply(`🎉 CLOSED: ${lead.url} → Retainer won!`);
});

// ━━━━━━━━━━ /EXPORT ━━━━━━━━━━
bot.command('export', (ctx) => {
  const leads = loadLeads();

  if (leads.length === 0) {
    return ctx.reply('🔵 No leads to export.');
  }

  // CSV format
  let csv = 'URL,Score,Tier,Status,Pain Points,Timestamp\n';
  leads.forEach(lead => {
    csv += `"${lead.url}",${lead.score},${lead.tier},${lead.status},"${lead.pain_points || ''}",${lead.timestamp}\n`;
  });

  ctx.reply(`\`\`\`\n${csv}\n\`\`\``, { parse_mode: 'Markdown' });
});

// ━━━━━━━━━━ /RESET ━━━━━━━━━━
bot.command('reset', (ctx) => {
  saveLeads([]);
  ctx.reply('✅ All leads cleared.');
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// START BOT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

bot.launch(() => {
  console.log('🔥 808 MONEY PRINTER BOT ONLINE');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
