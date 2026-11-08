const {
  parseOrderListQuery,
  buildPagination,
  OrderListQueryError
} = require('../src/utils/orderListQuery');

describe('訂單列表查詢參數', () => {
  describe('預設值', () => {
    it('不帶參數時為第 1 頁、每頁 10 筆、不篩選狀態', () => {
      expect(parseOrderListQuery({})).toEqual({ status: null, page: 1, limit: 10 });
      expect(parseOrderListQuery()).toEqual({ status: null, page: 1, limit: 10 });
    });
  });

  describe('status', () => {
    it.each(['pending', 'paid', 'failed'])('接受 %s', (status) => {
      expect(parseOrderListQuery({ status }).status).toBe(status);
    });

    it.each([
      ['不在允許值內', 'unknown'],
      ['大小寫不符', 'PAID'],
      ['空字串', ''],
      ['重複參數（陣列）', ['paid', 'pending']]
    ])('%s 時拋出錯誤', (_label, status) => {
      expect(() => parseOrderListQuery({ status })).toThrow(OrderListQueryError);
    });
  });

  describe('page 與 limit', () => {
    it('接受正整數字串', () => {
      expect(parseOrderListQuery({ page: '3', limit: '5' })).toEqual({ status: null, page: 3, limit: 5 });
    });

    it.each([
      ['剛好 50', '50', 50],
      ['超過 50 以 50 計', '100', 50],
      ['最小值 1', '1', 1]
    ])('limit %s', (_label, limit, expected) => {
      expect(parseOrderListQuery({ limit }).limit).toBe(expected);
    });

    it.each([
      ['0', '0'],
      ['負數', '-1'],
      ['小數', '1.5'],
      ['夾雜文字', '3abc'],
      ['空字串', ''],
      ['重複參數（陣列）', ['1', '2']]
    ])('page 為 %s 時拋出錯誤', (_label, page) => {
      expect(() => parseOrderListQuery({ page })).toThrow(OrderListQueryError);
    });

    it.each([
      ['0', '0'],
      ['負數', '-1'],
      ['小數', '2.5'],
      ['夾雜文字', '10abc']
    ])('limit 為 %s 時拋出錯誤', (_label, limit) => {
      expect(() => parseOrderListQuery({ limit })).toThrow(OrderListQueryError);
    });
  });

  describe('buildPagination', () => {
    it.each([
      [{ page: 1, limit: 10, total: 0 }, 0],
      [{ page: 1, limit: 10, total: 10 }, 1],
      [{ page: 3, limit: 5, total: 12 }, 3],
      [{ page: 1, limit: 50, total: 51 }, 2]
    ])('%o 的 totalPages 為 %i', (input, totalPages) => {
      expect(buildPagination(input)).toEqual({ ...input, totalPages });
    });
  });
});
