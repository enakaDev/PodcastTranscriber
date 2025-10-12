import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { zValidator } from '@hono/zod-validator'
import { number, z } from 'zod'
import { XMLParser } from 'fast-xml-parser'
import  {  createClient  }  from  "@deepgram/sdk" ; 

type Bindings = {
    DEEPGRAM_API_KEY: string,
    DEEPL_API_KEY: string,
    RSS_LINKS: {
        name: string,
        url: string
    }[],
    DB: D1Database;
    TRANSCRIPTION_BUCKET: R2Bucket;
}

const app = new Hono<{ Bindings: Bindings }>()
app.use('*', cors()) // CORS有効化

const channelSchema = z.object({
    channel: z.object({
        id: z.number().int(),
        rss_url: z.string(),
        title: z.string(),
        image_url: z.string().optional(),
        description: z.string().optional(),
    })
})

const episodeSchema = z.object({
	episode: z.object({
        audioUrl: z.string().url(),
        title: z.string(),
        description: z.string().optional(),
        pubDate: z.string(),
        duration: z.number().optional(),
    }),
    channel: z.object({
        id: z.number().int(),
        rss_url: z.string().url(),
        title: z.string(),
        image_url: z.string().optional(),
        description: z.string().optional(),
    })
})


export async function fetchAndParseRSS(url: string) {
    // 1. fetchでRSSフィードを取得
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to fetch RSS feed: ${response.status}`)
    }

    const xmlText = await response.text()

    // 2. fast-xml-parser でパース
    const parser = new XMLParser({
        ignoreAttributes: false
    })
    const parsed = parser.parse(xmlText)

    // 3. RSSフィードの中身にアクセスできる
    return parsed
}
app.post('/episodes', zValidator('json', channelSchema), async (c) => {
    const { channel } = await c.req.json();
    const rssUrl = channel.rss_url;

    try {
        const feed = await fetchAndParseRSS(rssUrl);
        if (!feed.rss.channel.item || feed.rss.channel.item.length === 0) {
            return c.json({ error: "No items found in RSS feed" }, 400);
        }

        const items: any[] = feed.rss.channel.item

        return c.json({ 
        episodes: items.map(item => {
            return {
                title: item.title,
                audioUrl: item.enclosure["@_url"],
                description: item.description,
                pubDate: item.pubDate,
                duration: item["itunes:duration"]
            }
        })
    })
    } catch (error: any) {
        console.error("Error during fetching episodes:", error);
        return c.json({ error: "Failed to fetch episodes", details: error.stack }, 500);
    }
});

interface TranslateResponse {
    translations: {
        detected_source_language: string;
        text: string;
    }[];
}

app.post('/get-saved-transcription', zValidator('json', episodeSchema), async (c) => {
    const { episode, channel } = await c.req.json();
    const episodeTitle = episode.title;
    const channelTitle = channel.title;

    try {
        let transcriptionResult: string;
        let segmentsResult: any[] | undefined;
        let translationResult: string;

        const preSavedTranscription = await c.env.TRANSCRIPTION_BUCKET.get(
            `transcriptions/${channelTitle}_${episodeTitle}.txt`
        );
        const preSavedTranscriptionSegments = await c.env.TRANSCRIPTION_BUCKET.get(
            `transcriptions_segments/${channelTitle}_${episodeTitle}_segments.json`
        );
        if (preSavedTranscription && preSavedTranscriptionSegments) {
            transcriptionResult = await preSavedTranscription.text();
            segmentsResult = JSON.parse(await preSavedTranscriptionSegments.text());
        } else {
            return c.json({ transcription: undefined });
        }
        const preSavedTranslation = await c.env.TRANSCRIPTION_BUCKET.get(
            `translations/${channelTitle}_${episodeTitle}.text`
        );
        if (preSavedTranslation) {
            translationResult = await preSavedTranslation.text();
        } else {
            return c.json({ transcription: {
                original: transcriptionResult,
                segments : segmentsResult,
                translation: undefined
            } });
        }

        return c.json({ 
            transcription: {
                original: transcriptionResult,
                segments : segmentsResult,
                translation: translationResult
            }
        })
    } catch (error: any) {
        console.error("Error during transcription:", error);
        return c.json({ error: "Transcription failed", details: error.stack }, 500);
    }
});

app.post('/get-new-transcription', zValidator('json', episodeSchema), async (c) => {
    const { episode, channel } = await c.req.json();
    const audioUrl = episode.audioUrl;
    const episodeTitle = episode.title;
    const channelTitle = channel.title;

    try {
        let transcriptionResult: string;
        let segmentsResult: any[] | undefined;
        let translationResult: string | undefined;

        // Deepgram API へリクエスト
        const deepgramClient = createClient (c.env.DEEPGRAM_API_KEY);
        const {result, error} = await deepgramClient.listen.prerecorded.transcribeUrl(
        {
            url: audioUrl,
        },
        {
            model: "nova",
            paragraphs: true,
            diarize: true
        }
        );
        if (error) {
            return c.json({ error: "Deepgram API error", details: error }, 500);
        }

        transcriptionResult = await result.results.channels[0].alternatives[0].transcript
        segmentsResult = await result.results.channels[0].alternatives[0].paragraphs?.paragraphs.flatMap(p => p.sentences)

        await c.env.TRANSCRIPTION_BUCKET.put(
            `transcriptions/${channelTitle}_${episodeTitle}.txt`,
            new TextEncoder().encode(transcriptionResult),
            {
                httpMetadata: {
                    contentType: 'text/plain',
                }
            }
        );
        await c.env.TRANSCRIPTION_BUCKET.put(
            `transcriptions_segments/${channelTitle}_${episodeTitle}_segments.json`,
            JSON.stringify(segmentsResult),
            {
                httpMetadata: {
                    contentType: 'application/json',
                }
            }
        );

        const res = await fetch(`https://api-free.deepl.com/v2/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `DeepL-Auth-Key ${c.env.DEEPL_API_KEY}`,
            },
            body: JSON.stringify({
                text: [transcriptionResult], // Deepgramからの文字起こし結果を翻訳
                source_lang: 'EN', // 翻訳元の言語コード
                target_lang: 'JA', // 翻訳先の言語コード
            }),
        });
        const translatedResponse: TranslateResponse = await res.json(); 
        if (!translatedResponse.translations || translatedResponse.translations.length === 0) {
            translationResult = undefined;
        } else {
            translationResult = translatedResponse.translations[0].text;
        }

        await c.env.TRANSCRIPTION_BUCKET.put(
            `translations/${channelTitle}_${episodeTitle}.text`,
            new TextEncoder().encode(translationResult),
            {
                httpMetadata: {
                    contentType: 'text/plain',
                }
            }
        );

        return c.json({ 
            transcription: {
                original: transcriptionResult,
                segments : segmentsResult,
                translation: translationResult
            }
        })
    } catch (error: any) {
        console.error("Error during transcription:", error);
        return c.json({ error: "Transcription failed", details: error.stack }, 500);
    }
});

app.post('/transcribe', zValidator('json', episodeSchema), async (c) => {
    const { episode, channel } = await c.req.json();
    const audioUrl = episode.audioUrl;
    const episodeTitle = episode.title;
    const channelTitle = channel.title;

    try {
        let transcriptionResult: string;
        let segmentsResult: any[] | undefined;
        let translationResult: string;

        const preSavedTranscription = await c.env.TRANSCRIPTION_BUCKET.get(
            `transcriptions/${channelTitle}_${episodeTitle}.txt`
        );
        const preSavedTranscriptionSegments = await c.env.TRANSCRIPTION_BUCKET.get(
            `transcriptions_segments/${channelTitle}_${episodeTitle}_segments.json`
        );
        if (preSavedTranscription && preSavedTranscriptionSegments) {
            transcriptionResult = await preSavedTranscription.text();
            segmentsResult = JSON.parse(await preSavedTranscriptionSegments.text());
        } else {
            // Deepgram API へリクエスト
            const deepgramClient = createClient (c.env.DEEPGRAM_API_KEY);
            const {result, error} = await deepgramClient.listen.prerecorded.transcribeUrl(
            {
                url: audioUrl,
            },
            {
                model: "nova",
                paragraphs: true,
                diarize: true
            }
            );
            if (error) {
                return c.json({ error: "Deepgram API error", details: error }, 500);
            }

            transcriptionResult = await result.results.channels[0].alternatives[0].transcript
            segmentsResult = await result.results.channels[0].alternatives[0].paragraphs?.paragraphs.flatMap(p => p.sentences)

            await c.env.TRANSCRIPTION_BUCKET.put(
                `transcriptions/${channelTitle}_${episodeTitle}.txt`,
                new TextEncoder().encode(transcriptionResult),
                {
                    httpMetadata: {
                        contentType: 'text/plain',
                    }
                }
            );
            await c.env.TRANSCRIPTION_BUCKET.put(
                `transcriptions_segments/${channelTitle}_${episodeTitle}_segments.json`,
                JSON.stringify(segmentsResult),
                {
                    httpMetadata: {
                        contentType: 'application/json',
                    }
                }
            );
        }

        const preSavedTranslation = await c.env.TRANSCRIPTION_BUCKET.get(
            `translations/${channelTitle}_${episodeTitle}.text`
        );
        if (preSavedTranslation) {
            translationResult = await preSavedTranslation.text();
        } else {
            const res = await fetch(`https://api-free.deepl.com/v2/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `DeepL-Auth-Key ${c.env.DEEPL_API_KEY}`,
                },
                body: JSON.stringify({
                    text: [transcriptionResult], // Deepgramからの文字起こし結果を翻訳
                    source_lang: 'EN', // 翻訳元の言語コード
                    target_lang: 'JA', // 翻訳先の言語コード
                }),
            });
            const translatedResponse: TranslateResponse = await res.json(); 
            if (!translatedResponse.translations || translatedResponse.translations.length === 0) {
                return c.json({ error: "Translation failed" }, 500);
            }
            translationResult = translatedResponse.translations[0].text;

            await c.env.TRANSCRIPTION_BUCKET.put(
                `translations/${channelTitle}_${episodeTitle}.text`,
                new TextEncoder().encode(translationResult),
                {
                    httpMetadata: {
                        contentType: 'text/plain',
                    }
                }
            );
        }

        return c.json({ 
            transcription: {
                original: transcriptionResult,
                segments : segmentsResult,
                translation: translationResult
            }
        })
    } catch (error: any) {
        console.error("Error during transcription:", error);
        return c.json({ error: "Transcription failed", details: error.stack }, 500);
    }
});

app.get('/channel-list', async (c) => {
    const result = await c.env.DB.prepare('SELECT * FROM podcasts ORDER BY rowid DESC').all();
    if (!result.results || result.results.length === 0)
        return c.json({})
    try {
        const channelList = result.results.map((row) => ({
            id: row.rowid,
            rss_url: row.rss_url,
            title: row.title,
            image_url: row.image_url,
            description: row.description,
        }));
        //const rssList = c.env.RSS_LINKS ?? [];
        return c.json({ channelList });
    } catch (error: any) {
        console.error("Error fetching RSS list:", error);
        return c.json({ error: "Failed to fetch RSS list", details: error.stack }, 500);
    }
});

// URL バリデーション用
const newRssSchema = z.object({
	newRssUrl: z.string().url(),
})
app.post('/channel-register', async (c) => {
    const body = await c.req.json()

    const parsed = newRssSchema.safeParse(body)
    if (!parsed.success) {
        return c.json({ error: 'Invalid request body' }, 400)
    }
    
    const rss_url = parsed.data.newRssUrl

    try {
        const feed = await fetchAndParseRSS(rss_url);
        if (!feed.rss.channel.item || feed.rss.channel.item.length === 0) {
            return c.json({ error: "No items found in RSS feed" }, 400);
        }

        const title = feed.rss.channel.title;
        const description = feed.rss.channel.description || '';
        const imageUrl = feed.rss.channel.image?.url || feed.rss.channel['itunes:image']?.['@_href'] || '';

        await c.env.DB.prepare(
            `INSERT INTO podcasts (rss_url, title, image_url, description) VALUES (?, ?, ?, ?)`
        ).bind(rss_url, title, imageUrl, description).run()
    
        return c.json({ message: 'Podcast registered' }, 201)
    } catch (error: any) {
        console.error("Error during podcast registration:", error);
        return c.json({ error: "Registration failed", details: error.stack }, 500);
    }
})

// URL バリデーション用
app.post('/channel-delete', async (c) => {
    const { delRssId } = await c.req.json();

    try {
        await c.env.DB.prepare(
            `DELETE FROM podcasts WHERE rowid = ${delRssId}`
        ).run()
    
        return c.json({ message: 'Podcast deleted' }, 201)
    } catch (error: any) {
        console.error("Error during podcast registration:", error);
        return c.json({ error: "Delete failed", details: error.stack }, 500);
    }
})

export default app
