# YouTube original metadata collector

Python standard library; original titles, descriptions, channel information, dates, video links and API viewCount only. No comments, downloads, dish/restaurant extraction, mention counts, quality or popularity scores. This does not add SuggestDish restaurant menus.

Set YOUTUBE_API_KEY in the runtime running Python, never in source code or GitHub. Vercel Production environment variables are only available inside a new Vercel deployment; they do not transfer to a local Python process. Current connector exposes metadata but not the sensitive key value. No live collection has been validated.

Run from repository root: `python3 scripts/collect-youtube-metadata.py --output youtube-temporary`. Default three Mumbai queries, one search page per query, up to ten results each; one deduplicated videos.list details request. regionCode=IN means videos viewable in India, not verified Mumbai locations. Optional `--geotagged-only` restricts to videos with supplied geotags within a 35 km circle of Mumbai's reference center; this is not the administrative boundary and can exclude many useful videos.

Store output outside git. Cache reused for less than one day, metadata carries 30-day expiry, stale cache is removed on each run. Run `python3 scripts/collect-youtube-metadata.py --output youtube-temporary --purge-only` regularly, including when collection stops; delete/refresh every exported copy within 30 days. Do not save API responses in GitHub history, permanent source batches or backups. Purge does not require a key. No scheduled job has been configured by this change.

Tests: `python3 scripts/test_youtube_metadata.py`. Original YouTube API data remains subject to YouTube terms, not ODbL/CC0. Source: https://developers.google.com/youtube/terms/developer-policies . Do not feed these metadata files into dish ranking or recommendations.
