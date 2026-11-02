class HttpError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code, ...err.extra });
  }
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    return res.status(400).json({ error: 'bad_request' });
  }
  if (err?.code === 'P2025') return res.status(404).json({ error: 'not_found' });
  if (err?.code === 'P2002') return res.status(409).json({ error: 'duplicate' });
  if (err?.code === 'P2003') return res.status(409).json({ error: 'in_use' });
  console.error('[api]', req.method, req.originalUrl, err);
  res.status(500).json({ error: 'server_error' });
}

module.exports = { HttpError, asyncHandler, errorHandler };
