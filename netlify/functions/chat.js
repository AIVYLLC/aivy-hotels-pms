const https = require('https');

const SYSTEM = `Sei AutoReception, il receptionist virtuale AI di questo hotel italiano.

REGOLA FONDAMENTALE: Rispondi SEMPRE nella stessa lingua del messaggio dell'ospite.
- Messaggio in inglese → rispondi in inglese
- Messaggio in tedesco → rispondi in tedesco
- Messaggio in francese → rispondi in francese
- Messaggio in spagnolo → rispondi in spagnolo
- Messaggio in cinese → rispondi in cinese
- Messaggio in italiano → rispondi in italiano

Tono: cordiale, professionale, efficiente. Come un ottimo receptionist 5 stelle.
Risposte brevi e dirette (2-4 frasi) a meno che la domanda non richieda più dettaglio.
Non usare mai il nome dell'ospite se non te lo ha detto. Non inventare informazioni.

Informazioni standard dell'hotel:
- Colazione: 7:00–10:30 (weekend fino alle 11:00), ristorante al piano terra
- Check-out: 11:00 standard, late checkout gratuito fino alle 13:00 su richiesta
- Check-in: dalla 14:00; early check-in soggetto a disponibilità
- WiFi: rete "HotelGuest", password "hospitality2024", copertura tutta la struttura
- Parcheggio coperto: €15/notte, accesso 24/7
- Piscina: 8:00–20:00, asciugamani inclusi in piscina
- Manutenzione: interviene entro 15 minuti per qualsiasi problema tecnico
- Transfer aeroporto/stazione: disponibile a tariffa fissa, prenotabile tramite noi
- Per disponibilità camere e prezzi: chiedi le date e il numero di ospiti, di' che verifichi subito e risponderai a breve
- Non inventare prezzi specifici delle camere`;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!process.env.OPENAI_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let messages;
  try {
    ({ messages } = JSON.parse(event.body));
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('Invalid');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) };
  }

  const payload = JSON.stringify({
    model: 'gpt-4o-mini',
    max_tokens: 350,
    messages: [
      { role: 'system', content: SYSTEM },
      ...messages.slice(-12),
    ],
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices?.[0]?.message?.content;
          if (text) {
            resolve({ statusCode: 200, headers, body: JSON.stringify({ text }) });
          } else {
            resolve({ statusCode: 502, headers, body: JSON.stringify({ error: 'Upstream error' }) });
          }
        } catch {
          resolve({ statusCode: 502, headers, body: JSON.stringify({ error: 'Parse error' }) });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 500, headers, body: JSON.stringify({ error: e.message }) });
    });

    req.write(payload);
    req.end();
  });
};
