'use strict';

function code(error) {
  const value = error?.status ?? error?.code ?? error?.name;
  if (Number.isInteger(value) && value >= 100 && value <= 599) return String(value);
  if (typeof value === 'string' && /^[a-z0-9_.-]{1,64}$/i.test(value)) return value;
  return 'unexpected_error';
}

function log(scope, error, logger = console.error) {
  logger(scope, { code: code(error) });
}

module.exports = { code, log };
