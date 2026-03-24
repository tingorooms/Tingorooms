const axios = require('axios');

const getLogDrainConfig = () => {
    const enabled = process.env.ENABLE_LOG_DRAIN === 'true';
    const sourceToken = process.env.LOGTAIL_SOURCE_TOKEN || process.env.BETTER_STACK_SOURCE_TOKEN || '';
    const ingestUrl = process.env.LOGTAIL_INGEST_URL || 'https://in.logs.betterstack.com';

    return {
        enabled: enabled && Boolean(sourceToken),
        sourceToken,
        ingestUrl,
    };
};

const pushLog = async (entry) => {
    const { enabled, sourceToken, ingestUrl } = getLogDrainConfig();
    if (!enabled) return;

    try {
        await axios.post(
            ingestUrl,
            {
                dt: new Date().toISOString(),
                level: entry.level || 'info',
                ...entry,
            },
            {
                timeout: 5000,
                headers: {
                    Authorization: `Bearer ${sourceToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
    } catch (err) {
        // Never break request flow because of remote logging failures
        if (process.env.NODE_ENV !== 'production') {
            console.warn('Log drain push failed:', err.message);
        }
    }
};

module.exports = { pushLog };
