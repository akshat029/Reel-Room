import { Router, Request, Response } from 'express';
import { store } from '../store.js';
import { config } from '../config.js';
import { isValidInstagramUrl, type OEmbedResponse } from '@reelroom/shared';

export const oembedRoutes = Router();

// Fetch oEmbed for Instagram URL
oembedRoutes.post('/', async (req: Request<{}, {}, { url: string }>, res: Response) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: { code: 'MISSING_URL', message: 'URL is required' },
            });
        }

        if (!isValidInstagramUrl(url)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_URL',
                    message: 'Invalid Instagram Reel URL. Expected format: https://www.instagram.com/reel/XXXX or https://www.instagram.com/p/XXXX'
                },
            });
        }

        // Check cache first
        const cached = store.getCachedOEmbed(url);
        if (cached) {
            return res.json({
                success: true,
                data: { html: cached, cached: true },
            });
        }

        // Fetch from Instagram oEmbed API
        // Note: Instagram's oEmbed API is public and doesn't require authentication for public posts
        const oembedUrl = new URL(config.instagramOembedUrl);
        oembedUrl.searchParams.set('url', url);
        oembedUrl.searchParams.set('omitscript', 'false');
        oembedUrl.searchParams.set('hidecaption', 'false');

        try {
            const response = await fetch(oembedUrl.toString());

            if (!response.ok) {
                // If Meta API fails, try alternative oEmbed
                const altResponse = await fetch(`https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`);

                if (!altResponse.ok) {
                    return res.status(404).json({
                        success: false,
                        error: {
                            code: 'OEMBED_FAILED',
                            message: 'Unable to fetch embed. This Reel may be private, unavailable, or Instagram oEmbed is not responding. Try screen-share mode instead.'
                        },
                    });
                }

                const altData = await altResponse.json() as OEmbedResponse;
                store.cacheOEmbed(url, altData.html);

                return res.json({
                    success: true,
                    data: {
                        html: altData.html,
                        thumbnail: altData.thumbnail_url,
                        title: altData.title,
                        author: altData.author_name,
                        cached: false
                    },
                });
            }

            const data = await response.json() as OEmbedResponse;

            // Cache the response
            store.cacheOEmbed(url, data.html);

            res.json({
                success: true,
                data: {
                    html: data.html,
                    thumbnail: data.thumbnail_url,
                    title: data.title,
                    author: data.author_name,
                    cached: false
                },
            });
        } catch (fetchError) {
            console.error('oEmbed fetch error:', fetchError);

            // Provide fallback with iframe approach
            const reelId = url.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/)?.[2];
            if (reelId) {
                const fallbackHtml = `<iframe src="https://www.instagram.com/reel/${reelId}/embed/" width="400" height="480" frameborder="0" scrolling="no" allowtransparency="true" allowfullscreen="true"></iframe>`;
                store.cacheOEmbed(url, fallbackHtml);

                return res.json({
                    success: true,
                    data: { html: fallbackHtml, fallback: true, cached: false },
                });
            }

            return res.status(503).json({
                success: false,
                error: {
                    code: 'OEMBED_UNAVAILABLE',
                    message: 'Instagram oEmbed service is temporarily unavailable. Please try screen-share mode.'
                },
            });
        }
    } catch (error) {
        console.error('oEmbed route error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'OEMBED_ERROR', message: 'Failed to fetch embed' },
        });
    }
});
