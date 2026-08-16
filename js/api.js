/**
 * 後端呼叫封裝。
 */
const API = {
  /**
   * 所有請求都是 POST，body 為 JSON 字串。
   *
   * Content-Type 刻意用 text/plain：這樣瀏覽器視為「簡單請求」，不會發出
   * CORS 預檢（OPTIONS）。Apps Script Web App 不回應預檢，改用 application/json
   * 會直接失敗。後端收到後自己 JSON.parse。
   */
  async call(action, params) {
    if (!CONFIG.API_URL || CONFIG.API_URL.indexOf('請填入') === 0) {
      throw new Error('尚未設定 API_URL，請編輯 js/config.js');
    }

    const body = Object.assign({ action, idToken: liff.getIDToken() }, params || {});

    let resp;
    try {
      resp = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow',
      });
    } catch (e) {
      throw new Error('無法連線到後端，請確認網路狀況與 API_URL 設定');
    }

    const text = await resp.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      // Apps Script 未授權或部署設定錯誤時會回傳 HTML 錯誤頁而不是 JSON
      throw new Error('後端回應格式錯誤，請確認 Apps Script 已部署為「任何人皆可存取」');
    }

    if (!result.ok) {
      const err = new Error(result.error || '未知錯誤');
      err.code = result.code;
      throw err;
    }
    return result.data;
  },

  whoami() { return API.call('whoami'); },
  bootstrap() { return API.call('bootstrap'); },
  lookupPlate(plate) { return API.call('lookupPlate', { plate }); },
  createRecord(payload) { return API.call('createRecord', { payload }); },
  searchVehicles(keyword) { return API.call('searchVehicles', { keyword }); },
  getVehicleHistory(vehicleId) { return API.call('getVehicleHistory', { vehicleId }); },
};
