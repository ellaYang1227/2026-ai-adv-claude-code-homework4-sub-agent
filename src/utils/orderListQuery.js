// Query-string rules for the member order list (GET /api/orders).
// Stateless: routes pass req.query and receive validated filters.

const { parsePositiveInteger } = require('./validators');

const ORDER_STATUSES = Object.freeze(['pending', 'paid', 'failed']);

const ORDER_LIST_DEFAULTS = Object.freeze({
  PAGE: 1,
  LIMIT: 10,
  MAX_LIMIT: 50
});

class OrderListQueryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OrderListQueryError';
  }
}

function parsePositiveIntegerParam(value, name, fallback) {
  if (value === undefined) return fallback;
  const parsed = parsePositiveInteger(value);
  if (parsed === null) {
    throw new OrderListQueryError(`${name} 必須為正整數`);
  }
  return parsed;
}

/**
 * Validate `status`, `page` and `limit` from a query object.
 * Missing values fall back to defaults; `limit` above the maximum is capped.
 * Present but invalid values (including empty strings and repeated params)
 * throw OrderListQueryError.
 */
function parseOrderListQuery(query = {}) {
  const { status } = query;
  if (status !== undefined && !ORDER_STATUSES.includes(status)) {
    throw new OrderListQueryError(`status 必須為 ${ORDER_STATUSES.join('、')} 其中之一`);
  }

  const page = parsePositiveIntegerParam(query.page, 'page', ORDER_LIST_DEFAULTS.PAGE);
  const limit = Math.min(
    parsePositiveIntegerParam(query.limit, 'limit', ORDER_LIST_DEFAULTS.LIMIT),
    ORDER_LIST_DEFAULTS.MAX_LIMIT
  );

  return Object.freeze({ status: status ?? null, page, limit });
}

function buildPagination({ page, limit, total }) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

module.exports = {
  ORDER_STATUSES,
  ORDER_LIST_DEFAULTS,
  OrderListQueryError,
  parseOrderListQuery,
  buildPagination
};
