require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

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
app.use(morgan('dev'));
app.use(express.json());
app.use(globalLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

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

module.exports = app;
