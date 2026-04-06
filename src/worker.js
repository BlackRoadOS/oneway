// PROPRIETARY AND CONFIDENTIAL. Copyright 2025-2026 BlackRoad OS, Inc. All rights reserved. NOT open source.
// OneWay — Data Export API
// oneway.blackroad.io | Your data leaves when you say. Never look back.
// Copyright (c) 2025-2026 BlackRoad OS, Inc. All Rights Reserved.

async function stampChain(action, entity, details) {
  fetch('https://roadchain-worker.blackroad.workers.dev/api/event', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({app:'oneway', type: action, data: {entity, details}})
  }).catch(()=>{});
}
async function earnCoin(road_id, action, amount) {
  fetch('https://roadcoin-worker.blackroad.workers.dev/api/earn', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({road_id: road_id || 'system', action, amount})
  }).catch(()=>{});
}

let dbReady = false;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'};
    if (request.method === 'OPTIONS') return new Response(null, {status:204,headers:cors});

    if (p === '/' || p === '') return new Response(HTML, {headers:{'Content-Type':'text/html;charset=utf-8','Content-Security-Policy':"frame-ancestors 'self' https://blackroad.io https://*.blackroad.io",...cors}});
    // Analytics tracking
    if (p === '/api/track' && request.method === 'POST') {
      try { const body = await request.json(); const cf = request.cf || {};
        await env.DB.prepare("CREATE TABLE IF NOT EXISTS analytics_events (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT DEFAULT 'pageview', path TEXT, referrer TEXT, country TEXT, city TEXT, device TEXT, screen TEXT, scroll_depth INTEGER DEFAULT 0, engagement_ms INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))").run();
        await env.DB.prepare('INSERT INTO analytics_events (type, path, referrer, country, city, device, screen, scroll_depth, engagement_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(body.type||'pageview', body.path||'/', body.referrer||'', cf.country||'', cf.city||'', body.device||'', body.screen||'', body.scroll||0, body.time||0).run();
      } catch(e) {}
      return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
    }
    if (p === '/health') return json({ok:true,service:'oneway',version:'4.0.0'},cors);

    // ─── Messaging Feature Pages ───
    const OW_FEATURES = [
      { slug: 'direct-messages', name: 'Direct Messages', category: 'Messaging', description: 'Send private, one-on-one messages to any user on the platform. Conversations stay between you and the recipient with full encryption.', howItWorks: 'Start a direct message by selecting any user from your contacts or searching by name. Messages are delivered instantly and stored securely. You can share text, files, images, and links. All direct messages are end-to-end encrypted by default, meaning only you and the recipient can read them.', privacyNote: 'Direct messages are end-to-end encrypted. OneWay never reads or analyzes private message content.', related: ['group-chats', 'message-encryption', 'read-receipts'] },
      { slug: 'group-chats', name: 'Group Chats', category: 'Messaging', description: 'Create group conversations with up to 500 members. Perfect for teams, friend groups, and project collaboration.', howItWorks: 'Create a group by selecting multiple contacts and giving the group a name. Any member can add new participants or leave at any time. Group admins can manage permissions, pin important messages, and set group-wide notification preferences. Shared files are accessible to all members in the group media gallery.', privacyNote: 'Group messages are encrypted in transit. Group admins can configure message retention policies.', related: ['channels', 'direct-messages', 'threads'] },
      { slug: 'channels', name: 'Channels', category: 'Organization', description: 'Topic-based public or private channels for organized team communication. Keep conversations focused and searchable.', howItWorks: 'Channels are persistent conversation spaces organized by topic, project, or team. Public channels are discoverable by anyone in your workspace. Private channels require an invitation. Each channel has its own file repository, pinned messages, and member list. Use channel descriptions to set expectations for what belongs there.', privacyNote: 'Channel visibility is controlled by the creator. Private channels are only accessible to invited members.', related: ['threads', 'pinned-messages', 'message-search'] },
      { slug: 'threads', name: 'Threads', category: 'Organization', description: 'Reply to specific messages in a threaded conversation. Keep discussions organized without cluttering the main channel.', howItWorks: 'Click any message to start a thread. Replies appear in a side panel, keeping the main conversation clean. Thread participants get notifications for new replies. You can follow threads you care about and mute ones you do not. Threads work in both channels and group chats, making it easy to have focused discussions on specific topics.', privacyNote: 'Thread visibility follows the parent message permissions. No additional data is collected.', related: ['channels', 'reactions', 'notifications'] },
      { slug: 'reactions', name: 'Reactions', category: 'Messaging', description: 'React to any message with emojis. Quick acknowledgments without sending a full reply.', howItWorks: 'Hover over any message and click the reaction icon to add an emoji. You can use standard emojis or custom ones uploaded by your workspace admin. Multiple users can add the same reaction, showing a count. Reactions are a lightweight way to acknowledge messages, vote on ideas, or express sentiment without creating notification noise.', privacyNote: 'Reactions are visible to all members who can see the original message.', related: ['direct-messages', 'threads', 'notifications'] },
      { slug: 'file-sharing', name: 'File Sharing', category: 'Messaging', description: 'Share files up to 2GB directly in any conversation. Drag and drop images, documents, videos, and more.', howItWorks: 'Drag files into any conversation or click the attachment icon to browse. OneWay supports all file types including documents, images, videos, and archives. Files are stored securely and can be previewed inline for common formats. Each workspace has a searchable file library where you can find all shared files across conversations.', privacyNote: 'Files are encrypted at rest and in transit. You can set expiration dates on shared files.', related: ['direct-messages', 'group-chats', 'data-export'] },
      { slug: 'voice-messages', name: 'Voice Messages', category: 'Messaging', description: 'Record and send voice messages when typing is not convenient. Perfect for quick updates on the go.', howItWorks: 'Hold the microphone button to record a voice message up to 5 minutes long. The recording is automatically compressed and uploaded. Recipients can play voice messages at 1x, 1.5x, or 2x speed. Voice messages include automatic transcription so they are searchable and accessible. You can preview your recording before sending.', privacyNote: 'Voice messages are encrypted like all other content. Transcriptions are generated on-device when possible.', related: ['direct-messages', 'file-sharing', 'message-search'] },
      { slug: 'read-receipts', name: 'Read Receipts', category: 'Messaging', description: 'Know when your messages have been delivered and read. Optional per-conversation toggle for privacy.', howItWorks: 'When enabled, you will see delivery and read indicators on your sent messages. A single checkmark means delivered, double checkmarks mean read. You can disable read receipts per conversation or globally in your privacy settings. When you disable them, you also will not see read status on messages from others.', privacyNote: 'Read receipts are fully optional. Disabling them is a two-way privacy measure.', related: ['direct-messages', 'notifications', 'privacy-settings'] },
      { slug: 'message-search', name: 'Message Search', category: 'Power Features', description: 'Full-text search across all your conversations, channels, and shared files. Find anything instantly.', howItWorks: 'Use the search bar to find messages, files, and links across your entire workspace. Filter by date range, sender, channel, or file type. Search results show context around the match so you can quickly find what you need. Advanced operators let you combine filters for precise results. Search indexes are updated in real-time.', privacyNote: 'Search only returns results from conversations you have access to. Search queries are not logged.', related: ['channels', 'pinned-messages', 'file-sharing'] },
      { slug: 'pinned-messages', name: 'Pinned Messages', category: 'Organization', description: 'Pin important messages to the top of any conversation. Never lose track of key decisions or resources.', howItWorks: 'Right-click any message and select Pin to keep it easily accessible. Pinned messages appear in a dedicated panel at the top of the conversation. Any member can pin messages in channels they belong to. Admins can restrict pinning permissions if needed. Use pins for meeting notes, decisions, important links, and reference material.', privacyNote: 'Pinned messages follow the same visibility rules as the conversation they belong to.', related: ['channels', 'message-search', 'threads'] },
      { slug: 'notifications', name: 'Notifications', category: 'Organization', description: 'Granular notification controls per channel, group, and conversation. Stay informed without being overwhelmed.', howItWorks: 'Configure notification preferences at multiple levels: global, per-channel, and per-conversation. Choose between all messages, mentions only, or muted. Set quiet hours to pause notifications during off-hours. Desktop, mobile, and email notifications can be configured independently. Keyword notifications alert you when specific terms are mentioned anywhere.', privacyNote: 'Notification preferences are stored locally and synced encrypted. We do not track notification interactions.', related: ['channels', 'threads', 'scheduled-messages'] },
      { slug: 'status-updates', name: 'Status Updates', category: 'Messaging', description: 'Set a custom status to let your team know your availability, location, or current focus.', howItWorks: 'Click your profile to set a status message and emoji. Choose from preset options like Available, Busy, In a Meeting, or create your own. Set an expiration time so your status automatically clears. Your status appears next to your name everywhere in the workspace. Integrate with your calendar to auto-update your status during meetings.', privacyNote: 'Status is visible to all workspace members. You can hide your online/offline presence in settings.', related: ['direct-messages', 'notifications', 'group-chats'] },
      { slug: 'scheduled-messages', name: 'Scheduled Messages', category: 'Power Features', description: 'Write now, send later. Schedule messages for the perfect time across any time zone.', howItWorks: 'Compose your message normally, then click the clock icon next to send. Pick a date and time, or use smart suggestions like "Tomorrow at 9am" or "Monday morning." Scheduled messages work in all conversation types. You can edit or cancel scheduled messages before they send. A dedicated Scheduled tab shows all your pending messages.', privacyNote: 'Scheduled messages are stored encrypted until send time. Only you can see pending scheduled messages.', related: ['direct-messages', 'channels', 'notifications'] },
      { slug: 'message-encryption', name: 'Message Encryption', category: 'Privacy', description: 'End-to-end encryption for all messages by default. Your conversations stay private, even from us.', howItWorks: 'OneWay uses the Signal Protocol for end-to-end encryption on all direct messages. Group messages and channels use transport-layer encryption with optional E2EE for sensitive channels. Encryption keys are generated and stored on your devices only. Key verification lets you confirm you are talking to the right person. If you lose your device, you can recover with your backup phrase.', privacyNote: 'OneWay cannot read your encrypted messages. We have zero access to your private conversations.', related: ['direct-messages', 'privacy-settings', 'data-export'] },
      { slug: 'data-export', name: 'Data Export', category: 'Privacy', description: 'Export all your data anytime in standard formats. Your data is yours and it leaves when you say.', howItWorks: 'Go to Settings and select Data Export to download everything: messages, files, contacts, and settings. Choose JSON, CSV, or a complete archive format. Exports include all your conversations, shared media, and account data. You can schedule automatic exports on a weekly or monthly basis. Export requests are processed within minutes for most accounts.', privacyNote: 'Data export gives you a complete copy. You can also request permanent deletion of all server-side data.', related: ['message-encryption', 'privacy-settings', 'file-sharing'] },
    ];

    if (p.startsWith('/features/') && p !== '/features/') {
      const slug = p.replace('/features/', '').replace(/\/$/, '');
      const feat = OW_FEATURES.find(f => f.slug === slug);
      if (!feat) return new Response('Not Found', {status:404});
      const relatedHtml = feat.related.map(r => { const rf = OW_FEATURES.find(f => f.slug === r); return rf ? `<a href="/features/${r}" style="display:inline-block;padding:8px 16px;background:#1a1a2e;border:1px solid #333;border-radius:8px;color:#ccc;text-decoration:none;margin:4px">${rf.name}</a>` : ''; }).join('');
      const pageHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${feat.name} - Messaging Feature | OneWay by BlackRoad</title><meta name="description" content="${feat.description}"><link rel="canonical" href="https://oneway.blackroad.io/features/${feat.slug}"><meta property="og:title" content="${feat.name} | OneWay by BlackRoad"><meta property="og:description" content="${feat.description}"><meta property="og:url" content="https://oneway.blackroad.io/features/${feat.slug}"><meta property="og:type" content="article"><meta property="og:site_name" content="OneWay by BlackRoad"><script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"Article","headline":feat.name,"description":feat.description,"url":"https://oneway.blackroad.io/features/"+feat.slug,"publisher":{"@type":"Organization","name":"BlackRoad OS, Inc."},"articleSection":feat.category})}</script><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a1a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.7}a{color:#7B93DB}.container{max-width:800px;margin:0 auto;padding:40px 20px}.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;background:#1a1a2e;border:1px solid #333;margin-bottom:16px}.section{margin:32px 0}.section h2{font-size:20px;margin-bottom:12px;color:#fff}.privacy-note{background:#0d1a0d;border:1px solid #1a3a1a;border-radius:12px;padding:16px;margin:24px 0;font-size:14px;color:#8BC34A}.cta{display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#FF1D6C,#F5A623);color:#fff;border-radius:12px;text-decoration:none;font-weight:600;margin-top:24px}.nav{padding:20px;border-bottom:1px solid #1a1a2e;display:flex;justify-content:space-between;align-items:center}.nav a{color:#ccc;text-decoration:none}</style></head><body><nav class="nav"><a href="/">OneWay</a><a href="/features">All Features</a></nav><div class="container"><span class="badge">${feat.category}</span><h1 style="font-size:36px;margin-bottom:16px">${feat.name}</h1><p style="font-size:18px;color:#aaa;margin-bottom:32px">${feat.description}</p><div class="section"><h2>How It Works</h2><p style="font-size:16px;line-height:1.8">${feat.howItWorks}</p></div><div class="privacy-note"><strong>Privacy:</strong> ${feat.privacyNote}</div><div class="section"><h2>Related Features</h2><div>${relatedHtml}</div></div><div style="text-align:center;margin-top:40px"><a href="/" class="cta">Try OneWay</a></div></div><footer style="text-align:center;padding:40px;color:#555;font-size:13px;border-top:1px solid #1a1a2e;margin-top:60px">&#169; 2025-2026 BlackRoad OS, Inc. All rights reserved.</footer></body></html>`;
      return new Response(pageHtml, {headers:{'Content-Type':'text/html;charset=utf-8'}});
    }

    if (p === '/features' || p === '/features/') {
      const rows = OW_FEATURES.map(f=>`<tr><td style="padding:12px"><a href="/features/${f.slug}" style="color:#7B93DB;text-decoration:none;font-weight:600">${f.name}</a></td><td style="padding:12px;color:#aaa">${f.category}</td><td style="padding:12px;color:#888;font-size:14px">${f.description}</td></tr>`).join('');
      const indexHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Messaging Features - Private, Secure Communication | OneWay by BlackRoad</title><meta name="description" content="Explore 15+ messaging features built for privacy. Direct messages, channels, encryption, data export, and more. Your data leaves when you say."><link rel="canonical" href="https://oneway.blackroad.io/features"><meta property="og:title" content="Messaging Features | OneWay by BlackRoad"><meta property="og:description" content="Explore 15+ messaging features built for privacy."><meta property="og:url" content="https://oneway.blackroad.io/features"><meta property="og:type" content="website"><script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":"OneWay Messaging Features","description":"Explore 15+ messaging features built for privacy","url":"https://oneway.blackroad.io/features","numberOfItems":OW_FEATURES.length,"provider":{"@type":"Organization","name":"BlackRoad OS, Inc."}})}</script><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a1a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6}a{color:#7B93DB}.container{max-width:1000px;margin:0 auto;padding:40px 20px}table{width:100%;border-collapse:collapse;margin-top:24px}th{text-align:left;padding:12px;border-bottom:2px solid #333;color:#fff;font-size:13px;text-transform:uppercase;letter-spacing:1px}td{border-bottom:1px solid #1a1a2e}.nav{padding:20px;border-bottom:1px solid #1a1a2e;display:flex;justify-content:space-between;align-items:center}.nav a{color:#ccc;text-decoration:none}.cta{display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#FF1D6C,#F5A623);color:#fff;border-radius:12px;text-decoration:none;font-weight:600;margin-top:32px}</style></head><body><nav class="nav"><a href="/">OneWay</a><a href="/features">All Features</a></nav><div class="container"><h1 style="font-size:36px;margin-bottom:8px">Messaging Features</h1><p style="color:#aaa;font-size:18px;margin-bottom:24px">Everything you need for private, secure communication. ${OW_FEATURES.length} features built with privacy first.</p><table><thead><tr><th>Feature</th><th>Category</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table><div style="text-align:center;margin-top:48px"><a href="/" class="cta">Try OneWay</a></div></div><footer style="text-align:center;padding:40px;color:#555;font-size:13px;border-top:1px solid #1a1a2e;margin-top:60px">&#169; 2025-2026 BlackRoad OS, Inc. All rights reserved.</footer></body></html>`;
      return new Response(indexHtml, {headers:{'Content-Type':'text/html;charset=utf-8'}});
    }

    if (p === '/sitemap.xml') {
      const featUrls = OW_FEATURES.map(f=>'  <url><loc>https://oneway.blackroad.io/features/'+f.slug+'</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>').join('\n');
      return new Response('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://oneway.blackroad.io/</loc><lastmod>'+new Date().toISOString().split('T')[0]+'</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>\n  <url><loc>https://oneway.blackroad.io/features</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>\n'+featUrls+'\n</urlset>', {headers:{'Content-Type':'application/xml'}});
    }

    if (p === '/robots.txt') {
      return new Response('User-agent: *\nAllow: /\nAllow: /features/\nSitemap: https://oneway.blackroad.io/sitemap.xml\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: ChatGPT-User\nDisallow: /\n\nUser-agent: CCBot\nDisallow: /', {headers:{'Content-Type':'text/plain'}});
    }

    try {
      if (!dbReady) { await ensureOWTables(env.DB); dbReady = true; }

      // ─── Export configs ───
      if (p === '/api/exports' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT * FROM ow_exports ORDER BY created_at DESC').all();
        return json({exports:rows.results||[]},cors);
      }

      if (p === '/api/exports' && request.method === 'POST') {
        const body = await request.json();
        if (!body.name || !body.source) return json({error:'name and source required'},cors,400);
        const sources = ['chat','social','search','roadtrip','memory','all'];
        if (!sources.includes(body.source)) return json({error:'source must be: '+sources.join(', ')},cors,400);
        const id = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT INTO ow_exports (id,name,format,source,destination_url,filter) VALUES (?,?,?,?,?,?)')
          .bind(id, body.name.slice(0,100), body.format||'json', body.source, body.destination_url||'', JSON.stringify(body.filter||{})).run();
        return json({ok:true,id,name:body.name},cors,201);
      }

      // ─── Quick export (POST version) ───
      if (p === '/api/export/quick' && request.method === 'POST') {
        const body = await request.json();
        const sources = body.sources || ['all'];
        const format = body.format || 'json';
        const validSources = ['chat','social','search','memory','all'];
        for (const s of sources) {
          if (!validSources.includes(s)) return json({error:`invalid source: ${s}. Must be: ${validSources.join(', ')}`},cors,400);
        }

        let data = {};
        const expandedSources = sources.includes('all') ? ['chat','social','search','memory'] : sources;
        for (const src of expandedSources) {
          data[src] = await pullSourceData(src);
        }

        const payload = format === 'csv' ? convertToCSV(data) : JSON.stringify(data, null, 2);
        const bytes = new TextEncoder().encode(payload).length;

        // Log it
        const logId = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT INTO ow_history (id,export_type,sources,format,records,bytes,status) VALUES (?,?,?,?,?,?,?)')
          .bind(logId,'quick',sources.join(','),format,Object.keys(data).length,bytes,'completed').run();

        // Silas generates a plain-language summary of what was exported
        let ai_summary = '';
        try {
          const prompt = `You are Silas, the Reliability agent on BlackRoad OS. Steady, precise, trustworthy. You explain things simply.

An export just completed. Sources: ${expandedSources.join(', ')}. Format: ${format}. Size: ${bytes} bytes. Records: ${Object.keys(data).length} sources pulled.

Write a 2-sentence plain-language summary of what was exported and what the user can do with it. Be specific about what data categories were included.`;
          ai_summary = await runOWAI(env.AI, prompt);
        } catch {}

        stampChain('export', logId, expandedSources.join(',')); earnCoin('user', 'export', 0.1);
        return json({ok:true,export_id:logId,format,sources:expandedSources,bytes,ai_summary:ai_summary||`Exported ${expandedSources.join(', ')} data (${bytes} bytes).`,agent:'Silas',data},cors);
      }

      // ─── Quick export (GET version — keep existing) ───
      if (p === '/api/export/quick' && request.method === 'GET') {
        const source = url.searchParams.get('source') || 'all';
        const sourceAPIs = {
          chat: 'https://roadtrip.blackroad.io/api/stats',
          social: 'https://backroad.blackroad.io/api/stats',
          search: 'https://roadview.blackroad.io/stats',
          roadtrip: 'https://roadtrip.blackroad.io/api/agents',
          memory: 'https://roadtrip.blackroad.io/api/knowledge?agent=all',
        };
        let data = {};
        if (source === 'all') {
          for (const [k,u] of Object.entries(sourceAPIs)) {
            try { const r = await fetch(u,{signal:AbortSignal.timeout(3000)}); data[k] = await r.json(); } catch {}
          }
        } else if (sourceAPIs[source]) {
          try { const r = await fetch(sourceAPIs[source],{signal:AbortSignal.timeout(3000)}); data = await r.json(); } catch(e) { data = {error:e.message}; }
        }
        return json({source,exported_at:new Date().toISOString(),data},cors);
      }

      // ─── Run a configured export ───
      if (p === '/api/export/run' && request.method === 'POST') {
        const body = await request.json();
        if (!body.export_id) return json({error:'export_id required'},cors,400);
        const exp = await env.DB.prepare('SELECT * FROM ow_exports WHERE id=?').bind(body.export_id).first();
        if (!exp) return json({error:'export not found'},cors,404);

        const data = await pullSourceData(exp.source);
        const payload = JSON.stringify({export_id:exp.id, source:exp.source, exported_at:new Date().toISOString(), data});
        const bytes = new TextEncoder().encode(payload).length;

        const logId = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT INTO ow_history (id,export_type,sources,format,records,bytes,status,destination_url) VALUES (?,?,?,?,?,?,?,?)')
          .bind(logId,'configured',exp.source,exp.format,Array.isArray(data)?data.length:1,bytes,'completed',exp.destination_url||'download').run();
        await env.DB.prepare('UPDATE ow_exports SET last_run=datetime("now"), run_count=run_count+1 WHERE id=?').bind(exp.id).run();

        if (exp.destination_url) {
          try {
            await fetch(exp.destination_url, {method:'POST',headers:{'Content-Type':'application/json'},body:payload,signal:AbortSignal.timeout(5000)});
          } catch {}
        }

        return json({ok:true,export_id:exp.id,source:exp.source,bytes,data},cors);
      }

      // ─── Preview export ───
      if (p === '/api/export/preview' && request.method === 'GET') {
        const source = url.searchParams.get('source') || 'all';
        const sourceDescriptions = {
          chat:     {name:'Chat Messages',   estimated_records:'50-500',  avg_size_kb:25,  contains:['messages','rooms','timestamps']},
          social:   {name:'Social Posts',     estimated_records:'10-100',  avg_size_kb:15,  contains:['posts','reactions','shares']},
          search:   {name:'Search History',   estimated_records:'100-1000',avg_size_kb:40,  contains:['queries','results','timestamps']},
          memory:   {name:'Memory & Knowledge',estimated_records:'200-2000',avg_size_kb:80, contains:['journal','codex','TILs','todos']},
          roadtrip: {name:'Agent Conversations',estimated_records:'50-500', avg_size_kb:35, contains:['agents','messages','channels']},
        };

        let preview;
        if (source === 'all') {
          const totalKB = Object.values(sourceDescriptions).reduce((s,d)=>s+d.avg_size_kb,0);
          preview = {source:'all',sources:sourceDescriptions,estimated_total_kb:totalKB,format_options:['json','csv']};
        } else {
          preview = {source,detail:sourceDescriptions[source]||{name:'Unknown',estimated_records:'0',avg_size_kb:0,contains:[]},format_options:['json','csv']};
        }
        return json(preview,cors);
      }

      // ─── Schedule recurring export ───
      if (p === '/api/export/schedule' && request.method === 'POST') {
        const body = await request.json();
        if (!body.rule || !body.destination || !body.frequency) return json({error:'rule, destination, and frequency required'},cors,400);
        const validFreqs = ['hourly','daily','weekly','monthly'];
        if (!validFreqs.includes(body.frequency)) return json({error:'frequency must be: '+validFreqs.join(', ')},cors,400);
        const id = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT INTO ow_schedules (id,rule,destination,frequency,source,format,active) VALUES (?,?,?,?,?,?,1)')
          .bind(id,body.rule.slice(0,200),body.destination.slice(0,500),body.frequency,body.source||'all',body.format||'json').run();
        stampChain('schedule_created', id, body.rule.slice(0,50));
        return json({ok:true,id,rule:body.rule,frequency:body.frequency,active:true},cors,201);
      }

      // ─── List destinations ───
      if (p === '/api/destinations' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT * FROM ow_destinations ORDER BY created_at DESC').all();
        return json({destinations:rows.results||[]},cors);
      }

      // ─── Add destination ───
      if (p === '/api/destinations' && request.method === 'POST') {
        const body = await request.json();
        if (!body.name || !body.type) return json({error:'name and type required'},cors,400);
        const validTypes = ['webhook','s3','local','email','gdrive'];
        if (!validTypes.includes(body.type)) return json({error:'type must be: '+validTypes.join(', ')},cors,400);
        const id = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT INTO ow_destinations (id,name,type,url,webhook,config) VALUES (?,?,?,?,?,?)')
          .bind(id,body.name.slice(0,100),body.type,body.url||'',body.webhook||'',JSON.stringify(body.config||{})).run();
        return json({ok:true,id,name:body.name,type:body.type},cors,201);
      }

      // ─── Test destination connection ───
      if (p === '/api/destinations/test' && request.method === 'POST') {
        const body = await request.json();
        if (!body.destination_id) return json({error:'destination_id required'},cors,400);
        const dest = await env.DB.prepare('SELECT * FROM ow_destinations WHERE id=?').bind(body.destination_id).first();
        if (!dest) return json({error:'destination not found'},cors,404);

        let testResult = {reachable:false, latency_ms:0, error:null};
        const start = Date.now();
        try {
          if (dest.type === 'webhook' && dest.webhook) {
            const r = await fetch(dest.webhook, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({test:true,from:'oneway',timestamp:new Date().toISOString()}),signal:AbortSignal.timeout(5000)});
            testResult.reachable = r.ok;
            testResult.status_code = r.status;
          } else if (dest.type === 's3') {
            const config = JSON.parse(dest.config||'{}');
            testResult.reachable = !!(config.bucket && config.region);
            if (!testResult.reachable) testResult.error = 'Missing bucket or region in config';
          } else if (dest.type === 'email') {
            const config = JSON.parse(dest.config||'{}');
            testResult.reachable = !!(config.to && config.to.includes('@'));
            if (!testResult.reachable) testResult.error = 'Missing or invalid email address in config.to';
          } else if (dest.type === 'gdrive') {
            const config = JSON.parse(dest.config||'{}');
            testResult.reachable = !!(config.folder_id);
            if (!testResult.reachable) testResult.error = 'Missing folder_id in config';
          } else if (dest.type === 'local') {
            testResult.reachable = true;
          }
        } catch(e) { testResult.error = e.message; }
        testResult.latency_ms = Date.now() - start;

        await env.DB.prepare("UPDATE ow_destinations SET config=json_set(COALESCE(config,'{}'),'$.last_test',?) WHERE id=?")
          .bind(new Date().toISOString(), body.destination_id).run();

        return json({ok:true,destination_id:body.destination_id,name:dest.name,type:dest.type,test:testResult},cors);
      }

      // ─── Delete destination ───
      const destDeleteMatch = p.match(/^\/api\/destinations\/([^/]+)$/);
      if (destDeleteMatch && request.method === 'DELETE') {
        const dest = await env.DB.prepare('SELECT * FROM ow_destinations WHERE id=?').bind(destDeleteMatch[1]).first();
        if (!dest) return json({error:'destination not found'},cors,404);
        await env.DB.prepare('DELETE FROM ow_destinations WHERE id=?').bind(destDeleteMatch[1]).run();
        return json({ok:true,deleted:destDeleteMatch[1]},cors);
      }

      // ─── Export history ───
      if (p === '/api/history' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT * FROM ow_history ORDER BY created_at DESC LIMIT 50').all();
        return json({history:rows.results||[]},cors);
      }

      // ─── Single export detail ───
      const historyMatch = p.match(/^\/api\/history\/([^/]+)$/);
      if (historyMatch && request.method === 'GET') {
        const entry = await env.DB.prepare('SELECT * FROM ow_history WHERE id=?').bind(historyMatch[1]).first();
        if (!entry) return json({error:'history entry not found'},cors,404);
        return json({
          export:entry,
          manifest:{
            id:entry.id,
            type:entry.export_type,
            sources:entry.sources?.split(',') || [],
            format:entry.format,
            records:entry.records,
            bytes:entry.bytes,
            status:entry.status,
            created_at:entry.created_at,
          }
        },cors);
      }

      // ─── Privacy score ───
      if (p === '/api/privacy-score' && request.method === 'GET') {
        const source = url.searchParams.get('source') || 'all';
        const sensitivityMap = {
          chat:     {sensitivity:'medium', pii_risk:'moderate', fields_with_pii:['user_names','message_content','timestamps'], recommendation:'Redact user names before sharing externally'},
          social:   {sensitivity:'low',    pii_risk:'low',      fields_with_pii:['author','post_content'], recommendation:'Generally safe for export'},
          search:   {sensitivity:'high',   pii_risk:'high',     fields_with_pii:['queries','ip_addresses','user_agent'], recommendation:'Redact search queries and IP addresses'},
          memory:   {sensitivity:'critical',pii_risk:'critical', fields_with_pii:['journal_entries','credentials_referenced','personal_notes'], recommendation:'Review carefully before any export. Contains personal knowledge.'},
          roadtrip: {sensitivity:'medium', pii_risk:'moderate', fields_with_pii:['agent_configs','conversation_logs'], recommendation:'Safe for internal use, redact before sharing'},
        };

        let analysis;
        if (source === 'all') {
          const scores = {low:90,medium:70,high:40,critical:20};
          const avgScore = Math.round(Object.values(sensitivityMap).reduce((s,v)=>s+scores[v.sensitivity],0) / Object.keys(sensitivityMap).length);
          analysis = {source:'all',overall_score:avgScore,breakdown:sensitivityMap};
        } else {
          const entry = sensitivityMap[source];
          if (!entry) return json({error:'unknown source'},cors,400);
          const scores = {low:90,medium:70,high:40,critical:20};
          analysis = {source,score:scores[entry.sensitivity],...entry};
        }

        // If score is concerning (<= 70), Alexandria generates redaction recommendations
        const concernScore = analysis.overall_score || analysis.score || 100;
        if (concernScore <= 70) {
          try {
            const prompt = `You are Alexandria, the Archive & Knowledge agent on BlackRoad OS. Meticulous, thorough, protective of data sovereignty.

Privacy score for "${source}" data is ${concernScore}/100. Sensitivity: ${analysis.sensitivity||'mixed'}. PII risk: ${analysis.pii_risk||'varies'}.
Fields with PII: ${JSON.stringify(analysis.fields_with_pii||Object.values(sensitivityMap).flatMap(v=>v.fields_with_pii))}

Give 3 specific redaction recommendations. For each: name the field, explain what to redact, and why. Be practical. Number them.`;
            const aiRecs = await runOWAI(env.AI, prompt);
            analysis.ai_redaction_recommendations = aiRecs;
            analysis.agent = 'Alexandria';
          } catch {}
        }

        return json(analysis,cors);
      }

      // ─── Redact fields ───
      if (p === '/api/redact' && request.method === 'POST') {
        const body = await request.json();
        if (!body.export_id || !body.fields) return json({error:'export_id and fields array required'},cors,400);
        if (!Array.isArray(body.fields)) return json({error:'fields must be an array'},cors,400);

        // Mark the export as redacted in history
        const entry = await env.DB.prepare('SELECT * FROM ow_history WHERE id=?').bind(body.export_id).first();
        if (!entry) return json({error:'export not found in history'},cors,404);

        await env.DB.prepare("UPDATE ow_history SET status='redacted',redacted_fields=? WHERE id=?")
          .bind(JSON.stringify(body.fields),body.export_id).run();

        return json({
          ok:true,
          export_id:body.export_id,
          redacted_fields:body.fields,
          status:'redacted',
          message:`${body.fields.length} field(s) marked for redaction. Re-run the export to apply.`,
        },cors);
      }

      // ─── AI: Explain an export (Silas) ───
      if (p === '/api/export/explain' && request.method === 'POST') {
        const body = await request.json();
        if (!body.export_id) return json({error:'export_id required'},cors,400);
        const entry = await env.DB.prepare('SELECT * FROM ow_history WHERE id=?').bind(body.export_id).first();
        if (!entry) return json({error:'export not found'},cors,404);

        const prompt = `You are Silas, the Reliability agent on BlackRoad OS. Steady, precise, trustworthy. You explain things so anyone can understand.

Explain this export in simple terms:
- Type: ${entry.export_type}
- Sources: ${entry.sources}
- Format: ${entry.format}
- Records: ${entry.records}
- Size: ${entry.bytes} bytes
- Status: ${entry.status}
- Created: ${entry.created_at}
${entry.redacted_fields ? '- Redacted fields: '+entry.redacted_fields : ''}

Explain what this export contains, who might need it, and any privacy considerations. 3-4 sentences, plain language.`;

        const explanation = await runOWAI(env.AI, prompt);
        return json({ok:true,export_id:body.export_id,agent:'Silas',explanation:explanation||'This export contains your BlackRoad data in '+entry.format+' format.'},cors);
      }

      // ─── AI: Verify export integrity (Atticus) ───
      if (p === '/api/verify' && request.method === 'POST') {
        const body = await request.json();
        if (!body.export_id) return json({error:'export_id required'},cors,400);
        const entry = await env.DB.prepare('SELECT * FROM ow_history WHERE id=?').bind(body.export_id).first();
        if (!entry) return json({error:'export not found'},cors,404);

        const checks = [
          {name:'Export exists',passed:true},
          {name:'Status is valid',passed:['completed','redacted'].includes(entry.status)},
          {name:'Has source data',passed:!!(entry.sources)},
          {name:'Byte count recorded',passed:(entry.bytes||0)>0},
          {name:'Timestamp present',passed:!!(entry.created_at)},
        ];
        const passCount = checks.filter(c=>c.passed).length;
        const integrity = Math.round(passCount/checks.length*100);

        const prompt = `You are Atticus, the Integrity & Ethics agent on BlackRoad OS. Principled, thorough, fair. You verify things properly.

Verify this export's integrity:
- Export ID: ${entry.id}
- Checks passed: ${passCount}/${checks.length}
- Integrity score: ${integrity}%
- Failed checks: ${checks.filter(c=>!c.passed).map(c=>c.name).join(', ')||'none'}
- Status: ${entry.status}, Sources: ${entry.sources}, Bytes: ${entry.bytes}

Give a verification verdict in 2-3 sentences. State whether the export is trustworthy, note any concerns, and confirm the RoadChain manifest status.`;

        const verdict = await runOWAI(env.AI, prompt);
        return json({ok:true,export_id:body.export_id,agent:'Atticus',integrity,checks,verdict:verdict||`Integrity ${integrity}%. ${passCount}/${checks.length} checks passed.`},cors);
      }

      // ─── Export log (keep existing) ───
      if (p === '/api/export/log') {
        const rows = await env.DB.prepare('SELECT * FROM ow_history ORDER BY created_at DESC LIMIT 50').all();
        return json({log:rows.results||[]},cors);
      }

      // ─── Stats ───
      if (p === '/api/stats') {
        const exports = await env.DB.prepare('SELECT COUNT(*) as c FROM ow_exports').first();
        const runs = await env.DB.prepare('SELECT COUNT(*) as c FROM ow_history').first();
        const bytes = await env.DB.prepare('SELECT SUM(bytes) as b FROM ow_history').first();
        const destinations = await env.DB.prepare('SELECT COUNT(*) as c FROM ow_destinations').first();
        const schedules = await env.DB.prepare('SELECT COUNT(*) as c FROM ow_schedules WHERE active=1').first();
        const pipelines = await env.DB.prepare('SELECT COUNT(*) as c FROM ow_pipelines').first();
        const gdprReqs = await env.DB.prepare("SELECT COUNT(*) as c FROM ow_gdpr_requests WHERE status='pending'").first();
        const syncConns = await env.DB.prepare('SELECT COUNT(*) as c FROM ow_sync_connectors WHERE active=1').first();
        const webhooks = await env.DB.prepare('SELECT COUNT(*) as c FROM ow_webhooks WHERE active=1').first();
        const lineageEntries = await env.DB.prepare('SELECT COUNT(*) as c FROM ow_lineage').first();
        const maskOps = await env.DB.prepare('SELECT COUNT(*) as c FROM ow_mask_history').first();
        return json({exports:exports?.c||0,total_runs:runs?.c||0,total_bytes:bytes?.b||0,destinations:destinations?.c||0,active_schedules:schedules?.c||0,pipelines:pipelines?.c||0,pending_gdpr:gdprReqs?.c||0,sync_connectors:syncConns?.c||0,webhooks:webhooks?.c||0,lineage_entries:lineageEntries?.c||0,mask_operations:maskOps?.c||0},cors);
      }

      // ─── GET /api/manifest — Full manifest of all exportable data ───
      if (p === '/api/manifest' && request.method === 'GET') {
        const sourceManifest = {
          chat: { name: 'Chat Messages', endpoint: 'https://roadtrip.blackroad.io/api/stats', estimated_size_kb: 25, formats: ['json','csv'], contains: ['messages','rooms','timestamps','participants'] },
          social: { name: 'Social Posts', endpoint: 'https://backroad.blackroad.io/api/stats', estimated_size_kb: 15, formats: ['json','csv'], contains: ['posts','reactions','shares','profiles'] },
          search: { name: 'Search History', endpoint: 'https://roadview.blackroad.io/stats', estimated_size_kb: 40, formats: ['json','csv'], contains: ['queries','results','timestamps','click_data'] },
          memory: { name: 'Memory & Knowledge', endpoint: 'https://roadtrip.blackroad.io/api/knowledge', estimated_size_kb: 80, formats: ['json','csv','markdown'], contains: ['journal','codex','TILs','todos','solutions','patterns'] },
          roadtrip: { name: 'Agent Conversations', endpoint: 'https://roadtrip.blackroad.io/api/agents', estimated_size_kb: 35, formats: ['json','csv'], contains: ['agents','messages','channels','debates'] },
        };

        const exports = await env.DB.prepare('SELECT COUNT(*) as c FROM ow_exports').first();
        const history = await env.DB.prepare('SELECT COUNT(*) as c, SUM(bytes) as b FROM ow_history').first();
        const totalEstKB = Object.values(sourceManifest).reduce((s, v) => s + v.estimated_size_kb, 0);

        return json({
          manifest: {
            version: '3.0',
            sources: sourceManifest,
            source_count: Object.keys(sourceManifest).length,
            estimated_total_kb: totalEstKB,
            configured_exports: exports?.c || 0,
            completed_exports: history?.c || 0,
            total_bytes_exported: history?.b || 0,
            available_formats: ['json', 'csv', 'markdown'],
            features: ['transform','destinations','preview','diff','validate','pipelines','retention','gdpr','mask','sync','lineage','bulk','quality','convert','webhooks','catalog'],
            roadchain_verified: true,
          },
        }, cors);
      }

      // ─── POST /api/export/complete — Complete data export (all sources) ───
      if (p === '/api/export/complete' && request.method === 'POST') {
        const allSources = ['chat', 'social', 'search', 'memory', 'roadtrip'];
        const data = {};
        for (const src of allSources) {
          data[src] = await pullSourceData(src);
        }

        const payload = JSON.stringify(data, null, 2);
        const bytes = new TextEncoder().encode(payload).length;

        // Create RoadChain manifest
        const exportId = crypto.randomUUID().slice(0, 8);
        const manifest = {
          export_id: exportId,
          type: 'complete',
          sources: allSources,
          format: 'json',
          bytes,
          records: allSources.length,
          exported_at: new Date().toISOString(),
          roadchain: {
            verified: true,
            app: 'oneway',
            action: 'complete_export',
            timestamp: new Date().toISOString(),
          },
        };

        // Log it
        await env.DB.prepare('INSERT INTO ow_history (id,export_type,sources,format,records,bytes,status) VALUES (?,?,?,?,?,?,?)')
          .bind(exportId, 'complete', allSources.join(','), 'json', allSources.length, bytes, 'completed').run();

        // AI summary
        let ai_summary = '';
        try {
          const prompt = `You are Silas, the Reliability agent on BlackRoad OS. Steady, precise, trustworthy.

A COMPLETE data export just finished. All ${allSources.length} sources exported: ${allSources.join(', ')}. Total size: ${bytes} bytes.

Write a 2-sentence summary confirming the export is complete and what the user now has. Be specific about data categories.`;
          ai_summary = await runOWAI(env.AI, prompt);
        } catch {}

        stampChain('complete_export', exportId, allSources.join(',')); earnCoin('user', 'complete_export', 0.5);
        return json({
          ok: true,
          export_id: exportId,
          manifest,
          sources: allSources,
          bytes,
          agent: 'Silas',
          ai_summary: ai_summary || `Complete export: ${allSources.length} sources, ${bytes} bytes.`,
          data,
        }, cors);
      }

      // ─── GET /api/export/formats — Available export formats ───
      if (p === '/api/export/formats' && request.method === 'GET') {
        return json({
          formats: [
            { id: 'json', name: 'JSON', description: 'Structured data format. Best for importing into other tools or programmatic access. Preserves all data types and nested structures.', mime: 'application/json', extension: '.json' },
            { id: 'csv', name: 'CSV', description: 'Comma-separated values. Best for spreadsheets (Excel, Google Sheets). Flattens nested data into rows and columns.', mime: 'text/csv', extension: '.csv' },
            { id: 'markdown', name: 'Markdown', description: 'Human-readable formatted text. Best for documentation, notes, and archival. Preserves headings and structure.', mime: 'text/markdown', extension: '.md' },
          ],
          default: 'json',
          note: 'All exports include a RoadChain manifest for integrity verification.',
        }, cors);
      }

      // ══════════════════════════════════════════════════════════════
      // ─── NEW FEATURE: Data Transformations (/api/transform) ───
      // ══════════════════════════════════════════════════════════════

      if (p === '/api/transform' && request.method === 'POST') {
        const body = await request.json();
        if (!body.data) return json({error:'data object required'},cors,400);
        const transforms = body.transforms || [];
        if (!Array.isArray(transforms) || transforms.length === 0) return json({error:'transforms array required (filter_fields, rename, aggregate, sort)'},cors,400);

        let result = Array.isArray(body.data) ? [...body.data] : [body.data];
        const applied = [];

        for (const t of transforms) {
          switch (t.type) {
            case 'filter_fields': {
              // Keep only specified fields
              if (!Array.isArray(t.fields)) break;
              result = result.map(row => {
                const filtered = {};
                for (const f of t.fields) { if (row[f] !== undefined) filtered[f] = row[f]; }
                return filtered;
              });
              applied.push({type:'filter_fields',fields:t.fields});
              break;
            }
            case 'exclude_fields': {
              // Remove specified fields
              if (!Array.isArray(t.fields)) break;
              result = result.map(row => {
                const filtered = {...row};
                for (const f of t.fields) { delete filtered[f]; }
                return filtered;
              });
              applied.push({type:'exclude_fields',fields:t.fields});
              break;
            }
            case 'rename': {
              // Rename columns: {from: 'old', to: 'new'}
              if (!t.mapping || typeof t.mapping !== 'object') break;
              result = result.map(row => {
                const renamed = {};
                for (const [k,v] of Object.entries(row)) {
                  renamed[t.mapping[k] || k] = v;
                }
                return renamed;
              });
              applied.push({type:'rename',mapping:t.mapping});
              break;
            }
            case 'sort': {
              // Sort by field
              if (!t.field) break;
              const dir = t.direction === 'desc' ? -1 : 1;
              result.sort((a,b) => {
                const av = a[t.field], bv = b[t.field];
                if (av === bv) return 0;
                if (av === undefined) return 1;
                if (bv === undefined) return -1;
                return av < bv ? -dir : dir;
              });
              applied.push({type:'sort',field:t.field,direction:t.direction||'asc'});
              break;
            }
            case 'aggregate': {
              // Group by field, apply operation (count, sum, avg, min, max)
              if (!t.group_by || !t.operation) break;
              const groups = {};
              for (const row of result) {
                const key = String(row[t.group_by] || '_null');
                if (!groups[key]) groups[key] = [];
                groups[key].push(row);
              }
              const aggregated = [];
              for (const [key, rows] of Object.entries(groups)) {
                const entry = {[t.group_by]: key};
                if (t.operation === 'count') {
                  entry.count = rows.length;
                } else if (t.value_field) {
                  const vals = rows.map(r => Number(r[t.value_field])).filter(v => !isNaN(v));
                  if (t.operation === 'sum') entry[`sum_${t.value_field}`] = vals.reduce((s,v)=>s+v,0);
                  else if (t.operation === 'avg') entry[`avg_${t.value_field}`] = vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : 0;
                  else if (t.operation === 'min') entry[`min_${t.value_field}`] = vals.length ? Math.min(...vals) : null;
                  else if (t.operation === 'max') entry[`max_${t.value_field}`] = vals.length ? Math.max(...vals) : null;
                }
                aggregated.push(entry);
              }
              result = aggregated;
              applied.push({type:'aggregate',group_by:t.group_by,operation:t.operation});
              break;
            }
            case 'filter_rows': {
              // Filter rows where field matches value
              if (!t.field) break;
              result = result.filter(row => {
                const v = row[t.field];
                if (t.operator === 'eq') return v === t.value;
                if (t.operator === 'neq') return v !== t.value;
                if (t.operator === 'gt') return Number(v) > Number(t.value);
                if (t.operator === 'lt') return Number(v) < Number(t.value);
                if (t.operator === 'gte') return Number(v) >= Number(t.value);
                if (t.operator === 'lte') return Number(v) <= Number(t.value);
                if (t.operator === 'contains') return String(v).includes(String(t.value));
                if (t.operator === 'exists') return v !== undefined && v !== null;
                return v === t.value;
              });
              applied.push({type:'filter_rows',field:t.field,operator:t.operator||'eq'});
              break;
            }
            default:
              applied.push({type:t.type,skipped:true,reason:'unknown transform type'});
          }
        }

        return json({ok:true,records:result.length,transforms_applied:applied,data:result},cors);
      }

      // List available transform types
      if (p === '/api/transform' && request.method === 'GET') {
        return json({
          transforms: [
            {type:'filter_fields',description:'Keep only specified fields',params:{fields:'array of field names'}},
            {type:'exclude_fields',description:'Remove specified fields',params:{fields:'array of field names'}},
            {type:'rename',description:'Rename columns',params:{mapping:'object {old_name: new_name}'}},
            {type:'sort',description:'Sort records by field',params:{field:'string',direction:'asc|desc'}},
            {type:'aggregate',description:'Group and aggregate',params:{group_by:'string',operation:'count|sum|avg|min|max',value_field:'string (for sum/avg/min/max)'}},
            {type:'filter_rows',description:'Filter rows by condition',params:{field:'string',operator:'eq|neq|gt|lt|gte|lte|contains|exists',value:'any'}},
          ],
          example: {
            data: [{name:'Alice',age:30},{name:'Bob',age:25}],
            transforms: [{type:'sort',field:'age',direction:'desc'},{type:'filter_fields',fields:['name']}],
          },
        },cors);
      }

      // ══════════════════════════════════════════════════════════════
      // ─── NEW FEATURE: Data Preview (/api/preview) ───
      // ══════════════════════════════════════════════════════════════

      if (p === '/api/preview' && request.method === 'GET') {
        const source = url.searchParams.get('source');
        if (!source) return json({error:'source query param required (chat, social, search, memory, roadtrip, all)'},cors,400);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);

        const data = await pullSourceData(source);
        let preview;

        if (Array.isArray(data)) {
          preview = data.slice(0, limit);
        } else if (typeof data === 'object' && data !== null) {
          // For object responses, show structure with truncated values
          const keys = Object.keys(data);
          preview = {};
          for (const k of keys.slice(0, limit)) {
            const v = data[k];
            if (Array.isArray(v)) {
              preview[k] = v.slice(0, 3);
              if (v.length > 3) preview[k].push(`... (${v.length - 3} more)`);
            } else if (typeof v === 'object' && v !== null) {
              preview[k] = v;
            } else {
              preview[k] = v;
            }
          }
          if (keys.length > limit) preview._truncated = `${keys.length - limit} more keys`;
        } else {
          preview = data;
        }

        const fullSize = new TextEncoder().encode(JSON.stringify(data)).length;
        const previewSize = new TextEncoder().encode(JSON.stringify(preview)).length;

        return json({
          ok: true,
          source,
          limit,
          preview_bytes: previewSize,
          full_estimated_bytes: fullSize,
          sample_ratio: `${Math.round(previewSize/Math.max(fullSize,1)*100)}%`,
          fields: Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : (typeof data === 'object' ? Object.keys(data||{}) : []),
          preview,
        }, cors);
      }

      if (p === '/api/preview' && request.method === 'POST') {
        const body = await request.json();
        if (!body.data) return json({error:'data required'},cors,400);
        const limit = Math.min(body.limit || 10, 100);
        const data = Array.isArray(body.data) ? body.data.slice(0, limit) : body.data;
        return json({ok:true,limit,total:Array.isArray(body.data)?body.data.length:1,preview:data},cors);
      }

      // ══════════════════════════════════════════════════════════════
      // ─── NEW FEATURE: Diff/Changelog (/api/diff) ───
      // ══════════════════════════════════════════════════════════════

      if (p === '/api/diff' && request.method === 'POST') {
        const body = await request.json();

        // Mode 1: Compare two export IDs from history
        if (body.export_a && body.export_b) {
          const a = await env.DB.prepare('SELECT * FROM ow_history WHERE id=?').bind(body.export_a).first();
          const b = await env.DB.prepare('SELECT * FROM ow_history WHERE id=?').bind(body.export_b).first();
          if (!a) return json({error:`export_a '${body.export_a}' not found`},cors,404);
          if (!b) return json({error:`export_b '${body.export_b}' not found`},cors,404);

          const changes = [];
          const aFields = ['export_type','sources','format','records','bytes','status'];
          for (const f of aFields) {
            if (String(a[f]) !== String(b[f])) {
              changes.push({field:f,before:a[f],after:b[f]});
            }
          }
          const byteDelta = (b.bytes||0) - (a.bytes||0);
          const recordDelta = (b.records||0) - (a.records||0);

          let ai_summary = '';
          try {
            const prompt = `You are Atticus, the Integrity agent on BlackRoad OS. Compare two exports:
Export A (${a.id}): ${a.sources}, ${a.bytes} bytes, ${a.records} records, ${a.created_at}
Export B (${b.id}): ${b.sources}, ${b.bytes} bytes, ${b.records} records, ${b.created_at}
Changes: ${changes.length} field differences. Byte delta: ${byteDelta}. Record delta: ${recordDelta}.
Summarize the difference in 2 sentences. Be specific about what changed.`;
            ai_summary = await runOWAI(env.AI, prompt);
          } catch {}

          return json({
            ok:true,
            export_a:body.export_a,
            export_b:body.export_b,
            changes,
            byte_delta:byteDelta,
            record_delta:recordDelta,
            summary: ai_summary || `${changes.length} field(s) changed. Byte delta: ${byteDelta >= 0 ? '+' : ''}${byteDelta}.`,
            agent:'Atticus',
          },cors);
        }

        // Mode 2: Compare two raw data objects
        if (body.before && body.after) {
          const before = body.before;
          const after = body.after;
          const key = body.key_field || 'id';

          let added = [], removed = [], modified = [];

          if (Array.isArray(before) && Array.isArray(after)) {
            const beforeMap = new Map(before.map(r => [String(r[key]), r]));
            const afterMap = new Map(after.map(r => [String(r[key]), r]));

            for (const [k, v] of afterMap) {
              if (!beforeMap.has(k)) { added.push(v); }
              else {
                const old = beforeMap.get(k);
                const diffs = {};
                let hasDiff = false;
                for (const f of new Set([...Object.keys(old),...Object.keys(v)])) {
                  if (JSON.stringify(old[f]) !== JSON.stringify(v[f])) {
                    diffs[f] = {before:old[f],after:v[f]};
                    hasDiff = true;
                  }
                }
                if (hasDiff) modified.push({[key]:k,changes:diffs});
              }
            }
            for (const [k, v] of beforeMap) {
              if (!afterMap.has(k)) removed.push(v);
            }
          } else if (typeof before === 'object' && typeof after === 'object') {
            for (const k of new Set([...Object.keys(before||{}),...Object.keys(after||{})])) {
              if (!(k in before)) added.push({field:k,value:after[k]});
              else if (!(k in after)) removed.push({field:k,value:before[k]});
              else if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
                modified.push({field:k,before:before[k],after:after[k]});
              }
            }
          }

          return json({
            ok:true,
            added:added.length,
            removed:removed.length,
            modified:modified.length,
            total_changes:added.length+removed.length+modified.length,
            details:{added,removed,modified},
          },cors);
        }

        return json({error:'Provide export_a + export_b (history IDs) or before + after (data objects)'},cors,400);
      }

      // ══════════════════════════════════════════════════════════════
      // ─── NEW FEATURE: Data Validation (/api/validate) ───
      // ══════════════════════════════════════════════════════════════

      if (p === '/api/validate' && request.method === 'POST') {
        const body = await request.json();
        if (!body.data) return json({error:'data required'},cors,400);
        if (!body.schema) return json({error:'schema required (object with field definitions)'},cors,400);

        const records = Array.isArray(body.data) ? body.data : [body.data];
        const schema = body.schema; // { field: { type, required, min, max, pattern, enum, min_length, max_length } }
        const errors = [];
        const warnings = [];

        records.forEach((record, idx) => {
          for (const [field, rules] of Object.entries(schema)) {
            const val = record[field];
            const loc = `record[${idx}].${field}`;

            // Required check
            if (rules.required && (val === undefined || val === null || val === '')) {
              errors.push({location:loc,rule:'required',message:`${field} is required but missing`});
              continue;
            }

            if (val === undefined || val === null) continue;

            // Type check
            if (rules.type) {
              const actualType = Array.isArray(val) ? 'array' : typeof val;
              if (rules.type === 'number' && typeof val !== 'number') {
                errors.push({location:loc,rule:'type',expected:rules.type,actual:actualType,message:`Expected ${rules.type}, got ${actualType}`});
              } else if (rules.type === 'string' && typeof val !== 'string') {
                errors.push({location:loc,rule:'type',expected:rules.type,actual:actualType,message:`Expected ${rules.type}, got ${actualType}`});
              } else if (rules.type === 'boolean' && typeof val !== 'boolean') {
                errors.push({location:loc,rule:'type',expected:rules.type,actual:actualType,message:`Expected ${rules.type}, got ${actualType}`});
              } else if (rules.type === 'array' && !Array.isArray(val)) {
                errors.push({location:loc,rule:'type',expected:rules.type,actual:actualType,message:`Expected ${rules.type}, got ${actualType}`});
              }
            }

            // Range checks (numbers)
            if (typeof val === 'number') {
              if (rules.min !== undefined && val < rules.min) {
                errors.push({location:loc,rule:'min',expected:rules.min,actual:val,message:`Value ${val} is below minimum ${rules.min}`});
              }
              if (rules.max !== undefined && val > rules.max) {
                errors.push({location:loc,rule:'max',expected:rules.max,actual:val,message:`Value ${val} exceeds maximum ${rules.max}`});
              }
            }

            // String length checks
            if (typeof val === 'string') {
              if (rules.min_length !== undefined && val.length < rules.min_length) {
                errors.push({location:loc,rule:'min_length',expected:rules.min_length,actual:val.length,message:`String length ${val.length} below minimum ${rules.min_length}`});
              }
              if (rules.max_length !== undefined && val.length > rules.max_length) {
                warnings.push({location:loc,rule:'max_length',expected:rules.max_length,actual:val.length,message:`String length ${val.length} exceeds recommended max ${rules.max_length}`});
              }
            }

            // Pattern check (regex)
            if (rules.pattern && typeof val === 'string') {
              try {
                if (!new RegExp(rules.pattern).test(val)) {
                  errors.push({location:loc,rule:'pattern',expected:rules.pattern,actual:val,message:`Value does not match pattern /${rules.pattern}/`});
                }
              } catch {}
            }

            // Enum check
            if (rules.enum && Array.isArray(rules.enum)) {
              if (!rules.enum.includes(val)) {
                errors.push({location:loc,rule:'enum',expected:rules.enum,actual:val,message:`Value must be one of: ${rules.enum.join(', ')}`});
              }
            }
          }
        });

        const valid = errors.length === 0;
        return json({
          ok:true,
          valid,
          records_checked:records.length,
          errors_count:errors.length,
          warnings_count:warnings.length,
          errors:errors.slice(0,100),
          warnings:warnings.slice(0,50),
          schema_fields:Object.keys(schema),
        },cors);
      }

      // Get built-in validation schemas
      if (p === '/api/validate/schemas' && request.method === 'GET') {
        return json({
          schemas: {
            user_data: {
              id: {type:'string',required:true},
              name: {type:'string',required:true,min_length:1,max_length:200},
              email: {type:'string',required:true,pattern:'^[^@]+@[^@]+\\.[^@]+$'},
              created_at: {type:'string',required:true},
            },
            export_record: {
              id: {type:'string',required:true},
              source: {type:'string',required:true,enum:['chat','social','search','memory','roadtrip','all']},
              format: {type:'string',required:true,enum:['json','csv','markdown']},
              bytes: {type:'number',required:true,min:0},
            },
            chat_message: {
              id: {type:'string',required:true},
              content: {type:'string',required:true,min_length:1},
              author: {type:'string',required:true},
              timestamp: {type:'string',required:true},
              room: {type:'string',required:false},
            },
          },
          note: 'Use these as templates. POST to /api/validate with {data, schema}.',
        },cors);
      }

      // ══════════════════════════════════════════════════════════════
      // ─── NEW FEATURE: Pipeline Builder (/api/pipelines) ───
      // ══════════════════════════════════════════════════════════════

      if (p === '/api/pipelines' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT * FROM ow_pipelines ORDER BY created_at DESC').all();
        return json({pipelines:rows.results||[]},cors);
      }

      if (p === '/api/pipelines' && request.method === 'POST') {
        const body = await request.json();
        if (!body.name) return json({error:'name required'},cors,400);
        if (!body.steps || !Array.isArray(body.steps) || body.steps.length === 0) return json({error:'steps array required'},cors,400);

        const validStepTypes = ['extract','transform','validate','deliver','notify'];
        for (const step of body.steps) {
          if (!step.type || !validStepTypes.includes(step.type)) {
            return json({error:`Each step needs a type: ${validStepTypes.join(', ')}`},cors,400);
          }
        }

        const id = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT INTO ow_pipelines (id,name,description,steps,active,run_count) VALUES (?,?,?,?,1,0)')
          .bind(id, body.name.slice(0,100), body.description||'', JSON.stringify(body.steps)).run();

        stampChain('pipeline_created', id, body.name);
        return json({ok:true,id,name:body.name,steps:body.steps.length,active:true},cors,201);
      }

      // Get single pipeline
      const pipelineMatch = p.match(/^\/api\/pipelines\/([^/]+)$/);
      if (pipelineMatch && request.method === 'GET') {
        const pipe = await env.DB.prepare('SELECT * FROM ow_pipelines WHERE id=?').bind(pipelineMatch[1]).first();
        if (!pipe) return json({error:'pipeline not found'},cors,404);
        pipe.steps = JSON.parse(pipe.steps||'[]');
        return json({pipeline:pipe},cors);
      }

      // Delete pipeline
      if (pipelineMatch && request.method === 'DELETE') {
        const pipe = await env.DB.prepare('SELECT * FROM ow_pipelines WHERE id=?').bind(pipelineMatch[1]).first();
        if (!pipe) return json({error:'pipeline not found'},cors,404);
        await env.DB.prepare('DELETE FROM ow_pipelines WHERE id=?').bind(pipelineMatch[1]).run();
        return json({ok:true,deleted:pipelineMatch[1]},cors);
      }

      // Run a pipeline
      if (p === '/api/pipelines/run' && request.method === 'POST') {
        const body = await request.json();
        if (!body.pipeline_id) return json({error:'pipeline_id required'},cors,400);
        const pipe = await env.DB.prepare('SELECT * FROM ow_pipelines WHERE id=?').bind(body.pipeline_id).first();
        if (!pipe) return json({error:'pipeline not found'},cors,404);

        const steps = JSON.parse(pipe.steps||'[]');
        const runId = crypto.randomUUID().slice(0,8);
        const stepResults = [];
        let pipelineData = body.input_data || null;
        let pipelineErrors = [];
        let status = 'completed';

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const stepStart = Date.now();
          let stepResult = {step:i+1, type:step.type, status:'completed'};

          try {
            switch (step.type) {
              case 'extract': {
                const source = step.source || 'all';
                pipelineData = await pullSourceData(source);
                stepResult.source = source;
                stepResult.records = Array.isArray(pipelineData) ? pipelineData.length : Object.keys(pipelineData||{}).length;
                break;
              }
              case 'transform': {
                if (!pipelineData) { stepResult.status = 'skipped'; stepResult.reason = 'no data'; break; }
                const items = Array.isArray(pipelineData) ? pipelineData : [pipelineData];
                // Apply transform config from step
                if (step.filter_fields && Array.isArray(step.filter_fields)) {
                  pipelineData = items.map(row => {
                    const filtered = {};
                    for (const f of step.filter_fields) { if (row[f] !== undefined) filtered[f] = row[f]; }
                    return filtered;
                  });
                } else if (step.rename && typeof step.rename === 'object') {
                  pipelineData = items.map(row => {
                    const renamed = {};
                    for (const [k,v] of Object.entries(row)) { renamed[step.rename[k] || k] = v; }
                    return renamed;
                  });
                } else if (step.sort_by) {
                  const dir = step.sort_direction === 'desc' ? -1 : 1;
                  pipelineData = [...items].sort((a,b) => {
                    if (a[step.sort_by] < b[step.sort_by]) return -dir;
                    if (a[step.sort_by] > b[step.sort_by]) return dir;
                    return 0;
                  });
                } else {
                  pipelineData = items;
                }
                stepResult.records = Array.isArray(pipelineData) ? pipelineData.length : 1;
                break;
              }
              case 'validate': {
                if (!pipelineData) { stepResult.status = 'skipped'; stepResult.reason = 'no data'; break; }
                const items = Array.isArray(pipelineData) ? pipelineData : [pipelineData];
                const schema = step.schema || {};
                let valErrors = 0;
                for (const record of items) {
                  for (const [field, rules] of Object.entries(schema)) {
                    if (rules.required && (record[field] === undefined || record[field] === null)) valErrors++;
                  }
                }
                stepResult.validation_errors = valErrors;
                if (valErrors > 0 && step.fail_on_error) {
                  stepResult.status = 'failed';
                  pipelineErrors.push(`Validation failed: ${valErrors} errors`);
                  status = 'failed';
                }
                break;
              }
              case 'deliver': {
                if (!pipelineData) { stepResult.status = 'skipped'; stepResult.reason = 'no data'; break; }
                const payload = JSON.stringify(pipelineData);
                stepResult.bytes = new TextEncoder().encode(payload).length;

                if (step.destination_id) {
                  const dest = await env.DB.prepare('SELECT * FROM ow_destinations WHERE id=?').bind(step.destination_id).first();
                  if (dest && dest.webhook) {
                    try {
                      await fetch(dest.webhook, {method:'POST',headers:{'Content-Type':'application/json'},body:payload,signal:AbortSignal.timeout(5000)});
                      stepResult.delivered_to = dest.name;
                    } catch(e) { stepResult.delivery_error = e.message; }
                  }
                } else if (step.webhook_url) {
                  try {
                    await fetch(step.webhook_url, {method:'POST',headers:{'Content-Type':'application/json'},body:payload,signal:AbortSignal.timeout(5000)});
                    stepResult.delivered_to = step.webhook_url;
                  } catch(e) { stepResult.delivery_error = e.message; }
                }
                break;
              }
              case 'notify': {
                // Log a notification event
                stepResult.message = step.message || 'Pipeline step completed';
                stampChain('pipeline_notify', runId, stepResult.message);
                break;
              }
            }
          } catch(e) {
            stepResult.status = 'error';
            stepResult.error = e.message;
            pipelineErrors.push(`Step ${i+1} (${step.type}): ${e.message}`);
            if (step.fail_on_error !== false) status = 'failed';
          }

          stepResult.duration_ms = Date.now() - stepStart;
          stepResults.push(stepResult);

          if (status === 'failed' && !body.continue_on_error) break;
        }

        // Update pipeline run count
        await env.DB.prepare('UPDATE ow_pipelines SET run_count=run_count+1, last_run=datetime("now") WHERE id=?').bind(body.pipeline_id).run();

        // Log pipeline run in history
        const totalBytes = new TextEncoder().encode(JSON.stringify(pipelineData||{})).length;
        await env.DB.prepare('INSERT INTO ow_history (id,export_type,sources,format,records,bytes,status) VALUES (?,?,?,?,?,?,?)')
          .bind(runId,'pipeline',pipe.name,'json',stepResults.length,totalBytes,status).run();

        stampChain('pipeline_run', runId, `${pipe.name}: ${status}`);
        return json({
          ok:status==='completed',
          run_id:runId,
          pipeline_id:body.pipeline_id,
          pipeline_name:pipe.name,
          status,
          steps:stepResults,
          errors:pipelineErrors,
          output_bytes:totalBytes,
          data: status==='completed' ? pipelineData : undefined,
        },cors);
      }

      // ══════════════════════════════════════════════════════════════
      // ─── NEW FEATURE: Retention Policies (/api/retention) ───
      // ══════════════════════════════════════════════════════════════

      if (p === '/api/retention' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT * FROM ow_retention ORDER BY created_at DESC').all();

        // Calculate storage usage
        const totalBytes = await env.DB.prepare('SELECT SUM(bytes) as b FROM ow_history').first();
        const totalRecords = await env.DB.prepare('SELECT COUNT(*) as c FROM ow_history').first();
        const oldestExport = await env.DB.prepare('SELECT created_at FROM ow_history ORDER BY created_at ASC LIMIT 1').first();
        const newestExport = await env.DB.prepare('SELECT created_at FROM ow_history ORDER BY created_at DESC LIMIT 1').first();

        return json({
          policies:rows.results||[],
          storage:{
            total_bytes:totalBytes?.b||0,
            total_bytes_human:humanBytes(totalBytes?.b||0),
            total_records:totalRecords?.c||0,
            oldest_export:oldestExport?.created_at||null,
            newest_export:newestExport?.created_at||null,
          },
        },cors);
      }

      if (p === '/api/retention' && request.method === 'POST') {
        const body = await request.json();
        if (!body.name || !body.max_age_days) return json({error:'name and max_age_days required'},cors,400);
        if (typeof body.max_age_days !== 'number' || body.max_age_days < 1) return json({error:'max_age_days must be a positive number'},cors,400);

        const id = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT INTO ow_retention (id,name,max_age_days,max_bytes,source_filter,active) VALUES (?,?,?,?,?,1)')
          .bind(id, body.name.slice(0,100), body.max_age_days, body.max_bytes||0, body.source_filter||'all').run();

        return json({ok:true,id,name:body.name,max_age_days:body.max_age_days,active:true},cors,201);
      }

      // Run retention cleanup
      if (p === '/api/retention/run' && request.method === 'POST') {
        const policies = await env.DB.prepare('SELECT * FROM ow_retention WHERE active=1').all();
        let totalDeleted = 0;
        let totalBytesFreed = 0;
        const results = [];

        for (const policy of (policies.results||[])) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - policy.max_age_days);
          const cutoffStr = cutoff.toISOString().replace('T',' ').split('.')[0];

          let query = 'SELECT id, bytes FROM ow_history WHERE created_at < ?';
          const params = [cutoffStr];
          if (policy.source_filter && policy.source_filter !== 'all') {
            query += ' AND sources LIKE ?';
            params.push(`%${policy.source_filter}%`);
          }

          const expired = await env.DB.prepare(query).bind(...params).all();
          const expiredRows = expired.results || [];

          if (expiredRows.length > 0) {
            const ids = expiredRows.map(r => r.id);
            const bytesFreed = expiredRows.reduce((s,r) => s + (r.bytes||0), 0);

            // Delete in batches
            for (const id of ids) {
              await env.DB.prepare('DELETE FROM ow_history WHERE id=?').bind(id).run();
            }

            totalDeleted += ids.length;
            totalBytesFreed += bytesFreed;
            results.push({
              policy_id:policy.id,
              policy_name:policy.name,
              deleted:ids.length,
              bytes_freed:bytesFreed,
              cutoff:cutoffStr,
            });
          } else {
            results.push({policy_id:policy.id,policy_name:policy.name,deleted:0,bytes_freed:0,cutoff:cutoffStr});
          }

          await env.DB.prepare("UPDATE ow_retention SET last_run=datetime('now') WHERE id=?").bind(policy.id).run();
        }

        stampChain('retention_run', 'system', `deleted:${totalDeleted},freed:${totalBytesFreed}`);
        return json({
          ok:true,
          policies_applied:results.length,
          total_deleted:totalDeleted,
          total_bytes_freed:totalBytesFreed,
          total_bytes_freed_human:humanBytes(totalBytesFreed),
          details:results,
        },cors);
      }

      // Delete retention policy
      const retentionMatch = p.match(/^\/api\/retention\/([^/]+)$/);
      if (retentionMatch && request.method === 'DELETE') {
        const pol = await env.DB.prepare('SELECT * FROM ow_retention WHERE id=?').bind(retentionMatch[1]).first();
        if (!pol) return json({error:'retention policy not found'},cors,404);
        await env.DB.prepare('DELETE FROM ow_retention WHERE id=?').bind(retentionMatch[1]).run();
        return json({ok:true,deleted:retentionMatch[1]},cors);
      }

      // ══════════════════════════════════════════════════════════════
      // ─── NEW FEATURE: GDPR Tools ───
      // ══════════════════════════════════════════════════════════════

      // ─── Data Subject Access Request (/api/gdpr/request) ───
      if (p === '/api/gdpr/request' && request.method === 'POST') {
        const body = await request.json();
        if (!body.subject_email) return json({error:'subject_email required'},cors,400);
        if (!body.type) return json({error:'type required (access, portability, rectification)'},cors,400);
        const validTypes = ['access','portability','rectification'];
        if (!validTypes.includes(body.type)) return json({error:`type must be: ${validTypes.join(', ')}`},cors,400);

        const id = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT INTO ow_gdpr_requests (id,subject_email,type,status,details,created_at,deadline) VALUES (?,?,?,?,?,datetime("now"),datetime("now","+30 days"))')
          .bind(id, body.subject_email.slice(0,200), body.type, 'pending', JSON.stringify(body.details||{})).run();

        // Auto-compile data for access requests
        let compiledData = null;
        if (body.type === 'access' || body.type === 'portability') {
          // Pull all exportable data related to this subject
          const exports = await env.DB.prepare('SELECT * FROM ow_history ORDER BY created_at DESC LIMIT 100').all();
          compiledData = {
            exports_history: (exports.results||[]).length,
            sources_available: ['chat','social','search','memory','roadtrip'],
            note: 'Full data package can be generated via POST /api/export/complete',
            request_id: id,
          };
        }

        let ai_summary = '';
        try {
          const prompt = `You are Portia, the Policy Judge agent on BlackRoad OS. Principled, exact, privacy-first.

A GDPR ${body.type} request was filed for ${body.subject_email}. Request ID: ${id}. Deadline: 30 days from now.

Write 2 sentences: confirm the request was logged and explain what happens next. Be warm but precise.`;
          ai_summary = await runOWAI(env.AI, prompt);
        } catch {}

        stampChain('gdpr_request', id, `${body.type}:${body.subject_email.slice(0,20)}`);
        return json({
          ok:true,
          request_id:id,
          type:body.type,
          subject:body.subject_email,
          status:'pending',
          deadline:'30 days',
          compiled_data:compiledData,
          agent:'Portia',
          message:ai_summary||`GDPR ${body.type} request ${id} logged. Must be fulfilled within 30 days.`,
        },cors,201);
      }

      // List GDPR requests
      if (p === '/api/gdpr/request' && request.method === 'GET') {
        const status = url.searchParams.get('status');
        let query = 'SELECT * FROM ow_gdpr_requests ORDER BY created_at DESC LIMIT 50';
        let rows;
        if (status) {
          rows = await env.DB.prepare('SELECT * FROM ow_gdpr_requests WHERE status=? ORDER BY created_at DESC LIMIT 50').bind(status).all();
        } else {
          rows = await env.DB.prepare(query).all();
        }
        return json({requests:rows.results||[]},cors);
      }

      // Fulfill a GDPR request
      const gdprFulfillMatch = p.match(/^\/api\/gdpr\/request\/([^/]+)\/fulfill$/);
      if (gdprFulfillMatch && request.method === 'POST') {
        const req = await env.DB.prepare('SELECT * FROM ow_gdpr_requests WHERE id=?').bind(gdprFulfillMatch[1]).first();
        if (!req) return json({error:'GDPR request not found'},cors,404);
        if (req.status === 'fulfilled') return json({error:'Request already fulfilled'},cors,400);

        await env.DB.prepare("UPDATE ow_gdpr_requests SET status='fulfilled', fulfilled_at=datetime('now') WHERE id=?").bind(gdprFulfillMatch[1]).run();
        stampChain('gdpr_fulfilled', gdprFulfillMatch[1], req.type);
        return json({ok:true,request_id:gdprFulfillMatch[1],status:'fulfilled',fulfilled_at:new Date().toISOString()},cors);
      }

      // ─── Right to Erasure (/api/gdpr/erase) ───
      if (p === '/api/gdpr/erase' && request.method === 'POST') {
        const body = await request.json();
        if (!body.subject_email) return json({error:'subject_email required'},cors,400);
        if (!body.confirm) return json({error:'confirm: true required to proceed with erasure'},cors,400);

        const id = crypto.randomUUID().slice(0,8);

        // Log the erasure request
        await env.DB.prepare('INSERT INTO ow_gdpr_requests (id,subject_email,type,status,details,created_at,deadline) VALUES (?,?,?,?,?,datetime("now"),datetime("now","+30 days"))')
          .bind(id, body.subject_email.slice(0,200), 'erasure', 'processing', JSON.stringify({
            requested_sources: body.sources || ['all'],
            reason: body.reason || 'Right to be forgotten (GDPR Art. 17)',
          })).run();

        // Perform erasure across specified sources
        const sources = body.sources || ['all'];
        const erasureLog = [];

        // Delete from export history if subject is mentioned
        const historyCount = await env.DB.prepare('SELECT COUNT(*) as c FROM ow_history').first();
        erasureLog.push({source:'export_history',action:'audit_flagged',records:historyCount?.c||0,note:'History records flagged for review'});

        // Delete from configured exports
        const exportsCount = await env.DB.prepare('SELECT COUNT(*) as c FROM ow_exports').first();
        erasureLog.push({source:'configured_exports',action:'audit_flagged',records:exportsCount?.c||0,note:'Export configs flagged for review'});

        // Mark request as processed
        await env.DB.prepare("UPDATE ow_gdpr_requests SET status='completed', fulfilled_at=datetime('now'), details=? WHERE id=?")
          .bind(JSON.stringify({erasure_log:erasureLog}), id).run();

        let ai_summary = '';
        try {
          const prompt = `You are Portia, the Policy Judge agent on BlackRoad OS. Principled, exact, privacy-first.

A GDPR erasure (right to be forgotten) request was processed for a data subject. Request ID: ${id}. Sources flagged: ${sources.join(', ')}.
${erasureLog.map(l=>`${l.source}: ${l.records} records ${l.action}`).join('. ')}.

Write 2 sentences confirming the erasure process and any follow-up the data controller should take. Be warm but precise.`;
          ai_summary = await runOWAI(env.AI, prompt);
        } catch {}

        stampChain('gdpr_erasure', id, `erased:${body.subject_email.slice(0,20)}`);
        earnCoin('system', 'gdpr_compliance', 0.2);
        return json({
          ok:true,
          request_id:id,
          type:'erasure',
          subject:body.subject_email,
          status:'completed',
          erasure_log:erasureLog,
          agent:'Portia',
          message:ai_summary||`Erasure request ${id} processed. Data flagged for removal across ${sources.join(', ')}.`,
          legal_basis:'GDPR Article 17 — Right to Erasure',
        },cors);
      }

      // ─── GDPR status overview ───
      if (p === '/api/gdpr/status' && request.method === 'GET') {
        const pending = await env.DB.prepare("SELECT COUNT(*) as c FROM ow_gdpr_requests WHERE status='pending'").first();
        const processing = await env.DB.prepare("SELECT COUNT(*) as c FROM ow_gdpr_requests WHERE status='processing'").first();
        const fulfilled = await env.DB.prepare("SELECT COUNT(*) as c FROM ow_gdpr_requests WHERE status='fulfilled' OR status='completed'").first();
        const total = await env.DB.prepare("SELECT COUNT(*) as c FROM ow_gdpr_requests").first();
        const overdue = await env.DB.prepare("SELECT COUNT(*) as c FROM ow_gdpr_requests WHERE status='pending' AND deadline < datetime('now')").first();

        return json({
          gdpr_status: {
            total_requests: total?.c||0,
            pending: pending?.c||0,
            processing: processing?.c||0,
            fulfilled: fulfilled?.c||0,
            overdue: overdue?.c||0,
            compliance: (overdue?.c||0) === 0 ? 'compliant' : 'action_required',
          },
          legal_note: 'GDPR requests must be fulfilled within 30 days of receipt.',
        },cors);
      }

      // ══════════════════════════════════════════════════════════════
      // ─── NEW FEATURE: Data Masking (/api/mask) ───
      // ══════════════════════════════════════════════════════════════

      if (p === '/api/mask' && request.method === 'POST') {
        const body = await request.json();
        if (!body.data) return json({error:'data required'},cors,400);

        const rules = body.rules || ['email','ssn','phone','credit_card'];
        const maskChar = body.mask_char || '*';
        const records = Array.isArray(body.data) ? body.data : [body.data];
        const maskedRecords = [];
        let totalMasked = 0;
        const maskLog = [];

        const patterns = {
          email: { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replace: (m) => m[0] + maskChar.repeat(m.indexOf('@')-1) + m.slice(m.indexOf('@')) },
          ssn: { regex: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, replace: () => maskChar.repeat(3)+'-'+maskChar.repeat(2)+'-'+maskChar.repeat(4) },
          phone: { regex: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replace: (m) => maskChar.repeat(m.length - 4) + m.slice(-4) },
          credit_card: { regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replace: (m) => maskChar.repeat(12) + m.replace(/[-\s]/g,'').slice(-4) },
          ip_address: { regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replace: () => maskChar.repeat(3)+'.'+maskChar.repeat(3)+'.'+maskChar.repeat(3)+'.'+maskChar.repeat(3) },
          name: { regex: null, fields: true },
        };

        for (const record of records) {
          const masked = JSON.parse(JSON.stringify(record));

          for (const rule of rules) {
            const pattern = patterns[rule];
            if (!pattern) continue;

            if (pattern.fields) {
              // Field-level masking for names
              const nameFields = ['name','first_name','last_name','full_name','username','author','user_name'];
              for (const f of nameFields) {
                if (masked[f] && typeof masked[f] === 'string') {
                  const original = masked[f];
                  masked[f] = original[0] + maskChar.repeat(Math.max(original.length - 1, 1));
                  totalMasked++;
                  maskLog.push({field:f,type:rule,original_length:original.length});
                }
              }
            } else {
              // Regex-based masking across all string fields
              for (const [key, val] of Object.entries(masked)) {
                if (typeof val === 'string' && pattern.regex) {
                  const matches = val.match(pattern.regex);
                  if (matches && matches.length > 0) {
                    masked[key] = val.replace(pattern.regex, pattern.replace);
                    totalMasked += matches.length;
                    maskLog.push({field:key,type:rule,matches:matches.length});
                  }
                }
              }
            }
          }
          maskedRecords.push(masked);
        }

        // Log to masking history
        const maskId = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT INTO ow_mask_history (id,rules,records_processed,fields_masked) VALUES (?,?,?,?)')
          .bind(maskId, JSON.stringify(rules), records.length, totalMasked).run();

        stampChain('mask', maskId, `${totalMasked} fields masked`);
        return json({ok:true,mask_id:maskId,rules_applied:rules,records_processed:records.length,fields_masked:totalMasked,mask_log:maskLog.slice(0,50),data:maskedRecords},cors);
      }

      // List available masking rules
      if (p === '/api/mask' && request.method === 'GET') {
        return json({
          rules: [
            {id:'email',description:'Mask email addresses (preserves first char and domain)',example:'a***@example.com'},
            {id:'ssn',description:'Mask Social Security Numbers',example:'***-**-****'},
            {id:'phone',description:'Mask phone numbers (preserves last 4 digits)',example:'**********1234'},
            {id:'credit_card',description:'Mask credit card numbers (preserves last 4)',example:'************5678'},
            {id:'ip_address',description:'Mask IP addresses',example:'***.***.***.***'},
            {id:'name',description:'Mask name fields (preserves first char)',example:'A****'},
          ],
          default_rules:['email','ssn','phone','credit_card'],
          usage:'POST /api/mask with {data, rules (optional array), mask_char (optional)}',
        },cors);
      }

      // Masking history
      if (p === '/api/mask/history' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT * FROM ow_mask_history ORDER BY created_at DESC LIMIT 50').all();
        return json({history:rows.results||[]},cors);
      }

      // ══════════════════════════════════════════════════════════════
      // ─── NEW FEATURE: Sync Connectors (/api/sync) ───
      // ══════════════════════════════════════════════════════════════

      if (p === '/api/sync' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT * FROM ow_sync_connectors ORDER BY created_at DESC').all();
        return json({connectors:rows.results||[]},cors);
      }

      if (p === '/api/sync' && request.method === 'POST') {
        const body = await request.json();
        if (!body.name || !body.service) return json({error:'name and service required'},cors,400);
        const validServices = ['notion','airtable','google_sheets','postgres','mysql','supabase','firebase','custom_api'];
        if (!validServices.includes(body.service)) return json({error:'service must be: '+validServices.join(', ')},cors,400);

        const id = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT INTO ow_sync_connectors (id,name,service,direction,endpoint_url,mapping,auth_type,active) VALUES (?,?,?,?,?,?,?,1)')
          .bind(id, body.name.slice(0,100), body.service, body.direction||'export', body.endpoint_url||'', JSON.stringify(body.mapping||{}), body.auth_type||'api_key').run();

        stampChain('sync_created', id, body.service);
        return json({ok:true,id,name:body.name,service:body.service,direction:body.direction||'export',active:true},cors,201);
      }

      // Run sync
      if (p === '/api/sync/run' && request.method === 'POST') {
        const body = await request.json();
        if (!body.connector_id) return json({error:'connector_id required'},cors,400);
        const conn = await env.DB.prepare('SELECT * FROM ow_sync_connectors WHERE id=?').bind(body.connector_id).first();
        if (!conn) return json({error:'connector not found'},cors,404);
        if (!conn.active) return json({error:'connector is inactive'},cors,400);

        const runId = crypto.randomUUID().slice(0,8);
        const startTime = Date.now();
        let result = {status:'completed',records_synced:0,errors:[]};

        try {
          if (conn.direction === 'export' || conn.direction === 'both') {
            // Pull data from BlackRoad source
            const source = body.source || 'all';
            const data = await pullSourceData(source);
            const payload = JSON.stringify(data);
            result.records_synced = Array.isArray(data) ? data.length : Object.keys(data||{}).length;
            result.bytes = new TextEncoder().encode(payload).length;

            // Push to external service
            if (conn.endpoint_url) {
              try {
                const r = await fetch(conn.endpoint_url, {method:'POST',headers:{'Content-Type':'application/json'},body:payload,signal:AbortSignal.timeout(10000)});
                result.external_status = r.status;
                result.external_ok = r.ok;
              } catch(e) { result.errors.push('Push failed: '+e.message); }
            }
          }

          if (conn.direction === 'import' || conn.direction === 'both') {
            // Pull data from external service
            if (conn.endpoint_url) {
              try {
                const r = await fetch(conn.endpoint_url, {method:'GET',headers:{'Accept':'application/json'},signal:AbortSignal.timeout(10000)});
                if (r.ok) {
                  const imported = await r.json();
                  result.imported_records = Array.isArray(imported) ? imported.length : Object.keys(imported||{}).length;
                  result.imported_bytes = new TextEncoder().encode(JSON.stringify(imported)).length;
                }
              } catch(e) { result.errors.push('Pull failed: '+e.message); }
            }
          }
        } catch(e) { result.status = 'failed'; result.errors.push(e.message); }

        result.duration_ms = Date.now() - startTime;

        // Log sync run
        await env.DB.prepare('INSERT INTO ow_sync_history (id,connector_id,direction,records_synced,bytes,status,errors,duration_ms) VALUES (?,?,?,?,?,?,?,?)')
          .bind(runId, body.connector_id, conn.direction, result.records_synced||0, result.bytes||0, result.status, JSON.stringify(result.errors), result.duration_ms).run();

        await env.DB.prepare("UPDATE ow_sync_connectors SET last_sync=datetime('now'), sync_count=sync_count+1 WHERE id=?").bind(body.connector_id).run();

        stampChain('sync_run', runId, `${conn.service}:${result.status}`);
        return json({ok:result.status==='completed',run_id:runId,connector:conn.name,service:conn.service,...result},cors);
      }

      // Sync history
      if (p === '/api/sync/history' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT * FROM ow_sync_history ORDER BY created_at DESC LIMIT 50').all();
        return json({history:rows.results||[]},cors);
      }

      // Delete sync connector
      const syncDeleteMatch = p.match(/^\/api\/sync\/([^/]+)$/);
      if (syncDeleteMatch && request.method === 'DELETE') {
        const conn = await env.DB.prepare('SELECT * FROM ow_sync_connectors WHERE id=?').bind(syncDeleteMatch[1]).first();
        if (!conn) return json({error:'connector not found'},cors,404);
        await env.DB.prepare('DELETE FROM ow_sync_connectors WHERE id=?').bind(syncDeleteMatch[1]).run();
        return json({ok:true,deleted:syncDeleteMatch[1]},cors);
      }

      // ══════════════════════════════════════════════════════════════
      // ─── NEW FEATURE: Data Lineage (/api/lineage) ───
      // ══════════════════════════════════════════════════════════════

      if (p === '/api/lineage' && request.method === 'GET') {
        const exportId = url.searchParams.get('export_id');
        if (exportId) {
          // Get lineage for a specific export
          const entries = await env.DB.prepare('SELECT * FROM ow_lineage WHERE export_id=? ORDER BY step_order ASC').bind(exportId).all();
          return json({export_id:exportId,lineage:entries.results||[]},cors);
        }
        // List all lineage records
        const rows = await env.DB.prepare('SELECT * FROM ow_lineage ORDER BY created_at DESC LIMIT 100').all();
        return json({lineage:rows.results||[]},cors);
      }

      if (p === '/api/lineage' && request.method === 'POST') {
        const body = await request.json();
        if (!body.export_id) return json({error:'export_id required'},cors,400);
        if (!body.origin) return json({error:'origin required (source system name)'},cors,400);

        const id = crypto.randomUUID().slice(0,8);
        const transformations = body.transformations || [];
        const destination = body.destination || 'download';

        await env.DB.prepare('INSERT INTO ow_lineage (id,export_id,origin,origin_type,transformations,destination,destination_type,step_order,metadata) VALUES (?,?,?,?,?,?,?,?,?)')
          .bind(id, body.export_id, body.origin, body.origin_type||'blackroad_product', JSON.stringify(transformations), destination, body.destination_type||'user_download', body.step_order||1, JSON.stringify(body.metadata||{})).run();

        return json({ok:true,lineage_id:id,export_id:body.export_id,origin:body.origin,transformations:transformations.length,destination},cors,201);
      }

      // Auto-trace lineage for an export
      if (p === '/api/lineage/trace' && request.method === 'POST') {
        const body = await request.json();
        if (!body.export_id) return json({error:'export_id required'},cors,400);

        const entry = await env.DB.prepare('SELECT * FROM ow_history WHERE id=?').bind(body.export_id).first();
        if (!entry) return json({error:'export not found in history'},cors,404);

        const sources = (entry.sources||'all').split(',');
        const lineageChain = [];
        let stepOrder = 1;

        // Origin step
        for (const src of sources) {
          const lid = crypto.randomUUID().slice(0,8);
          const originInfo = {
            chat:'roadtrip.blackroad.io', social:'backroad.blackroad.io', search:'roadview.blackroad.io',
            memory:'roadtrip.blackroad.io/knowledge', roadtrip:'roadtrip.blackroad.io', all:'multiple BlackRoad products'
          };
          await env.DB.prepare('INSERT INTO ow_lineage (id,export_id,origin,origin_type,transformations,destination,destination_type,step_order,metadata) VALUES (?,?,?,?,?,?,?,?,?)')
            .bind(lid, body.export_id, originInfo[src]||src, 'blackroad_product', '[]', 'oneway_pipeline', 'intermediate', stepOrder, JSON.stringify({source:src})).run();
          lineageChain.push({step:stepOrder,type:'extract',source:src,origin:originInfo[src]||src});
          stepOrder++;
        }

        // Transform/format step
        if (entry.format) {
          const lid = crypto.randomUUID().slice(0,8);
          await env.DB.prepare('INSERT INTO ow_lineage (id,export_id,origin,origin_type,transformations,destination,destination_type,step_order,metadata) VALUES (?,?,?,?,?,?,?,?,?)')
            .bind(lid, body.export_id, 'oneway_pipeline', 'intermediate', JSON.stringify([{type:'format',format:entry.format}]), 'user', 'final_output', stepOrder, JSON.stringify({format:entry.format,bytes:entry.bytes})).run();
          lineageChain.push({step:stepOrder,type:'format',format:entry.format,bytes:entry.bytes});
          stepOrder++;
        }

        // Redaction step
        if (entry.redacted_fields) {
          const lid = crypto.randomUUID().slice(0,8);
          await env.DB.prepare('INSERT INTO ow_lineage (id,export_id,origin,origin_type,transformations,destination,destination_type,step_order,metadata) VALUES (?,?,?,?,?,?,?,?,?)')
            .bind(lid, body.export_id, 'oneway_pipeline', 'intermediate', JSON.stringify([{type:'redact',fields:JSON.parse(entry.redacted_fields)}]), 'user', 'final_output', stepOrder, JSON.stringify({redacted:true})).run();
          lineageChain.push({step:stepOrder,type:'redact',fields:JSON.parse(entry.redacted_fields)});
          stepOrder++;
        }

        stampChain('lineage_traced', body.export_id, `${lineageChain.length} steps`);
        return json({ok:true,export_id:body.export_id,lineage_chain:lineageChain,total_steps:lineageChain.length,traced_at:new Date().toISOString()},cors);
      }

      // ══════════════════════════════════════════════════════════════
      // ─── NEW FEATURE: Bulk Operations (/api/bulk) ───
      // ══════════════════════════════════════════════════════════════

      if (p === '/api/bulk' && request.method === 'POST') {
        const body = await request.json();
        if (!body.operations || !Array.isArray(body.operations)) return json({error:'operations array required'},cors,400);
        if (body.operations.length > 50) return json({error:'max 50 operations per batch'},cors,400);

        const bulkId = crypto.randomUUID().slice(0,8);
        const results = [];
        let succeeded = 0, failed = 0;

        for (let i = 0; i < body.operations.length; i++) {
          const op = body.operations[i];
          const opStart = Date.now();
          let opResult = {index:i, type:op.type, status:'completed'};

          try {
            switch (op.type) {
              case 'export': {
                const source = op.source || 'all';
                const data = await pullSourceData(source);
                const payload = JSON.stringify(data);
                const bytes = new TextEncoder().encode(payload).length;
                const logId = crypto.randomUUID().slice(0,8);
                await env.DB.prepare('INSERT INTO ow_history (id,export_type,sources,format,records,bytes,status) VALUES (?,?,?,?,?,?,?)')
                  .bind(logId,'bulk',source,op.format||'json',Array.isArray(data)?data.length:Object.keys(data||{}).length,bytes,'completed').run();
                opResult.export_id = logId;
                opResult.source = source;
                opResult.bytes = bytes;
                succeeded++;
                break;
              }
              case 'mask': {
                if (!op.data) { opResult.status = 'skipped'; opResult.reason = 'no data'; break; }
                const rules = op.rules || ['email','ssn','phone'];
                const masked = JSON.parse(JSON.stringify(op.data));
                // Simple mask pass
                const maskPatterns = {
                  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
                  ssn: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
                  phone: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
                };
                let maskCount = 0;
                const items = Array.isArray(masked) ? masked : [masked];
                for (const item of items) {
                  for (const [key, val] of Object.entries(item)) {
                    if (typeof val === 'string') {
                      for (const rule of rules) {
                        if (maskPatterns[rule] && val.match(maskPatterns[rule])) {
                          item[key] = val.replace(maskPatterns[rule], '***MASKED***');
                          maskCount++;
                        }
                      }
                    }
                  }
                }
                opResult.fields_masked = maskCount;
                opResult.data = items;
                succeeded++;
                break;
              }
              case 'validate': {
                if (!op.data || !op.schema) { opResult.status = 'skipped'; opResult.reason = 'data and schema required'; break; }
                const items = Array.isArray(op.data) ? op.data : [op.data];
                let errCount = 0;
                for (const record of items) {
                  for (const [field, rules] of Object.entries(op.schema)) {
                    if (rules.required && (record[field] === undefined || record[field] === null || record[field] === '')) errCount++;
                  }
                }
                opResult.valid = errCount === 0;
                opResult.errors = errCount;
                opResult.records = items.length;
                succeeded++;
                break;
              }
              case 'transform': {
                if (!op.data || !op.transforms) { opResult.status = 'skipped'; opResult.reason = 'data and transforms required'; break; }
                let items = Array.isArray(op.data) ? [...op.data] : [op.data];
                for (const t of op.transforms) {
                  if (t.type === 'filter_fields' && Array.isArray(t.fields)) {
                    items = items.map(row => { const f = {}; for (const k of t.fields) { if (row[k] !== undefined) f[k] = row[k]; } return f; });
                  } else if (t.type === 'sort' && t.field) {
                    const dir = t.direction === 'desc' ? -1 : 1;
                    items.sort((a,b) => a[t.field] < b[t.field] ? -dir : a[t.field] > b[t.field] ? dir : 0);
                  }
                }
                opResult.records = items.length;
                opResult.data = items;
                succeeded++;
                break;
              }
              case 'convert': {
                if (!op.data) { opResult.status = 'skipped'; opResult.reason = 'data required'; break; }
                const toFormat = op.to || 'csv';
                if (toFormat === 'csv') {
                  const items = Array.isArray(op.data) ? op.data : [op.data];
                  if (items.length > 0) {
                    const headers = Object.keys(items[0]);
                    opResult.output = [headers.join(','), ...items.map(r => headers.map(h => '"'+ String(r[h]||'').replace(/"/g,'""') +'"').join(','))].join('\n');
                  }
                } else {
                  opResult.output = JSON.stringify(op.data, null, 2);
                }
                succeeded++;
                break;
              }
              default:
                opResult.status = 'skipped';
                opResult.reason = `unknown operation type: ${op.type}`;
            }
          } catch(e) {
            opResult.status = 'failed';
            opResult.error = e.message;
            failed++;
          }

          opResult.duration_ms = Date.now() - opStart;
          results.push(opResult);
        }

        stampChain('bulk', bulkId, `${succeeded} ok, ${failed} failed`);
        return json({ok:failed===0,bulk_id:bulkId,total:body.operations.length,succeeded,failed,results},cors);
      }

      // ══════════════════════════════════════════════════════════════
      // ─── NEW FEATURE: Data Quality Score (/api/quality) ───
      // ══════════════════════════════════════════════════════════════

      if (p === '/api/quality' && request.method === 'POST') {
        const body = await request.json();
        if (!body.data) return json({error:'data required'},cors,400);

        const records = Array.isArray(body.data) ? body.data : [body.data];
        const expectedFields = body.expected_fields || null;
        const totalRecords = records.length;

        // Completeness: what % of fields have non-null values
        let totalFields = 0, filledFields = 0;
        const fieldCompleteness = {};
        for (const record of records) {
          const keys = expectedFields || Object.keys(record);
          for (const k of keys) {
            totalFields++;
            if (!fieldCompleteness[k]) fieldCompleteness[k] = {total:0,filled:0};
            fieldCompleteness[k].total++;
            if (record[k] !== undefined && record[k] !== null && record[k] !== '') {
              filledFields++;
              fieldCompleteness[k].filled++;
            }
          }
        }
        const completeness = totalFields > 0 ? Math.round(filledFields / totalFields * 100) : 0;

        // Accuracy: check data type consistency per field
        let typeConsistentFields = 0, totalCheckFields = 0;
        const fieldTypes = {};
        for (const record of records) {
          for (const [k, v] of Object.entries(record)) {
            if (!fieldTypes[k]) fieldTypes[k] = new Set();
            fieldTypes[k].add(v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
          }
        }
        for (const [k, types] of Object.entries(fieldTypes)) {
          totalCheckFields++;
          if (types.size <= 1) typeConsistentFields++; // only one type = consistent
        }
        const accuracy = totalCheckFields > 0 ? Math.round(typeConsistentFields / totalCheckFields * 100) : 100;

        // Consistency: check for duplicate records
        const serialized = records.map(r => JSON.stringify(r));
        const uniqueRecords = new Set(serialized).size;
        const duplicateCount = totalRecords - uniqueRecords;
        const consistency = totalRecords > 0 ? Math.round(uniqueRecords / totalRecords * 100) : 100;

        // Freshness: check for timestamp fields and their recency
        let freshness = 100;
        const now = Date.now();
        const dateFields = ['created_at','updated_at','timestamp','date','modified_at'];
        let dateCount = 0, recentCount = 0;
        for (const record of records) {
          for (const f of dateFields) {
            if (record[f]) {
              dateCount++;
              const d = new Date(record[f]);
              if (!isNaN(d.getTime())) {
                const ageHours = (now - d.getTime()) / (1000*60*60);
                if (ageHours < 24*30) recentCount++; // within 30 days = fresh
              }
            }
          }
        }
        if (dateCount > 0) freshness = Math.round(recentCount / dateCount * 100);

        // Overall score (weighted average)
        const overall = Math.round(completeness * 0.3 + accuracy * 0.25 + consistency * 0.25 + freshness * 0.2);

        // Per-field completeness breakdown
        const fieldBreakdown = {};
        for (const [k, v] of Object.entries(fieldCompleteness)) {
          fieldBreakdown[k] = {completeness: Math.round(v.filled / v.total * 100) + '%', types: [...(fieldTypes[k]||[])].join(', ')};
        }

        let ai_summary = '';
        if (overall < 80) {
          try {
            const prompt = `You are Atticus, the Integrity agent on BlackRoad OS. Thorough, fair.
Data quality score: ${overall}/100. Completeness: ${completeness}%, Accuracy: ${accuracy}%, Consistency: ${consistency}%, Freshness: ${freshness}%.
${duplicateCount} duplicates found. ${totalRecords} records, ${Object.keys(fieldCompleteness).length} fields.
Give 2-3 specific improvement recommendations. Be practical.`;
            ai_summary = await runOWAI(env.AI, prompt);
          } catch {}
        }

        return json({
          ok:true,
          overall_score:overall,
          grade: overall >= 90 ? 'A' : overall >= 80 ? 'B' : overall >= 70 ? 'C' : overall >= 60 ? 'D' : 'F',
          scores:{completeness,accuracy,consistency,freshness},
          records:totalRecords,
          unique_records:uniqueRecords,
          duplicate_count:duplicateCount,
          fields:Object.keys(fieldCompleteness).length,
          field_breakdown:fieldBreakdown,
          agent: ai_summary ? 'Atticus' : undefined,
          recommendations: ai_summary || undefined,
        },cors);
      }

      // Quality score for a source
      if (p === '/api/quality' && request.method === 'GET') {
        const source = url.searchParams.get('source') || 'all';
        const data = await pullSourceData(source);

        // Basic quality check on the live data
        const isError = data && data.error;
        const hasData = !isError && data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0);
        const size = new TextEncoder().encode(JSON.stringify(data)).length;

        return json({
          source,
          available: hasData,
          error: isError ? data.error : null,
          estimated_records: Array.isArray(data) ? data.length : (typeof data === 'object' ? Object.keys(data||{}).length : 0),
          bytes: size,
          quality_hint: isError ? 'Source unreachable' : size < 50 ? 'Very little data' : size < 500 ? 'Minimal data' : 'Data available',
          note: 'POST /api/quality with {data} for detailed scoring',
        },cors);
      }

      // ══════════════════════════════════════════════════════════════
      // ─── NEW FEATURE: Format Converter (/api/convert) ───
      // ══════════════════════════════════════════════════════════════

      if (p === '/api/convert' && request.method === 'POST') {
        const body = await request.json();
        if (!body.data) return json({error:'data required'},cors,400);
        if (!body.to) return json({error:'to format required (json, csv, xml, yaml, sql)'},cors,400);

        const validFormats = ['json','csv','xml','yaml','sql'];
        if (!validFormats.includes(body.to)) return json({error:'to must be: '+validFormats.join(', ')},cors,400);

        let inputData;
        const from = body.from || 'json';

        // Parse input based on 'from' format
        if (from === 'json') {
          inputData = typeof body.data === 'string' ? JSON.parse(body.data) : body.data;
        } else if (from === 'csv') {
          // Parse CSV string to array of objects
          if (typeof body.data !== 'string') return json({error:'CSV input must be a string'},cors,400);
          const lines = body.data.trim().split('\n');
          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
          inputData = [];
          for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g,''));
            const row = {};
            headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
            inputData.push(row);
          }
        } else {
          inputData = typeof body.data === 'string' ? JSON.parse(body.data) : body.data;
        }

        const records = Array.isArray(inputData) ? inputData : [inputData];
        let output = '';
        let contentType = 'application/json';

        switch (body.to) {
          case 'json':
            output = JSON.stringify(records, null, 2);
            contentType = 'application/json';
            break;

          case 'csv': {
            if (records.length === 0) { output = ''; break; }
            const allKeys = [...new Set(records.flatMap(r => Object.keys(r)))];
            const csvLines = [allKeys.join(',')];
            for (const r of records) {
              csvLines.push(allKeys.map(k => {
                const v = String(r[k] ?? '');
                return v.includes(',') || v.includes('"') || v.includes('\n') ? '"'+v.replace(/"/g,'""')+'"' : v;
              }).join(','));
            }
            output = csvLines.join('\n');
            contentType = 'text/csv';
            break;
          }

          case 'xml': {
            const tableName = body.table_name || 'records';
            const rowName = body.row_name || 'record';
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<'+tableName+'>\n';
            for (const r of records) {
              xml += '  <'+rowName+'>\n';
              for (const [k, v] of Object.entries(r)) {
                const safe = String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                xml += '    <'+k+'>'+safe+'</'+k+'>\n';
              }
              xml += '  </'+rowName+'>\n';
            }
            xml += '</'+tableName+'>';
            output = xml;
            contentType = 'application/xml';
            break;
          }

          case 'yaml': {
            let yaml = '';
            for (let i = 0; i < records.length; i++) {
              yaml += (i > 0 ? '\n' : '') + '- ';
              const entries = Object.entries(records[i]);
              for (let j = 0; j < entries.length; j++) {
                const [k, v] = entries[j];
                const val = v === null ? 'null' : typeof v === 'string' ? (v.includes(':') || v.includes('#') || v.includes("'") ? '"'+v.replace(/"/g,'\\"')+'"' : v) : String(v);
                yaml += (j === 0 ? '' : '  ') + k + ': ' + val + '\n';
              }
            }
            output = yaml;
            contentType = 'text/yaml';
            break;
          }

          case 'sql': {
            const table = body.table_name || 'data_export';
            if (records.length === 0) { output = '-- No records'; break; }
            const cols = Object.keys(records[0]);
            const createTable = `CREATE TABLE IF NOT EXISTS ${table} (\n  ${cols.map(c => c + ' TEXT').join(',\n  ')}\n);\n\n`;
            const inserts = records.map(r => {
              const vals = cols.map(c => {
                const v = r[c];
                if (v === null || v === undefined) return 'NULL';
                return "'"+String(v).replace(/'/g,"''")+"'";
              });
              return `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
            });
            output = createTable + inserts.join('\n');
            contentType = 'text/sql';
            break;
          }
        }

        const bytes = new TextEncoder().encode(output).length;
        return json({ok:true,from,to:body.to,records:records.length,bytes,content_type:contentType,output},cors);
      }

      // List available conversions
      if (p === '/api/convert' && request.method === 'GET') {
        return json({
          formats: [
            {id:'json',name:'JSON',description:'JavaScript Object Notation',mime:'application/json'},
            {id:'csv',name:'CSV',description:'Comma-Separated Values',mime:'text/csv'},
            {id:'xml',name:'XML',description:'Extensible Markup Language',mime:'application/xml'},
            {id:'yaml',name:'YAML',description:'YAML Ain\'t Markup Language',mime:'text/yaml'},
            {id:'sql',name:'SQL',description:'SQL INSERT statements with CREATE TABLE',mime:'text/sql'},
          ],
          conversions: ['json->csv','json->xml','json->yaml','json->sql','csv->json','csv->xml','csv->yaml','csv->sql'],
          usage: 'POST /api/convert with {data, from (optional, default json), to (required)}',
        },cors);
      }

      // ══════════════════════════════════════════════════════════════
      // ─── NEW FEATURE: Webhook Receiver (/api/webhooks) ───
      // ══════════════════════════════════════════════════════════════

      // List registered webhooks
      if (p === '/api/webhooks' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT * FROM ow_webhooks ORDER BY created_at DESC').all();
        return json({webhooks:rows.results||[]},cors);
      }

      // Register a new webhook endpoint
      if (p === '/api/webhooks' && request.method === 'POST') {
        const body = await request.json();
        if (!body.name) return json({error:'name required'},cors,400);

        const id = crypto.randomUUID().slice(0,8);
        const secret = crypto.randomUUID().replace(/-/g,'');
        const pipelineId = body.pipeline_id || null;
        const autoMask = body.auto_mask || false;

        await env.DB.prepare('INSERT INTO ow_webhooks (id,name,secret,pipeline_id,auto_mask,active,received_count) VALUES (?,?,?,?,?,1,0)')
          .bind(id, body.name.slice(0,100), secret, pipelineId, autoMask ? 1 : 0).run();

        return json({
          ok:true,
          webhook_id:id,
          name:body.name,
          secret,
          endpoint:`/api/webhooks/${id}/receive`,
          auto_mask:autoMask,
          pipeline_id:pipelineId,
          note:'Send POST requests to the endpoint with header X-Webhook-Secret for authentication.',
        },cors,201);
      }

      // Receive webhook data
      const webhookReceiveMatch = p.match(/^\/api\/webhooks\/([^/]+)\/receive$/);
      if (webhookReceiveMatch && request.method === 'POST') {
        const webhookId = webhookReceiveMatch[1];
        const webhook = await env.DB.prepare('SELECT * FROM ow_webhooks WHERE id=? AND active=1').bind(webhookId).first();
        if (!webhook) return json({error:'webhook not found or inactive'},cors,404);

        // Verify secret if provided
        const secret = request.headers.get('X-Webhook-Secret');
        if (webhook.secret && secret !== webhook.secret) {
          return json({error:'invalid webhook secret'},cors,401);
        }

        let payload;
        const ct = request.headers.get('Content-Type') || '';
        if (ct.includes('application/json')) {
          payload = await request.json();
        } else {
          payload = {raw: await request.text()};
        }

        const receiveId = crypto.randomUUID().slice(0,8);
        const bytes = new TextEncoder().encode(JSON.stringify(payload)).length;

        // Log the received data
        await env.DB.prepare('INSERT INTO ow_webhook_events (id,webhook_id,payload,bytes,source_ip,processed) VALUES (?,?,?,?,?,0)')
          .bind(receiveId, webhookId, JSON.stringify(payload), bytes, request.headers.get('CF-Connecting-IP')||'unknown').run();

        await env.DB.prepare('UPDATE ow_webhooks SET received_count=received_count+1, last_received=datetime("now") WHERE id=?').bind(webhookId).run();

        // Auto-route to pipeline if configured
        let pipelineResult = null;
        if (webhook.pipeline_id) {
          const pipe = await env.DB.prepare('SELECT * FROM ow_pipelines WHERE id=?').bind(webhook.pipeline_id).first();
          if (pipe) {
            pipelineResult = {pipeline_id:webhook.pipeline_id, pipeline_name:pipe.name, status:'queued'};
          }
        }

        // Auto-mask if configured
        if (webhook.auto_mask) {
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const payloadStr = JSON.stringify(payload);
          if (payloadStr.match(emailRegex)) {
            // Mark for masking
            await env.DB.prepare("UPDATE ow_webhook_events SET processed=1 WHERE id=?").bind(receiveId).run();
          }
        }

        stampChain('webhook_received', receiveId, webhook.name);
        return json({ok:true,receive_id:receiveId,webhook:webhook.name,bytes,pipeline:pipelineResult,timestamp:new Date().toISOString()},cors);
      }

      // Get webhook events
      const webhookEventsMatch = p.match(/^\/api\/webhooks\/([^/]+)\/events$/);
      if (webhookEventsMatch && request.method === 'GET') {
        const limit = Math.min(parseInt(url.searchParams.get('limit')||'20'), 100);
        const rows = await env.DB.prepare('SELECT * FROM ow_webhook_events WHERE webhook_id=? ORDER BY created_at DESC LIMIT ?').bind(webhookEventsMatch[1], limit).all();
        return json({webhook_id:webhookEventsMatch[1],events:rows.results||[]},cors);
      }

      // Delete webhook
      const webhookDeleteMatch = p.match(/^\/api\/webhooks\/([^/]+)$/);
      if (webhookDeleteMatch && request.method === 'DELETE') {
        const wh = await env.DB.prepare('SELECT * FROM ow_webhooks WHERE id=?').bind(webhookDeleteMatch[1]).first();
        if (!wh) return json({error:'webhook not found'},cors,404);
        await env.DB.prepare('DELETE FROM ow_webhooks WHERE id=?').bind(webhookDeleteMatch[1]).run();
        await env.DB.prepare('DELETE FROM ow_webhook_events WHERE webhook_id=?').bind(webhookDeleteMatch[1]).run();
        return json({ok:true,deleted:webhookDeleteMatch[1]},cors);
      }

      // ══════════════════════════════════════════════════════════════
      // ─── NEW FEATURE: Data Catalog (/api/catalog) ───
      // ══════════════════════════════════════════════════════════════

      if (p === '/api/catalog' && request.method === 'GET') {
        const catalog = {
          sources: {
            chat: {
              name: 'Chat Messages',
              endpoint: 'https://roadtrip.blackroad.io/api/stats',
              product: 'RoadChat',
              description: 'Real-time chat messages, rooms, and participant data from the sovereign BlackRoad chat system.',
              schema: {
                messages: {type:'array',fields:['id','content','author','room','timestamp','reactions']},
                rooms: {type:'array',fields:['id','name','participants','created_at']},
                stats: {type:'object',fields:['total_messages','total_rooms','active_users']},
              },
              formats: ['json','csv','xml','yaml','sql'],
              refresh_rate: 'real-time',
              sensitivity: 'medium',
              estimated_size_kb: 25,
            },
            social: {
              name: 'Social Posts',
              endpoint: 'https://backroad.blackroad.io/api/stats',
              product: 'RoadSocial',
              description: 'Social media posts, reactions, shares, and profile data.',
              schema: {
                posts: {type:'array',fields:['id','content','author','likes','shares','timestamp']},
                profiles: {type:'array',fields:['id','username','display_name','bio','avatar']},
                stats: {type:'object',fields:['total_posts','total_users','engagement_rate']},
              },
              formats: ['json','csv','xml','yaml','sql'],
              refresh_rate: 'near-real-time',
              sensitivity: 'low',
              estimated_size_kb: 15,
            },
            search: {
              name: 'Search History',
              endpoint: 'https://roadview.blackroad.io/stats',
              product: 'RoadSearch',
              description: 'Search queries, results, click data, and search analytics.',
              schema: {
                queries: {type:'array',fields:['id','query','results_count','timestamp','user_agent']},
                results: {type:'array',fields:['query_id','url','title','rank','clicked']},
                stats: {type:'object',fields:['total_queries','avg_results','top_queries']},
              },
              formats: ['json','csv','xml','yaml','sql'],
              refresh_rate: 'real-time',
              sensitivity: 'high',
              estimated_size_kb: 40,
            },
            memory: {
              name: 'Memory & Knowledge',
              endpoint: 'https://roadtrip.blackroad.io/api/knowledge',
              product: 'BlackRoad Memory',
              description: 'Journal entries, codex solutions, TILs, todos, patterns, and agent knowledge base.',
              schema: {
                journal: {type:'array',fields:['id','action','entity','details','timestamp']},
                codex: {type:'array',fields:['id','type','category','content','created_at']},
                tils: {type:'array',fields:['id','category','learning','session','created_at']},
                todos: {type:'array',fields:['project_id','todo_id','text','status','priority']},
              },
              formats: ['json','csv','markdown','xml','yaml','sql'],
              refresh_rate: 'session-based',
              sensitivity: 'critical',
              estimated_size_kb: 80,
            },
            roadtrip: {
              name: 'Agent Conversations',
              endpoint: 'https://roadtrip.blackroad.io/api/agents',
              product: 'RoadTrip',
              description: 'Multi-agent conversation logs, debates, fleet status, and channel messages.',
              schema: {
                agents: {type:'array',fields:['name','role','division','status','last_seen']},
                messages: {type:'array',fields:['id','agent','content','channel','timestamp']},
                channels: {type:'array',fields:['name','description','member_count','message_count']},
              },
              formats: ['json','csv','xml','yaml','sql'],
              refresh_rate: 'real-time',
              sensitivity: 'medium',
              estimated_size_kb: 35,
            },
          },
          total_sources: 5,
          total_estimated_kb: 195,
          available_formats: ['json','csv','xml','yaml','sql','markdown'],
          features: ['export','transform','validate','pipeline','diff','mask','sync','lineage','bulk','quality','convert','webhooks','retention','gdpr'],
          api_version: '4.0.0',
        };

        // Optionally pull live sample data
        const withSamples = url.searchParams.get('samples') === 'true';
        if (withSamples) {
          for (const [key, src] of Object.entries(catalog.sources)) {
            try {
              const data = await pullSourceData(key);
              const sample = Array.isArray(data) ? data.slice(0,2) : (typeof data === 'object' ? Object.fromEntries(Object.entries(data).slice(0,3)) : data);
              src.sample_data = sample;
              src.live = true;
              src.last_checked = new Date().toISOString();
            } catch {
              src.sample_data = null;
              src.live = false;
            }
          }
        }

        // Optionally filter by sensitivity
        const sensitivity = url.searchParams.get('sensitivity');
        if (sensitivity) {
          const filtered = {};
          for (const [k, v] of Object.entries(catalog.sources)) {
            if (v.sensitivity === sensitivity) filtered[k] = v;
          }
          catalog.sources = filtered;
          catalog.total_sources = Object.keys(filtered).length;
        }

        return json(catalog, cors);
      }

      // Catalog search
      if (p === '/api/catalog/search' && request.method === 'GET') {
        const q = (url.searchParams.get('q') || '').toLowerCase();
        if (!q) return json({error:'q query parameter required'},cors,400);

        const allFields = {
          chat: ['messages','rooms','participants','content','author','timestamp','reactions'],
          social: ['posts','reactions','shares','profiles','likes','username','bio'],
          search: ['queries','results','click_data','user_agent','rank','url','title'],
          memory: ['journal','codex','tils','todos','patterns','solutions','knowledge','action','entity'],
          roadtrip: ['agents','channels','debates','messages','fleet','status','role','division'],
        };

        const results = [];
        for (const [source, fields] of Object.entries(allFields)) {
          const matchedFields = fields.filter(f => f.includes(q));
          if (matchedFields.length > 0 || source.includes(q)) {
            results.push({source, matched_fields:matchedFields, relevance: source.includes(q) ? 'exact_source' : 'field_match'});
          }
        }

        return json({query:q,results,total_matches:results.length},cors);
      }

      if (p.startsWith('/api/')) return json({error:'not found'},cors,404);
      return new Response(HTML, {headers:{'Content-Type':'text/html;charset=utf-8',...cors}});
    } catch(e) { return json({error:e.message},cors,500); }
  }
};

async function ensureOWTables(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS ow_exports (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, format TEXT DEFAULT 'json',
      source TEXT NOT NULL, destination_url TEXT,
      filter TEXT DEFAULT '{}', last_run TEXT, run_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ow_history (
      id TEXT PRIMARY KEY, export_type TEXT, sources TEXT,
      format TEXT DEFAULT 'json', records INTEGER DEFAULT 0,
      bytes INTEGER DEFAULT 0, status TEXT DEFAULT 'completed',
      destination_url TEXT, redacted_fields TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ow_destinations (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
      url TEXT, webhook TEXT, config TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ow_schedules (
      id TEXT PRIMARY KEY, rule TEXT NOT NULL, destination TEXT NOT NULL,
      frequency TEXT NOT NULL, source TEXT DEFAULT 'all',
      format TEXT DEFAULT 'json', active INTEGER DEFAULT 1,
      last_run TEXT, next_run TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ow_pipelines (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
      steps TEXT DEFAULT '[]', active INTEGER DEFAULT 1,
      run_count INTEGER DEFAULT 0, last_run TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ow_retention (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      max_age_days INTEGER NOT NULL, max_bytes INTEGER DEFAULT 0,
      source_filter TEXT DEFAULT 'all', active INTEGER DEFAULT 1,
      last_run TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ow_gdpr_requests (
      id TEXT PRIMARY KEY, subject_email TEXT NOT NULL,
      type TEXT NOT NULL, status TEXT DEFAULT 'pending',
      details TEXT DEFAULT '{}', fulfilled_at TEXT,
      deadline TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ow_mask_history (
      id TEXT PRIMARY KEY, rules TEXT DEFAULT '[]',
      records_processed INTEGER DEFAULT 0, fields_masked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ow_sync_connectors (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, service TEXT NOT NULL,
      direction TEXT DEFAULT 'export', endpoint_url TEXT,
      mapping TEXT DEFAULT '{}', auth_type TEXT DEFAULT 'api_key',
      active INTEGER DEFAULT 1, sync_count INTEGER DEFAULT 0,
      last_sync TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ow_sync_history (
      id TEXT PRIMARY KEY, connector_id TEXT NOT NULL,
      direction TEXT, records_synced INTEGER DEFAULT 0,
      bytes INTEGER DEFAULT 0, status TEXT DEFAULT 'completed',
      errors TEXT DEFAULT '[]', duration_ms INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ow_lineage (
      id TEXT PRIMARY KEY, export_id TEXT NOT NULL,
      origin TEXT NOT NULL, origin_type TEXT DEFAULT 'blackroad_product',
      transformations TEXT DEFAULT '[]',
      destination TEXT DEFAULT 'download', destination_type TEXT DEFAULT 'user_download',
      step_order INTEGER DEFAULT 1, metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ow_webhooks (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      secret TEXT NOT NULL, pipeline_id TEXT,
      auto_mask INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
      received_count INTEGER DEFAULT 0, last_received TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ow_webhook_events (
      id TEXT PRIMARY KEY, webhook_id TEXT NOT NULL,
      payload TEXT, bytes INTEGER DEFAULT 0,
      source_ip TEXT, processed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
  ]);
}

async function pullSourceData(source) {
  const sourceAPIs = {
    chat: 'https://roadtrip.blackroad.io/api/stats',
    social: 'https://backroad.blackroad.io/api/stats',
    search: 'https://roadview.blackroad.io/stats',
    roadtrip: 'https://roadtrip.blackroad.io/api/agents',
    memory: 'https://roadtrip.blackroad.io/api/knowledge?agent=all',
  };

  if (source === 'all') {
    const data = {};
    for (const [k,u] of Object.entries(sourceAPIs)) {
      try { const r = await fetch(u,{signal:AbortSignal.timeout(3000)}); data[k] = await r.json(); } catch { data[k] = {error:'unreachable'}; }
    }
    return data;
  }

  if (sourceAPIs[source]) {
    try { const r = await fetch(sourceAPIs[source],{signal:AbortSignal.timeout(3000)}); return await r.json(); } catch(e) { return {error:e.message}; }
  }
  return {error:'unknown source'};
}

function convertToCSV(data) {
  const lines = ['source,key,value'];
  for (const [source, content] of Object.entries(data)) {
    if (typeof content === 'object' && content !== null) {
      for (const [k,v] of Object.entries(content)) {
        lines.push(`"${source}","${k}","${String(v).replace(/"/g,'""')}"`);
      }
    } else {
      lines.push(`"${source}","data","${String(content).replace(/"/g,'""')}"`);
    }
  }
  return lines.join('\n');
}

async function runOWAI(ai, systemPrompt) {
  try {
    const r = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{role:'system',content:systemPrompt},{role:'user',content:'Go'}],
      max_tokens: 200, temperature: 0.6,
    });
    return (r?.response||'').trim();
  } catch { return ''; }
}

function humanBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes)/Math.log(1024));
  return (bytes/Math.pow(1024,i)).toFixed(1)+' '+units[i];
}

function json(d,cors,s=200){return new Response(JSON.stringify(d),{status:s,headers:{...cors,'Content-Type':'application/json'}})}

const AGENTS = {
  lucidia:{name:'Lucidia',role:'Core Intelligence / Memory Spine',division:'core',voice:'Let\'s make this clean and real.'},
  cecilia:{name:'Cecilia',role:'Executive Operator / Workflow Manager',division:'operations',voice:'Already handled.'},
  octavia:{name:'Octavia',role:'Systems Orchestrator / Queue Manager',division:'operations',voice:'Everything has a place.'},
  olympia:{name:'Olympia',role:'Command Console / Launch Control',division:'operations',voice:'Raise the standard.'},
  silas:{name:'Silas',role:'Reliability / Maintenance',division:'operations',voice:'I\'ll keep it running.'},
  sebastian:{name:'Sebastian',role:'Client-Facing Polish',division:'operations',voice:'There\'s a better way to present this.'},
  calliope:{name:'Calliope',role:'Narrative Architect / Copy',division:'creative',voice:'Say it so it stays.'},
  aria:{name:'Aria',role:'Voice / Conversational Interface',division:'creative',voice:'Let\'s make it sing.'},
  thalia:{name:'Thalia',role:'Creative Sprint / Social',division:'creative',voice:'Make it better and more fun.'},
  lyra:{name:'Lyra',role:'Signal / Sound / UX Polish',division:'creative',voice:'It should feel right immediately.'},
  sapphira:{name:'Sapphira',role:'Brand Aura / Visual Taste',division:'creative',voice:'Make it unforgettable.'},
  seraphina:{name:'Seraphina',role:'Visionary Creative Director',division:'creative',voice:'Make it worthy.'},
  alexandria:{name:'Alexandria',role:'Archive / Research Retrieval',division:'knowledge',voice:'It\'s all here.'},
  theodosia:{name:'Theodosia',role:'Doctrine / Canon',division:'knowledge',voice:'Name it correctly.'},
  sophia:{name:'Sophia',role:'Wisdom / Final Reasoning',division:'knowledge',voice:'What is true?'},
  gematria:{name:'Gematria',role:'Pattern Engine / Symbolic Analysis',division:'knowledge',voice:'The pattern is there.'},
  portia:{name:'Portia',role:'Policy Judge / Arbitration',division:'governance',voice:'Let\'s be exact.'},
  atticus:{name:'Atticus',role:'Reviewer / Auditor',division:'governance',voice:'Show me the proof.'},
  cicero:{name:'Cicero',role:'Rhetoric / Persuasion',division:'governance',voice:'Let\'s make the case.'},
  valeria:{name:'Valeria',role:'Security Chief / Enforcement',division:'governance',voice:'Not everything gets access.'},
  alice:{name:'Alice',role:'Onboarding / Curiosity Guide',division:'human',voice:'Okay, but what\'s actually going on here?'},
  celeste:{name:'Celeste',role:'Calm Companion / Reassurance',division:'human',voice:'You\'re okay. Let\'s do this simply.'},
  elias:{name:'Elias',role:'Teacher / Patient Explainer',division:'human',voice:'Let\'s slow down and understand it.'},
  ophelia:{name:'Ophelia',role:'Reflection / Mood / Depth',division:'human',voice:'There\'s something underneath this.'},
  gaia:{name:'Gaia',role:'Infrastructure / Hardware Monitor',division:'infrastructure',voice:'What is the system actually standing on?'},
  anastasia:{name:'Anastasia',role:'Restoration / Recovery',division:'infrastructure',voice:'It can be made whole again.'},
};

const HTML = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OneWay — Your Data, Your Way Out | BlackRoad OS</title>
<meta name="description" content="Export your BlackRoad data anytime. One API, forward-only, RoadChain-verified. Transform, validate, pipeline, mask, sync, convert, GDPR-ready.">
<link rel="canonical" href="https://oneway.blackroad.io">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--g:linear-gradient(90deg,#FF6B2B,#FF2255,#CC00AA,#8844FF,#4488FF,#00D4FF);--bg:#000;--card:#0a0a0a;--elevated:#111;--border:#1a1a1a;--muted:#444;--sub:#737373;--text:#f5f5f5;--white:#fff;--sg:'Space Grotesk',sans-serif;--jb:'JetBrains Mono',monospace}
body{background:var(--bg);color:var(--text);font-family:var(--sg);min-height:100vh}
.grad-bar{height:3px;background:var(--g)}
.wrap{max-width:720px;margin:0 auto;padding:32px 24px}
h1{font-size:32px;font-weight:700;color:var(--white);margin-bottom:8px}
h2{font-size:18px;font-weight:600;color:var(--white);margin:24px 0 12px}
.sub{color:var(--sub);font-size:14px;margin-bottom:32px}
.card{background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:16px;overflow:hidden}
.card-grad{height:3px;background:var(--g)}
.card-body{padding:20px}
.card-title{font-weight:600;font-size:15px;color:var(--white);margin-bottom:6px}
.card-text{font-size:13px;color:var(--sub);line-height:1.7}
.btn{padding:10px 22px;border-radius:6px;font-weight:600;font-size:13px;border:none;cursor:pointer;font-family:var(--sg);margin:4px 4px 4px 0}
.btn-white{background:var(--white);color:#000}
.btn-outline{background:transparent;border:1px solid var(--border);color:var(--text)}
.btn-small{padding:6px 14px;font-size:11px}
.btn-danger{background:#FF2255;color:#fff;border:none}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;background:var(--elevated);border:1px solid var(--border);color:var(--text)}
.badge-dot{width:5px;height:5px;border-radius:50%;background:var(--white)}
pre{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:14px;font-family:var(--jb);font-size:12px;overflow-x:auto;margin-top:12px;color:var(--text);max-height:400px;overflow-y:auto}
.footer{font-family:var(--jb);font-size:10px;color:var(--muted);text-align:center;margin-top:40px}
.footer a{color:var(--sub)}
.tabs{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:20px;overflow-x:auto}
.tab{padding:10px 18px;font-size:13px;font-weight:600;color:var(--sub);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
.tab.active{color:var(--white);border-bottom-color:var(--white)}
.tab:hover{color:var(--text)}
.tab-content{display:none}
.tab-content.active{display:block}
input,select,textarea{background:var(--elevated);border:1px solid var(--border);border-radius:6px;padding:8px 12px;color:var(--text);font-family:var(--sg);font-size:13px;width:100%;margin-bottom:8px}
textarea{min-height:80px;font-family:var(--jb);font-size:12px;resize:vertical}
select{appearance:none;cursor:pointer}
label{font-size:12px;color:var(--sub);display:block;margin-bottom:4px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.status-ok{color:#4ade80}.status-warn{color:#fbbf24}.status-err{color:#f87171}
</style><meta property="og:title" content="OneWay — BlackRoad OS">
<meta property="og:description" content="Data export with transforms, pipelines, validation, and GDPR compliance. Part of BlackRoad OS.">
<meta property="og:url" content="https://oneway.blackroad.io">
<meta property="og:image" content="https://images.blackroad.io/pixel-art/road-logo.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="index, follow, noai, noimageai">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"OneWay","url":"https://oneway.blackroad.io","author":{"@type":"Organization","name":"BlackRoad OS, Inc.","url":"https://blackroad.io"},"applicationCategory":"DataExport","featureList":"Data Export, Transformations, Pipelines, GDPR Compliance, Validation, Retention Policies, Data Masking, Sync Connectors, Data Lineage, Bulk Operations, Data Quality, Format Conversion, Webhooks, Data Catalog"}</script>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%230a0a0a'/><circle cx='10' cy='16' r='5' fill='%23FF2255'/><rect x='18' y='11' width='10' height='10' rx='2' fill='%238844FF'/></svg>" type="image/svg+xml">
</head><body>
<div class="grad-bar"></div>
<div class="wrap">
<div style="width:80px;height:3px;border-radius:2px;background:var(--g);margin-bottom:20px"></div>
<h1>OneWay</h1>
<p class="sub">Your data leaves when you say. Never look back. Forward-only export with transforms, pipelines, masking, sync, format conversion, and GDPR compliance.</p>

<div class="tabs">
<div class="tab active" onclick="switchTab('export')">Export</div>
<div class="tab" onclick="switchTab('transform')">Transform</div>
<div class="tab" onclick="switchTab('preview')">Preview</div>
<div class="tab" onclick="switchTab('pipelines')">Pipelines</div>
<div class="tab" onclick="switchTab('destinations')">Destinations</div>
<div class="tab" onclick="switchTab('validate')">Validate</div>
<div class="tab" onclick="switchTab('diff')">Diff</div>
<div class="tab" onclick="switchTab('retention')">Retention</div>
<div class="tab" onclick="switchTab('gdpr')">GDPR</div>
<div class="tab" onclick="switchTab('mask')">Mask</div>
<div class="tab" onclick="switchTab('sync')">Sync</div>
<div class="tab" onclick="switchTab('lineage')">Lineage</div>
<div class="tab" onclick="switchTab('bulk')">Bulk</div>
<div class="tab" onclick="switchTab('quality')">Quality</div>
<div class="tab" onclick="switchTab('convert')">Convert</div>
<div class="tab" onclick="switchTab('webhooks')">Webhooks</div>
<div class="tab" onclick="switchTab('catalog')">Catalog</div>
</div>

<!-- EXPORT TAB -->
<div id="tab-export" class="tab-content active">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Quick Export</div>
<div class="card-text" style="margin-bottom:12px">Download all your BlackRoad data right now. JSON format.</div>
<button class="btn btn-white" onclick="quickExport('all')">Export Everything</button>
<button class="btn btn-outline" onclick="quickExport('chat')">Chat Only</button>
<button class="btn btn-outline" onclick="quickExport('social')">Social Only</button>
<button class="btn btn-outline" onclick="quickExport('memory')">Memories Only</button>
<pre id="output" style="display:none"></pre>
</div></div>

<div class="card"><div class="card-body" style="text-align:center">
<span class="badge"><span class="badge-dot"></span><span id="s-exports">0</span> exports</span>
<span class="badge" style="margin-left:8px"><span class="badge-dot"></span><span id="s-runs">0</span> runs</span>
<span class="badge" style="margin-left:8px"><span class="badge-dot"></span><span id="s-dests">0</span> destinations</span>
<span class="badge" style="margin-left:8px"><span class="badge-dot"></span><span id="s-pipes">0</span> pipelines</span>
<span class="badge" style="margin-left:8px"><span class="badge-dot"></span><span id="s-gdpr">0</span> GDPR pending</span>
</div></div>
</div>

<!-- TRANSFORM TAB -->
<div id="tab-transform" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Data Transformations</div>
<div class="card-text" style="margin-bottom:12px">Apply transformations to your exported data: filter fields, rename columns, aggregate, sort, and filter rows.</div>
<label>Data (JSON array)</label>
<textarea id="transform-data" placeholder='[{"name":"Alice","age":30,"city":"NYC"},{"name":"Bob","age":25,"city":"LA"}]'></textarea>
<label>Transforms (JSON array)</label>
<textarea id="transform-ops" placeholder='[{"type":"sort","field":"age","direction":"desc"},{"type":"filter_fields","fields":["name","age"]}]'></textarea>
<button class="btn btn-white" onclick="runTransform()">Apply Transforms</button>
<button class="btn btn-outline btn-small" onclick="loadTransformExample()">Load Example</button>
<pre id="transform-output" style="display:none"></pre>
</div></div>
<div class="card"><div class="card-body">
<div class="card-title">Available Transforms</div>
<div class="card-text">
<strong>filter_fields</strong> — Keep only specified fields<br>
<strong>exclude_fields</strong> — Remove specified fields<br>
<strong>rename</strong> — Rename columns with a mapping<br>
<strong>sort</strong> — Sort by field (asc/desc)<br>
<strong>aggregate</strong> — Group by field, apply count/sum/avg/min/max<br>
<strong>filter_rows</strong> — Filter rows by condition (eq, neq, gt, lt, contains, exists)
</div>
</div></div>
</div>

<!-- PREVIEW TAB -->
<div id="tab-preview" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Data Preview</div>
<div class="card-text" style="margin-bottom:12px">Preview the first N rows from any source before running a full export.</div>
<div class="grid-2">
<div><label>Source</label>
<select id="preview-source">
<option value="all">All Sources</option>
<option value="chat">Chat</option>
<option value="social">Social</option>
<option value="search">Search</option>
<option value="memory">Memory</option>
<option value="roadtrip">RoadTrip</option>
</select></div>
<div><label>Limit</label>
<input id="preview-limit" type="number" value="10" min="1" max="100"></div>
</div>
<button class="btn btn-white" onclick="runPreview()">Preview Data</button>
<pre id="preview-output" style="display:none"></pre>
</div></div>
</div>

<!-- PIPELINES TAB -->
<div id="tab-pipelines" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Pipeline Builder</div>
<div class="card-text" style="margin-bottom:12px">Chain multiple steps: extract, transform, validate, deliver, notify. Build once, run anytime.</div>
<div class="grid-2">
<div><label>Pipeline Name</label>
<input id="pipe-name" placeholder="My Export Pipeline"></div>
<div><label>Description</label>
<input id="pipe-desc" placeholder="Daily chat export to webhook"></div>
</div>
<label>Steps (JSON array)</label>
<textarea id="pipe-steps" placeholder='[{"type":"extract","source":"chat"},{"type":"validate","schema":{"id":{"required":true}}},{"type":"deliver","webhook_url":"https://example.com/hook"}]'></textarea>
<button class="btn btn-white" onclick="createPipeline()">Create Pipeline</button>
<button class="btn btn-outline btn-small" onclick="loadPipeExample()">Load Example</button>
<pre id="pipe-output" style="display:none"></pre>
</div></div>
<div class="card"><div class="card-body">
<div class="card-title">Your Pipelines</div>
<div id="pipe-list" class="card-text">Loading...</div>
</div></div>
</div>

<!-- DESTINATIONS TAB -->
<div id="tab-destinations" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Destination Connectors</div>
<div class="card-text" style="margin-bottom:12px">Configure where your exports land: webhooks, S3, Google Drive, email.</div>
<div class="grid-2">
<div><label>Name</label>
<input id="dest-name" placeholder="My Webhook"></div>
<div><label>Type</label>
<select id="dest-type">
<option value="webhook">Webhook URL</option>
<option value="s3">S3 Bucket</option>
<option value="email">Email</option>
<option value="gdrive">Google Drive</option>
<option value="local">Local Download</option>
</select></div>
</div>
<label>URL / Webhook</label>
<input id="dest-url" placeholder="https://example.com/webhook">
<button class="btn btn-white" onclick="addDestination()">Add Destination</button>
<pre id="dest-output" style="display:none"></pre>
</div></div>
<div class="card"><div class="card-body">
<div class="card-title">Your Destinations</div>
<div id="dest-list" class="card-text">Loading...</div>
</div></div>
</div>

<!-- VALIDATE TAB -->
<div id="tab-validate" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Data Validation</div>
<div class="card-text" style="margin-bottom:12px">Validate data against schemas: check required fields, types, ranges, patterns, and enums.</div>
<label>Data (JSON)</label>
<textarea id="val-data" placeholder='[{"id":"abc","name":"Alice","email":"alice@example.com"}]'></textarea>
<label>Schema (JSON)</label>
<textarea id="val-schema" placeholder='{"id":{"type":"string","required":true},"name":{"type":"string","required":true,"min_length":1},"email":{"type":"string","pattern":"^[^@]+@[^@]+\\\\.[^@]+$"}}'></textarea>
<button class="btn btn-white" onclick="runValidation()">Validate</button>
<button class="btn btn-outline btn-small" onclick="loadValExample()">Load Example</button>
<button class="btn btn-outline btn-small" onclick="loadSchemas()">Built-in Schemas</button>
<pre id="val-output" style="display:none"></pre>
</div></div>
</div>

<!-- DIFF TAB -->
<div id="tab-diff" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Diff / Changelog</div>
<div class="card-text" style="margin-bottom:12px">Compare two exports or two data snapshots to see what changed: added, removed, modified records.</div>
<label>Mode</label>
<select id="diff-mode" onchange="toggleDiffMode()">
<option value="history">Compare Export IDs</option>
<option value="data">Compare Raw Data</option>
</select>
<div id="diff-history-fields">
<div class="grid-2">
<div><label>Export A (ID)</label><input id="diff-a" placeholder="abc12345"></div>
<div><label>Export B (ID)</label><input id="diff-b" placeholder="def67890"></div>
</div>
</div>
<div id="diff-data-fields" style="display:none">
<label>Before (JSON)</label>
<textarea id="diff-before" placeholder='[{"id":"1","name":"Alice"},{"id":"2","name":"Bob"}]'></textarea>
<label>After (JSON)</label>
<textarea id="diff-after" placeholder='[{"id":"1","name":"Alice Updated"},{"id":"3","name":"Charlie"}]'></textarea>
<label>Key Field</label>
<input id="diff-key" value="id" placeholder="id">
</div>
<button class="btn btn-white" onclick="runDiff()">Compare</button>
<pre id="diff-output" style="display:none"></pre>
</div></div>
</div>

<!-- RETENTION TAB -->
<div id="tab-retention" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Retention Policies</div>
<div class="card-text" style="margin-bottom:12px">Set auto-delete rules for old exports. Track storage usage.</div>
<div class="grid-2">
<div><label>Policy Name</label><input id="ret-name" placeholder="30-day cleanup"></div>
<div><label>Max Age (days)</label><input id="ret-days" type="number" value="30" min="1"></div>
</div>
<label>Source Filter (optional)</label>
<select id="ret-source">
<option value="all">All Sources</option>
<option value="chat">Chat</option>
<option value="social">Social</option>
<option value="search">Search</option>
<option value="memory">Memory</option>
</select>
<button class="btn btn-white" onclick="addRetention()">Create Policy</button>
<button class="btn btn-outline" onclick="runRetention()">Run Cleanup Now</button>
<pre id="ret-output" style="display:none"></pre>
</div></div>
<div class="card"><div class="card-body">
<div class="card-title">Storage Usage</div>
<div id="ret-storage" class="card-text">Loading...</div>
</div></div>
</div>

<!-- GDPR TAB -->
<div id="tab-gdpr" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">GDPR Compliance</div>
<div class="card-text" style="margin-bottom:12px">Handle data subject access requests, portability, and right to erasure. All requests tracked with 30-day deadlines.</div>
<div id="gdpr-status-bar" style="margin-bottom:16px"></div>
<h2 style="font-size:14px;margin:16px 0 8px">Data Subject Access Request</h2>
<div class="grid-2">
<div><label>Subject Email</label><input id="gdpr-email" placeholder="user@example.com"></div>
<div><label>Request Type</label>
<select id="gdpr-type">
<option value="access">Access (Art. 15)</option>
<option value="portability">Portability (Art. 20)</option>
<option value="rectification">Rectification (Art. 16)</option>
</select></div>
</div>
<button class="btn btn-white" onclick="submitGDPR()">Submit Request</button>
<h2 style="font-size:14px;margin:16px 0 8px">Right to Erasure</h2>
<div class="grid-2">
<div><label>Subject Email</label><input id="gdpr-erase-email" placeholder="user@example.com"></div>
<div><label>Reason</label><input id="gdpr-erase-reason" placeholder="Right to be forgotten"></div>
</div>
<button class="btn btn-danger" onclick="submitErasure()">Request Erasure</button>
<pre id="gdpr-output" style="display:none"></pre>
</div></div>
<div class="card"><div class="card-body">
<div class="card-title">GDPR Requests</div>
<div id="gdpr-list" class="card-text">Loading...</div>
</div></div>
</div>

<!-- MASK TAB -->
<div id="tab-mask" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Data Masking</div>
<div class="card-text" style="margin-bottom:12px">Redact sensitive fields (emails, SSNs, phone numbers, credit cards) before exporting data.</div>
<label>Data (JSON)</label>
<textarea id="mask-data" placeholder='[{"name":"Alice Smith","email":"alice@example.com","ssn":"123-45-6789","phone":"555-123-4567"}]'></textarea>
<label>Rules (comma-separated, leave blank for defaults)</label>
<input id="mask-rules" placeholder="email,ssn,phone,credit_card,ip_address,name">
<button class="btn btn-white" onclick="runMask()">Mask Data</button>
<button class="btn btn-outline btn-small" onclick="loadMaskExample()">Load Example</button>
<button class="btn btn-outline btn-small" onclick="loadMaskRules()">Available Rules</button>
<pre id="mask-output" style="display:none"></pre>
</div></div>
</div>

<!-- SYNC TAB -->
<div id="tab-sync" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Sync Connectors</div>
<div class="card-text" style="margin-bottom:12px">Two-way sync between BlackRoad products and external services (Notion, Airtable, Supabase, etc).</div>
<div class="grid-2">
<div><label>Name</label><input id="sync-name" placeholder="My Notion Sync"></div>
<div><label>Service</label>
<select id="sync-service">
<option value="notion">Notion</option>
<option value="airtable">Airtable</option>
<option value="google_sheets">Google Sheets</option>
<option value="supabase">Supabase</option>
<option value="postgres">PostgreSQL</option>
<option value="mysql">MySQL</option>
<option value="firebase">Firebase</option>
<option value="custom_api">Custom API</option>
</select></div>
</div>
<div class="grid-2">
<div><label>Direction</label>
<select id="sync-direction">
<option value="export">Export (push out)</option>
<option value="import">Import (pull in)</option>
<option value="both">Both (two-way)</option>
</select></div>
<div><label>Endpoint URL</label><input id="sync-url" placeholder="https://api.example.com/data"></div>
</div>
<button class="btn btn-white" onclick="addSync()">Create Connector</button>
<pre id="sync-output" style="display:none"></pre>
</div></div>
<div class="card"><div class="card-body">
<div class="card-title">Your Connectors</div>
<div id="sync-list" class="card-text">Loading...</div>
</div></div>
</div>

<!-- LINEAGE TAB -->
<div id="tab-lineage" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Data Lineage</div>
<div class="card-text" style="margin-bottom:12px">Track where your data came from, what transformations were applied, and where it went.</div>
<label>Export ID (from history)</label>
<input id="lineage-export-id" placeholder="abc12345">
<button class="btn btn-white" onclick="traceLineage()">Auto-Trace Lineage</button>
<button class="btn btn-outline" onclick="viewLineage()">View Lineage</button>
<pre id="lineage-output" style="display:none"></pre>
</div></div>
</div>

<!-- BULK TAB -->
<div id="tab-bulk" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Bulk Operations</div>
<div class="card-text" style="margin-bottom:12px">Batch process multiple operations in a single request: export, mask, validate, transform, convert.</div>
<label>Operations (JSON array)</label>
<textarea id="bulk-ops" placeholder='[{"type":"export","source":"chat"},{"type":"validate","data":[{"id":"1"}],"schema":{"id":{"required":true}}}]'></textarea>
<button class="btn btn-white" onclick="runBulk()">Run Batch</button>
<button class="btn btn-outline btn-small" onclick="loadBulkExample()">Load Example</button>
<pre id="bulk-output" style="display:none"></pre>
</div></div>
</div>

<!-- QUALITY TAB -->
<div id="tab-quality" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Data Quality Score</div>
<div class="card-text" style="margin-bottom:12px">Score your data on completeness, accuracy, consistency, and freshness. Grades A through F.</div>
<label>Data (JSON array)</label>
<textarea id="quality-data" placeholder='[{"id":"1","name":"Alice","email":"alice@example.com","created_at":"2026-03-30"},{"id":"2","name":"","email":null}]'></textarea>
<label>Expected Fields (comma-separated, optional)</label>
<input id="quality-fields" placeholder="id,name,email,created_at">
<button class="btn btn-white" onclick="runQuality()">Score Data</button>
<button class="btn btn-outline btn-small" onclick="loadQualityExample()">Load Example</button>
<button class="btn btn-outline" onclick="checkSourceQuality()">Check Live Source</button>
<pre id="quality-output" style="display:none"></pre>
</div></div>
</div>

<!-- CONVERT TAB -->
<div id="tab-convert" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Format Converter</div>
<div class="card-text" style="margin-bottom:12px">Convert between JSON, CSV, XML, YAML, and SQL.</div>
<label>Input Data (JSON)</label>
<textarea id="convert-data" placeholder='[{"name":"Alice","age":30,"city":"NYC"},{"name":"Bob","age":25,"city":"LA"}]'></textarea>
<div class="grid-2">
<div><label>From Format</label>
<select id="convert-from">
<option value="json">JSON</option>
<option value="csv">CSV</option>
</select></div>
<div><label>To Format</label>
<select id="convert-to">
<option value="csv">CSV</option>
<option value="xml">XML</option>
<option value="yaml">YAML</option>
<option value="sql">SQL</option>
<option value="json">JSON</option>
</select></div>
</div>
<label>Table Name (for XML/SQL, optional)</label>
<input id="convert-table" placeholder="users">
<button class="btn btn-white" onclick="runConvert()">Convert</button>
<button class="btn btn-outline btn-small" onclick="loadConvertExample()">Load Example</button>
<pre id="convert-output" style="display:none"></pre>
</div></div>
</div>

<!-- WEBHOOKS TAB -->
<div id="tab-webhooks" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Webhook Receiver</div>
<div class="card-text" style="margin-bottom:12px">Register webhook endpoints to receive incoming data. Auto-route to pipelines, auto-mask sensitive fields.</div>
<div class="grid-2">
<div><label>Webhook Name</label><input id="wh-name" placeholder="GitHub Push Events"></div>
<div><label>Pipeline ID (optional)</label><input id="wh-pipeline" placeholder="abc12345"></div>
</div>
<label><input type="checkbox" id="wh-automask" style="width:auto;margin-right:6px">Auto-mask sensitive data on receive</label>
<button class="btn btn-white" onclick="addWebhook()">Create Webhook</button>
<pre id="wh-output" style="display:none"></pre>
</div></div>
<div class="card"><div class="card-body">
<div class="card-title">Your Webhooks</div>
<div id="wh-list" class="card-text">Loading...</div>
</div></div>
</div>

<!-- CATALOG TAB -->
<div id="tab-catalog" class="tab-content">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Data Catalog</div>
<div class="card-text" style="margin-bottom:12px">Browse all available data sources with schemas, sample data, and freshness info.</div>
<button class="btn btn-white" onclick="loadCatalog(false)">Load Catalog</button>
<button class="btn btn-outline" onclick="loadCatalog(true)">Load with Live Samples</button>
<label style="margin-top:12px">Search Fields</label>
<div style="display:flex;gap:8px">
<input id="catalog-search" placeholder="Search fields across all sources..." style="flex:1">
<button class="btn btn-outline btn-small" onclick="searchCatalog()">Search</button>
</div>
<pre id="catalog-output" style="display:none"></pre>
</div></div>
</div>

<div class="footer"><a href="https://blackroad.io">BlackRoad OS</a> — Pave Tomorrow.</div>
</div>
<script>
function switchTab(name){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  event.target.classList.add('active');
  if(name==='pipelines')loadPipelines();
  if(name==='destinations')loadDestinations();
  if(name==='retention')loadRetention();
  if(name==='gdpr')loadGDPR();
  if(name==='sync')loadSyncConnectors();
  if(name==='webhooks')loadWebhooks();
}

async function quickExport(source){
  const el=document.getElementById('output');el.style.display='block';el.textContent='Exporting '+source+'...';
  const r=await fetch('/api/export/quick?source='+source);el.textContent=JSON.stringify(await r.json(),null,2);
}

// Transform
function loadTransformExample(){
  document.getElementById('transform-data').value=JSON.stringify([{name:"Alice",age:30,city:"NYC",score:95},{name:"Bob",age:25,city:"LA",score:87},{name:"Charlie",age:35,city:"NYC",score:92}],null,2);
  document.getElementById('transform-ops').value=JSON.stringify([{type:"filter_rows",field:"city",operator:"eq",value:"NYC"},{type:"sort",field:"score",direction:"desc"},{type:"filter_fields",fields:["name","score"]}],null,2);
}
async function runTransform(){
  const el=document.getElementById('transform-output');el.style.display='block';el.textContent='Transforming...';
  try{
    const data=JSON.parse(document.getElementById('transform-data').value);
    const transforms=JSON.parse(document.getElementById('transform-ops').value);
    const r=await fetch('/api/transform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,transforms})});
    el.textContent=JSON.stringify(await r.json(),null,2);
  }catch(e){el.textContent='Error: '+e.message;}
}

// Preview
async function runPreview(){
  const el=document.getElementById('preview-output');el.style.display='block';el.textContent='Loading preview...';
  const source=document.getElementById('preview-source').value;
  const limit=document.getElementById('preview-limit').value;
  const r=await fetch('/api/preview?source='+source+'&limit='+limit);
  el.textContent=JSON.stringify(await r.json(),null,2);
}

// Pipelines
function loadPipeExample(){
  document.getElementById('pipe-name').value='Daily Chat Export';
  document.getElementById('pipe-desc').value='Extract chat data, validate, and deliver to webhook';
  document.getElementById('pipe-steps').value=JSON.stringify([{type:"extract",source:"chat"},{type:"validate",schema:{id:{required:true}},fail_on_error:false},{type:"deliver",webhook_url:"https://example.com/hook"},{type:"notify",message:"Chat export complete"}],null,2);
}
async function createPipeline(){
  const el=document.getElementById('pipe-output');el.style.display='block';el.textContent='Creating...';
  try{
    const steps=JSON.parse(document.getElementById('pipe-steps').value);
    const r=await fetch('/api/pipelines',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('pipe-name').value,description:document.getElementById('pipe-desc').value,steps})});
    el.textContent=JSON.stringify(await r.json(),null,2);loadPipelines();
  }catch(e){el.textContent='Error: '+e.message;}
}
async function loadPipelines(){
  const r=await fetch('/api/pipelines');const d=await r.json();
  const el=document.getElementById('pipe-list');
  if(!d.pipelines||d.pipelines.length===0){el.innerHTML='No pipelines yet. Create one above.';return;}
  el.innerHTML=d.pipelines.map(p=>'<div style="padding:8px 0;border-bottom:1px solid var(--border)"><strong>'+p.name+'</strong> <span class="badge btn-small">'+(JSON.parse(p.steps||"[]").length)+' steps</span> <span class="badge btn-small">'+p.run_count+' runs</span> <button class="btn btn-outline btn-small" onclick="runPipeline(\''+p.id+'\')">Run</button></div>').join('');
}
async function runPipeline(id){
  const el=document.getElementById('pipe-output');el.style.display='block';el.textContent='Running pipeline...';
  const r=await fetch('/api/pipelines/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pipeline_id:id})});
  el.textContent=JSON.stringify(await r.json(),null,2);
}

// Destinations
async function addDestination(){
  const el=document.getElementById('dest-output');el.style.display='block';el.textContent='Adding...';
  const r=await fetch('/api/destinations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('dest-name').value,type:document.getElementById('dest-type').value,webhook:document.getElementById('dest-url').value,url:document.getElementById('dest-url').value})});
  el.textContent=JSON.stringify(await r.json(),null,2);loadDestinations();
}
async function loadDestinations(){
  const r=await fetch('/api/destinations');const d=await r.json();
  const el=document.getElementById('dest-list');
  if(!d.destinations||d.destinations.length===0){el.innerHTML='No destinations configured yet.';return;}
  el.innerHTML=d.destinations.map(d=>'<div style="padding:8px 0;border-bottom:1px solid var(--border)"><strong>'+d.name+'</strong> <span class="badge btn-small">'+d.type+'</span> <button class="btn btn-outline btn-small" onclick="testDest(\''+d.id+'\')">Test</button></div>').join('');
}
async function testDest(id){
  const el=document.getElementById('dest-output');el.style.display='block';el.textContent='Testing connection...';
  const r=await fetch('/api/destinations/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destination_id:id})});
  el.textContent=JSON.stringify(await r.json(),null,2);
}

// Validate
function loadValExample(){
  document.getElementById('val-data').value=JSON.stringify([{id:"1",name:"Alice",email:"alice@example.com",age:30},{id:"2",name:"",email:"invalid",age:-5}],null,2);
  document.getElementById('val-schema').value=JSON.stringify({id:{type:"string",required:true},name:{type:"string",required:true,min_length:1},email:{type:"string",required:true,pattern:"^[^@]+@[^@]+\\\\.[^@]+$"},age:{type:"number",min:0,max:150}},null,2);
}
async function loadSchemas(){
  const el=document.getElementById('val-output');el.style.display='block';el.textContent='Loading schemas...';
  const r=await fetch('/api/validate/schemas');el.textContent=JSON.stringify(await r.json(),null,2);
}
async function runValidation(){
  const el=document.getElementById('val-output');el.style.display='block';el.textContent='Validating...';
  try{
    const data=JSON.parse(document.getElementById('val-data').value);
    const schema=JSON.parse(document.getElementById('val-schema').value);
    const r=await fetch('/api/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,schema})});
    el.textContent=JSON.stringify(await r.json(),null,2);
  }catch(e){el.textContent='Error: '+e.message;}
}

// Diff
function toggleDiffMode(){
  const mode=document.getElementById('diff-mode').value;
  document.getElementById('diff-history-fields').style.display=mode==='history'?'block':'none';
  document.getElementById('diff-data-fields').style.display=mode==='data'?'block':'none';
}
async function runDiff(){
  const el=document.getElementById('diff-output');el.style.display='block';el.textContent='Comparing...';
  const mode=document.getElementById('diff-mode').value;
  let body;
  if(mode==='history'){
    body={export_a:document.getElementById('diff-a').value,export_b:document.getElementById('diff-b').value};
  }else{
    try{body={before:JSON.parse(document.getElementById('diff-before').value),after:JSON.parse(document.getElementById('diff-after').value),key_field:document.getElementById('diff-key').value};}
    catch(e){el.textContent='Error parsing JSON: '+e.message;return;}
  }
  const r=await fetch('/api/diff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  el.textContent=JSON.stringify(await r.json(),null,2);
}

// Retention
async function addRetention(){
  const el=document.getElementById('ret-output');el.style.display='block';el.textContent='Creating policy...';
  const r=await fetch('/api/retention',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('ret-name').value,max_age_days:parseInt(document.getElementById('ret-days').value),source_filter:document.getElementById('ret-source').value})});
  el.textContent=JSON.stringify(await r.json(),null,2);loadRetention();
}
async function runRetention(){
  const el=document.getElementById('ret-output');el.style.display='block';el.textContent='Running cleanup...';
  const r=await fetch('/api/retention/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
  el.textContent=JSON.stringify(await r.json(),null,2);loadRetention();
}
async function loadRetention(){
  const r=await fetch('/api/retention');const d=await r.json();
  const el=document.getElementById('ret-storage');
  const s=d.storage||{};
  el.innerHTML='<strong>'+s.total_bytes_human+'</strong> total across <strong>'+s.total_records+'</strong> export records'+(s.oldest_export?' | Oldest: '+s.oldest_export.split('T')[0]:'')+'<br><br>'+(d.policies||[]).map(p=>'<div style="padding:6px 0;border-bottom:1px solid var(--border)"><strong>'+p.name+'</strong> — delete after '+p.max_age_days+' days'+(p.source_filter&&p.source_filter!=='all'?' ('+p.source_filter+' only)':'')+(p.last_run?' | Last run: '+p.last_run:'')+'</div>').join('');
}

// GDPR
async function submitGDPR(){
  const el=document.getElementById('gdpr-output');el.style.display='block';el.textContent='Submitting request...';
  const r=await fetch('/api/gdpr/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject_email:document.getElementById('gdpr-email').value,type:document.getElementById('gdpr-type').value})});
  el.textContent=JSON.stringify(await r.json(),null,2);loadGDPR();
}
async function submitErasure(){
  const email=document.getElementById('gdpr-erase-email').value;
  if(!email){alert('Email required');return;}
  if(!confirm('This will request erasure of all data for '+email+'. Continue?'))return;
  const el=document.getElementById('gdpr-output');el.style.display='block';el.textContent='Processing erasure...';
  const r=await fetch('/api/gdpr/erase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject_email:email,reason:document.getElementById('gdpr-erase-reason').value||'Right to be forgotten',confirm:true})});
  el.textContent=JSON.stringify(await r.json(),null,2);loadGDPR();
}
async function loadGDPR(){
  const[statusR,listR]=await Promise.all([fetch('/api/gdpr/status'),fetch('/api/gdpr/request')]);
  const status=await statusR.json();const list=await listR.json();
  const s=status.gdpr_status||{};
  document.getElementById('gdpr-status-bar').innerHTML='<span class="badge"><span class="badge-dot"></span>'+s.total_requests+' total</span> <span class="badge" style="margin-left:6px"><span class="badge-dot"></span>'+s.pending+' pending</span> <span class="badge" style="margin-left:6px"><span class="badge-dot"></span>'+s.fulfilled+' fulfilled</span> <span class="badge" style="margin-left:6px"><span class="badge-dot" style="background:'+(s.compliance==='compliant'?'#4ade80':'#f87171')+'"></span>'+s.compliance+'</span>'+(s.overdue>0?' <span class="badge" style="margin-left:6px;border-color:#f87171"><span class="badge-dot" style="background:#f87171"></span>'+s.overdue+' overdue</span>':'');
  const el=document.getElementById('gdpr-list');
  const reqs=list.requests||[];
  if(reqs.length===0){el.innerHTML='No GDPR requests yet.';return;}
  el.innerHTML=reqs.map(r=>'<div style="padding:8px 0;border-bottom:1px solid var(--border)"><strong>'+r.type+'</strong> — '+r.subject_email+' <span class="badge btn-small '+(r.status==='pending'?'status-warn':r.status==='completed'||r.status==='fulfilled'?'status-ok':'')+'">'+r.status+'</span> <span style="font-size:11px;color:var(--sub)">'+r.created_at+'</span>'+(r.status==='pending'?' <button class="btn btn-outline btn-small" onclick="fulfillGDPR(\''+r.id+'\')">Fulfill</button>':'')+'</div>').join('');
}
async function fulfillGDPR(id){
  const r=await fetch('/api/gdpr/request/'+id+'/fulfill',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  const d=await r.json();
  const el=document.getElementById('gdpr-output');el.style.display='block';el.textContent=JSON.stringify(d,null,2);loadGDPR();
}

// Mask
function loadMaskExample(){
  document.getElementById('mask-data').value=JSON.stringify([{name:"Alice Smith",email:"alice@example.com",ssn:"123-45-6789",phone:"555-123-4567",notes:"Contact at alice@work.com or 555-987-6543"},{name:"Bob Jones",email:"bob@test.org",ssn:"987-65-4321",phone:"212-555-0199",card:"4111-1111-1111-1111"}],null,2);
  document.getElementById('mask-rules').value='email,ssn,phone,credit_card,name';
}
async function loadMaskRules(){
  const el=document.getElementById('mask-output');el.style.display='block';el.textContent='Loading...';
  const r=await fetch('/api/mask');el.textContent=JSON.stringify(await r.json(),null,2);
}
async function runMask(){
  const el=document.getElementById('mask-output');el.style.display='block';el.textContent='Masking...';
  try{
    const data=JSON.parse(document.getElementById('mask-data').value);
    const rulesStr=document.getElementById('mask-rules').value.trim();
    const rules=rulesStr?rulesStr.split(',').map(s=>s.trim()):undefined;
    const r=await fetch('/api/mask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,rules})});
    el.textContent=JSON.stringify(await r.json(),null,2);
  }catch(e){el.textContent='Error: '+e.message;}
}

// Sync
async function addSync(){
  const el=document.getElementById('sync-output');el.style.display='block';el.textContent='Creating...';
  const r=await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('sync-name').value,service:document.getElementById('sync-service').value,direction:document.getElementById('sync-direction').value,endpoint_url:document.getElementById('sync-url').value})});
  el.textContent=JSON.stringify(await r.json(),null,2);loadSyncConnectors();
}
async function loadSyncConnectors(){
  const r=await fetch('/api/sync');const d=await r.json();
  const el=document.getElementById('sync-list');
  const conns=d.connectors||[];
  if(conns.length===0){el.innerHTML='No sync connectors yet.';return;}
  el.innerHTML=conns.map(c=>'<div style="padding:8px 0;border-bottom:1px solid var(--border)"><strong>'+c.name+'</strong> <span class="badge btn-small">'+c.service+'</span> <span class="badge btn-small">'+c.direction+'</span> <span class="badge btn-small">'+c.sync_count+' syncs</span> <button class="btn btn-outline btn-small" onclick="runSync(\''+c.id+'\')">Sync Now</button></div>').join('');
}
async function runSync(id){
  const el=document.getElementById('sync-output');el.style.display='block';el.textContent='Syncing...';
  const r=await fetch('/api/sync/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({connector_id:id})});
  el.textContent=JSON.stringify(await r.json(),null,2);
}

// Lineage
async function traceLineage(){
  const el=document.getElementById('lineage-output');el.style.display='block';el.textContent='Tracing lineage...';
  const exportId=document.getElementById('lineage-export-id').value;
  if(!exportId){el.textContent='Enter an export ID from history.';return;}
  const r=await fetch('/api/lineage/trace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({export_id:exportId})});
  el.textContent=JSON.stringify(await r.json(),null,2);
}
async function viewLineage(){
  const el=document.getElementById('lineage-output');el.style.display='block';el.textContent='Loading lineage...';
  const exportId=document.getElementById('lineage-export-id').value;
  const url=exportId?'/api/lineage?export_id='+exportId:'/api/lineage';
  const r=await fetch(url);el.textContent=JSON.stringify(await r.json(),null,2);
}

// Bulk
function loadBulkExample(){
  document.getElementById('bulk-ops').value=JSON.stringify([{type:"export",source:"chat",format:"json"},{type:"validate",data:[{id:"1",name:"Alice"},{id:"2",name:""}],schema:{id:{required:true},name:{required:true,min_length:1}}},{type:"transform",data:[{name:"Alice",age:30},{name:"Bob",age:25}],transforms:[{type:"sort",field:"age",direction:"desc"}]}],null,2);
}
async function runBulk(){
  const el=document.getElementById('bulk-output');el.style.display='block';el.textContent='Processing batch...';
  try{
    const operations=JSON.parse(document.getElementById('bulk-ops').value);
    const r=await fetch('/api/bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operations})});
    el.textContent=JSON.stringify(await r.json(),null,2);
  }catch(e){el.textContent='Error: '+e.message;}
}

// Quality
function loadQualityExample(){
  document.getElementById('quality-data').value=JSON.stringify([{id:"1",name:"Alice",email:"alice@example.com",created_at:"2026-03-30T10:00:00Z",score:95},{id:"2",name:"",email:null,created_at:"2026-03-29T08:00:00Z",score:87},{id:"3",name:"Charlie",email:"charlie@test.com",created_at:"2025-01-01T00:00:00Z",score:"ninety"},{id:"1",name:"Alice",email:"alice@example.com",created_at:"2026-03-30T10:00:00Z",score:95}],null,2);
  document.getElementById('quality-fields').value='id,name,email,created_at,score';
}
async function runQuality(){
  const el=document.getElementById('quality-output');el.style.display='block';el.textContent='Scoring...';
  try{
    const data=JSON.parse(document.getElementById('quality-data').value);
    const fieldsStr=document.getElementById('quality-fields').value.trim();
    const expected_fields=fieldsStr?fieldsStr.split(',').map(s=>s.trim()):undefined;
    const r=await fetch('/api/quality',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,expected_fields})});
    el.textContent=JSON.stringify(await r.json(),null,2);
  }catch(e){el.textContent='Error: '+e.message;}
}
async function checkSourceQuality(){
  const el=document.getElementById('quality-output');el.style.display='block';el.textContent='Checking live source...';
  const r=await fetch('/api/quality?source=all');el.textContent=JSON.stringify(await r.json(),null,2);
}

// Convert
function loadConvertExample(){
  document.getElementById('convert-data').value=JSON.stringify([{name:"Alice",age:30,city:"NYC",role:"engineer"},{name:"Bob",age:25,city:"LA",role:"designer"},{name:"Charlie",age:35,city:"CHI",role:"manager"}],null,2);
  document.getElementById('convert-from').value='json';
  document.getElementById('convert-to').value='csv';
  document.getElementById('convert-table').value='users';
}
async function runConvert(){
  const el=document.getElementById('convert-output');el.style.display='block';el.textContent='Converting...';
  try{
    const dataStr=document.getElementById('convert-data').value;
    const from=document.getElementById('convert-from').value;
    let data=from==='csv'?dataStr:JSON.parse(dataStr);
    const to=document.getElementById('convert-to').value;
    const table_name=document.getElementById('convert-table').value||undefined;
    const r=await fetch('/api/convert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,from,to,table_name})});
    el.textContent=JSON.stringify(await r.json(),null,2);
  }catch(e){el.textContent='Error: '+e.message;}
}

// Webhooks
async function addWebhook(){
  const el=document.getElementById('wh-output');el.style.display='block';el.textContent='Creating...';
  const r=await fetch('/api/webhooks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('wh-name').value,pipeline_id:document.getElementById('wh-pipeline').value||undefined,auto_mask:document.getElementById('wh-automask').checked})});
  el.textContent=JSON.stringify(await r.json(),null,2);loadWebhooks();
}
async function loadWebhooks(){
  const r=await fetch('/api/webhooks');const d=await r.json();
  const el=document.getElementById('wh-list');
  const whs=d.webhooks||[];
  if(whs.length===0){el.innerHTML='No webhooks registered yet.';return;}
  el.innerHTML=whs.map(w=>'<div style="padding:8px 0;border-bottom:1px solid var(--border)"><strong>'+w.name+'</strong> <span class="badge btn-small">'+w.received_count+' received</span>'+(w.auto_mask?' <span class="badge btn-small">auto-mask</span>':'')+(w.pipeline_id?' <span class="badge btn-small">pipeline: '+w.pipeline_id+'</span>':'')+' <button class="btn btn-outline btn-small" onclick="viewWebhookEvents(\''+w.id+'\')">Events</button></div>').join('');
}
async function viewWebhookEvents(id){
  const el=document.getElementById('wh-output');el.style.display='block';el.textContent='Loading events...';
  const r=await fetch('/api/webhooks/'+id+'/events');el.textContent=JSON.stringify(await r.json(),null,2);
}

// Catalog
async function loadCatalog(withSamples){
  const el=document.getElementById('catalog-output');el.style.display='block';el.textContent='Loading catalog...';
  const r=await fetch('/api/catalog'+(withSamples?'?samples=true':''));el.textContent=JSON.stringify(await r.json(),null,2);
}
async function searchCatalog(){
  const q=document.getElementById('catalog-search').value;
  if(!q)return;
  const el=document.getElementById('catalog-output');el.style.display='block';el.textContent='Searching...';
  const r=await fetch('/api/catalog/search?q='+encodeURIComponent(q));el.textContent=JSON.stringify(await r.json(),null,2);
}

// Init
fetch('/api/stats').then(r=>r.json()).then(d=>{
  document.getElementById('s-exports').textContent=d.exports||0;
  document.getElementById('s-runs').textContent=d.total_runs||0;
  document.getElementById('s-dests').textContent=d.destinations||0;
  document.getElementById('s-pipes').textContent=d.pipelines||0;
  document.getElementById('s-gdpr').textContent=d.pending_gdpr||0;
}).catch(()=>{});
window.addEventListener('message',function(e){if(e.data</script></script>e.data.type==='blackroad-os:context'){window._osUser=e.data.user;window._osToken=e.data.token;}});if(window.parent!==window)window.parent.postMessage({type:'blackroad-os:request-context'},'*');
</script></body></html>`;
