/**
 * 部署設定。
 *
 * 這兩個值都不是機密：
 * - LIFF_ID 本來就會出現在網址列。
 * - API_URL 受後端的 ID Token 驗證保護，沒有有效憑證什麼都拿不到。
 * 真正的機密（Channel Secret、推播 Token）只放在 Apps Script 的指令碼屬性。
 */
const CONFIG = {
  // LINE Developers → LINE Login channel → LIFF → LIFF ID
  LIFF_ID: '2010854195-TVruYdxE',

  // Apps Script → 部署 → 網頁應用程式網址（結尾為 /exec）
  API_URL: 'https://script.google.com/macros/s/AKfycbwauEntIC0hSlujuO5XS9Sa0fDkls3evBWbohMzdA2y-KZ_tsCpBX-oBOZ82dklk_E/exec',
};
