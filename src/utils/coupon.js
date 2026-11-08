// Checkout coupon rules. Stateless: callers pass the trusted item subtotal
// and receive the discount; persistence and HTTP responses stay in routes.

const COUPON_TYPES = Object.freeze({
  FIXED: 'fixed',
  PERCENT: 'percent'
});

const COUPONS = Object.freeze({
  FLOWER100: Object.freeze({ type: COUPON_TYPES.FIXED, amount: 100, minSubtotal: 800, active: true }),
  SPRING10: Object.freeze({ type: COUPON_TYPES.PERCENT, percentOff: 10, maxDiscount: 300, minSubtotal: 0, active: true }),
  SUMMER50: Object.freeze({ type: COUPON_TYPES.FIXED, amount: 50, minSubtotal: 0, active: false })
});

const COUPON_ERRORS = Object.freeze({
  INVALID: 'INVALID_COUPON',
  EXPIRED: 'COUPON_EXPIRED',
  NOT_APPLICABLE: 'COUPON_NOT_APPLICABLE'
});

class CouponError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CouponError';
    this.code = code;
  }
}

function normalizeCouponCode(code) {
  return code.trim().toUpperCase();
}

function calculateDiscount(coupon, subtotal) {
  const raw = coupon.type === COUPON_TYPES.PERCENT
    ? Math.round((subtotal * coupon.percentOff) / 100)
    : coupon.amount;
  const capped = coupon.maxDiscount === undefined ? raw : Math.min(raw, coupon.maxDiscount);
  // A discount can never make the item subtotal negative
  return Math.min(capped, subtotal);
}

/**
 * Apply an optional coupon code to an integer item subtotal.
 * Codes are case-insensitive; an empty or missing code means no coupon.
 * Throws CouponError for unknown, expired or not-yet-applicable codes.
 */
function applyCoupon({ code, subtotal }) {
  if (!Number.isInteger(subtotal) || subtotal < 0) {
    throw new TypeError('subtotal 必須為非負整數');
  }

  if (code === undefined || code === null || (typeof code === 'string' && code.trim() === '')) {
    return Object.freeze({ couponCode: null, discount: 0, discountedSubtotal: subtotal });
  }

  if (typeof code !== 'string') {
    throw new CouponError(COUPON_ERRORS.INVALID, '優惠碼格式不正確');
  }

  const couponCode = normalizeCouponCode(code);
  const coupon = Object.prototype.hasOwnProperty.call(COUPONS, couponCode) ? COUPONS[couponCode] : null;

  if (!coupon) {
    throw new CouponError(COUPON_ERRORS.INVALID, '優惠碼無效');
  }

  if (!coupon.active) {
    throw new CouponError(COUPON_ERRORS.EXPIRED, '優惠碼已失效');
  }

  if (subtotal < coupon.minSubtotal) {
    throw new CouponError(
      COUPON_ERRORS.NOT_APPLICABLE,
      `商品小計未達 ${coupon.minSubtotal.toLocaleString('en-US')} 元，無法使用此優惠碼`
    );
  }

  const discount = calculateDiscount(coupon, subtotal);

  return Object.freeze({ couponCode, discount, discountedSubtotal: subtotal - discount });
}

module.exports = {
  COUPONS,
  COUPON_ERRORS,
  CouponError,
  applyCoupon
};
