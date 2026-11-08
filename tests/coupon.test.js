const { applyCoupon, CouponError, COUPON_ERRORS } = require('../src/utils/coupon');

function expectCouponError(fn, code) {
  let error;
  try {
    fn();
  } catch (err) {
    error = err;
  }
  expect(error).toBeInstanceOf(CouponError);
  expect(error.code).toBe(code);
  expect(typeof error.message).toBe('string');
}

describe('Coupon 模組', () => {
  describe('未使用優惠碼', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['空字串', ''],
      ['只有空白', '   ']
    ])('%s 視為未使用，折扣為 0', (_label, code) => {
      expect(applyCoupon({ code, subtotal: 1000 })).toEqual({
        couponCode: null,
        discount: 0,
        discountedSubtotal: 1000
      });
    });
  });

  describe('FLOWER100：滿 800 折 100', () => {
    it('小計剛好 800 元可使用', () => {
      expect(applyCoupon({ code: 'FLOWER100', subtotal: 800 })).toEqual({
        couponCode: 'FLOWER100',
        discount: 100,
        discountedSubtotal: 700
      });
    });

    it('小計 799 元未達門檻', () => {
      expectCouponError(() => applyCoupon({ code: 'FLOWER100', subtotal: 799 }), COUPON_ERRORS.NOT_APPLICABLE);
    });

    it('不分大小寫，並以大寫記錄', () => {
      expect(applyCoupon({ code: ' flower100 ', subtotal: 1600 })).toMatchObject({
        couponCode: 'FLOWER100',
        discount: 100,
        discountedSubtotal: 1500
      });
    });
  });

  describe('SPRING10：打 9 折，最多折 300', () => {
    it.each([
      [1000, 100],
      [1234, 123],
      [1235, 124],
      [3000, 300],
      [3500, 300],
      [1, 0]
    ])('小計 %i 元折抵 %i 元（四捨五入、上限 300）', (subtotal, discount) => {
      expect(applyCoupon({ code: 'spring10', subtotal })).toEqual({
        couponCode: 'SPRING10',
        discount,
        discountedSubtotal: subtotal - discount
      });
    });
  });

  describe('無法使用的優惠碼', () => {
    it('SUMMER50 已失效', () => {
      expectCouponError(() => applyCoupon({ code: 'SUMMER50', subtotal: 5000 }), COUPON_ERRORS.EXPIRED);
    });

    it.each([
      ['不存在的代碼', 'NOT-A-COUPON'],
      ['原型鏈屬性', 'toString'],
      ['原型鏈屬性（大寫）', '__PROTO__']
    ])('%s 為無效優惠碼', (_label, code) => {
      expectCouponError(() => applyCoupon({ code, subtotal: 1000 }), COUPON_ERRORS.INVALID);
    });

    it.each([
      ['數字', 100],
      ['布林', true],
      ['陣列', ['FLOWER100']],
      ['物件', { code: 'FLOWER100' }]
    ])('非字串（%s）為無效優惠碼', (_label, code) => {
      expectCouponError(() => applyCoupon({ code, subtotal: 1000 }), COUPON_ERRORS.INVALID);
    });
  });

  describe('subtotal 驗證', () => {
    it.each([[-1], [1.5], ['1000'], [NaN]])('subtotal 為 %p 時拋出 TypeError', (subtotal) => {
      expect(() => applyCoupon({ code: 'FLOWER100', subtotal })).toThrow(TypeError);
    });
  });
});
