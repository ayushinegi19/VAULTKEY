require('dotenv').config();

const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');
const logger = require('./src/config/logger');
const identitiesRouter = require('./src/routes/identities');
const authRouter = require('./src/routes/auth');
const secretsRouter = require('./src/routes/secrets');
const policiesRouter = require('./src/routes/policies');
const auditRouter = require('./src/routes/audit');
const { errorHandler } = require('./src/middleware/errorHandler');
const { globalLimiter } = require('./src/middleware/rateLimit');

const app = express();

app.use(helmet());
app.use(cors());
app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(globalLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Interactive API docs + "try it out" testing UI at /api-docs.
// Click "Authorize" and paste an accessToken from /api/auth/login
// (no need to type "Bearer " — the UI adds that automatically).
const openapiSpec = YAML.load(path.join(__dirname, 'src/docs/openapi.yaml'));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.use('/api/identities', identitiesRouter);
app.use('/api/auth', authRouter);
app.use('/api/secrets', secretsRouter);
app.use('/api/policies', policiesRouter);
app.use('/api/audit', auditRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`VaultKey listening on port ${PORT}`);
  });
}

app.use(pinoHttp({ logger }));
const allowedOrigin = process.env.CORS_ORIGIN || '*';
const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));
module.exports = app;
