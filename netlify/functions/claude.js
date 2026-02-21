exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyA1UJO8UIlkWwYU5pxWHbQ0Rl0Wr94HUmw';

    // Convert Anthropic-style request to Gemini format
    const parts = [];
    for (const msg of body.messages || []) {
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text });
          } else if (block.type === 'document') {
            parts.push({
              inlineData: {
                mimeType: block.source.media_type,
                data: block.source.data
              }
            });
          }
        }
      } else if (typeof msg.content === 'string') {
        parts.push({ text: msg.content });
      }
    }

    // Add system prompt as first text part
    if (body.system) {
      parts.unshift({ text: 'INSTRUCCIONES DEL SISTEMA:\n' + body.system + '\n\n' });
    }

    const geminiBody = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        maxOutputTokens: body.max_tokens || 4000,
        temperature: 0.4
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: { message: data.error?.message || 'Gemini error' } })
      };
    }

    // Convert Gemini response back to Anthropic-style format
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const anthropicStyle = {
      content: [{ type: 'text', text }]
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(anthropicStyle)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: { message: err.message } })
    };
  }
};
