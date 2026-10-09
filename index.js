const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*'
};

app.get('/api/extract', async (req, res) => {
  const { type, id } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'ID do TMDB não fornecido.' });
  }

  try {
    const embedUrl = type === 'serie' 
      ? `https://embed.warezcdn.com/serie/${id}/1/1`
      : `https://embed.warezcdn.com/filme/${id}`;

    const response = await axios.get(embedUrl, { headers: HEADERS, timeout: 10000 });
    const html = response.data;
    const $ = cheerio.load(html);

    let extractedUrl = null;

    $('iframe, source, script').each((i, el) => {
      const src = $(el).attr('src') \vert{}\vert{}$(el).html();
      if (src && (src.includes('.m3u8') || src.includes('.mp4'))) {
        const match = src.match(/(https?:\/\/[^\s"'<]+(\.m3u8|\.mp4))/i);
        if (match && !extractedUrl) {
          extractedUrl = match[0];
        }
      }
    });

    if (extractedUrl) {
      try {
        const check = await axios.head(extractedUrl, { headers: HEADERS, timeout: 5000 });
        if (check.status === 200) {
          return res.json({ success: true, streamUrl: extractedUrl });
        }
      } catch (err) {
        try {
          const checkGet = await axios.get(extractedUrl, { headers: { ...HEADERS, Range: 'bytes=0-1' }, timeout: 5000 });
          if (checkGet.status === 200 || checkGet.status === 206) {
            return res.json({ success: true, streamUrl: extractedUrl });
          }
        } catch (e) {
          console.log('Falha na validação do stream direto.');
        }
      }
    }

    return res.json({ 
      success: false, 
      message: 'Vídeo limpo sem anúncios indisponível no momento para este título.' 
    });

  } catch (error) {
    return res.json({ 
      success: false, 
      error: 'Falha ao processar o filme.',
      message: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Verificador a rodar na porta ${PORT}`);
});

module.exports = app;
