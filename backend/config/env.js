const knownProductionMarkers = [
    'RAILWAY_ENVIRONMENT',
    'RAILWAY_ENV',
    'RAILWAY_STATIC_URL',
    'RAILWAY_SERVICE_NAME',
    'RAILWAY_PROJECT_NAME',
    'RAILWAY_DATABASE_URL'
];

const rawNodeEnv = String(process.env.NODE_ENV || '').trim();
const isRailwayRuntime = knownProductionMarkers.some((name) => Boolean(process.env[name]));
const nodeEnv = rawNodeEnv || (isRailwayRuntime ? 'production' : 'development');
const isProduction = nodeEnv === 'production';

if (!rawNodeEnv && isRailwayRuntime) {
    process.env.NODE_ENV = 'production';
    console.warn('⚠️  Railway runtime detected without NODE_ENV. Defaulting NODE_ENV=production.');
}

module.exports = {
    nodeEnv,
    isProduction,
    isRailwayRuntime
};
