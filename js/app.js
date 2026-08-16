/**
 * 主程式：登入流程、頁面切換、表單邏輯。
 */
(function () {
  'use strict';

  const state = {
    user: null,
    masters: { brands: [], items: [] },
    category: '',
    known: null,      // 車牌查到的既有車輛
    lastSubmit: null, // 供「再新增一筆」沿用
  };

  const $ = (id) => document.getElementById(id);
  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');

  function showView(id) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    $(id).classList.add('active');
  }

  function toast(msg, isError) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast' + (isError ? ' error' : '');
    setTimeout(() => t.classList.add('hidden'), 3200);
  }

  function fail(msg) {
    $('error-message').textContent = msg;
    showView('view-error');
  }

  // ── 啟動 ──────────────────────────────────────────────
  async function init() {
    if (!CONFIG.LIFF_ID || CONFIG.LIFF_ID.indexOf('請填入') === 0) {
      return fail('尚未設定 LIFF_ID，請編輯 js/config.js');
    }

    try {
      await liff.init({ liffId: CONFIG.LIFF_ID });
    } catch (e) {
      return fail('LIFF 初始化失敗：' + e.message);
    }

    // 電腦瀏覽器開啟時尚未登入，導去 LINE Login 再導回來。
    // 手機在 LINE App 內開啟則已帶有身分，不會走到這裡。
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: location.href });
      return;
    }

    try {
      const who = await API.whoami();
      if (!who.authorized) {
        $('denied-userid').textContent = who.userId;
        return showView('view-denied');
      }

      const boot = await API.bootstrap();
      state.user = boot.user;
      state.masters = boot.masters;
      $('user-name').textContent = boot.user.name || '';
      $('f-date').value = boot.today;

      bindEvents();
      showView('view-main');
    } catch (e) {
      fail(e.message);
    }
  }

  // ── 事件綁定 ──────────────────────────────────────────
  function bindEvents() {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        $(btn.dataset.page).classList.add('active');
      });
    });

    // 車牌離開輸入框才查詢：邊打邊查會在每個字元都打一次後端
    $('f-plate').addEventListener('blur', onPlateBlur);

    document.querySelectorAll('#category-group .choice').forEach((btn) => {
      btn.addEventListener('click', () => selectCategory(btn.dataset.value));
    });

    $('f-item').addEventListener('change', () => {
      $('wrap-item-other').classList.toggle('hidden', $('f-item').value !== '__other__');
    });

    $('f-payment').addEventListener('change', () => {
      $('wrap-paid').classList.toggle('hidden', $('f-payment').value !== '收訂金');
    });

    $('form-record').addEventListener('submit', onSubmit);
    $('btn-add-another').addEventListener('click', () => resetForm(true));
    $('btn-new-blank').addEventListener('click', () => resetForm(false));

    $('btn-search').addEventListener('click', doSearch);
    $('f-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

    $('btn-relogin').addEventListener('click', () => { liff.logout(); location.reload(); });
    $('btn-copy-userid').addEventListener('click', () => {
      navigator.clipboard.writeText($('denied-userid').textContent)
        .then(() => toast('已複製'))
        .catch(() => toast('複製失敗，請手動選取', true));
    });
  }

  // ── 車牌查詢 ──────────────────────────────────────────
  async function onPlateBlur() {
    const plate = $('f-plate').value.trim();
    if (!plate) return;

    $('plate-status').textContent = '查詢中…';
    try {
      const r = await API.lookupPlate(plate);
      if (r.found) {
        state.known = r;
        $('plate-status').textContent = '';
        $('known-model').textContent = r.vehicle.model || '—';
        $('known-color').textContent = r.vehicle.color || '—';
        $('known-owner').textContent = r.customer
          ? r.customer.name + (r.customer.phone ? '（' + r.customer.phone + '）' : '')
          : '—';
        $('known-last').textContent = r.lastRecord
          ? r.lastRecord.date + '　' + r.lastRecord.item + (r.lastRecord.brand ? '／' + r.lastRecord.brand : '')
          : '無紀錄';
        show($('vehicle-known'));
        hide($('vehicle-new'));
      } else {
        state.known = null;
        $('plate-status').textContent = '';
        hide($('vehicle-known'));
        show($('vehicle-new'));
      }
    } catch (e) {
      $('plate-status').textContent = '查詢失敗：' + e.message;
    }
  }

  // ── 業務類別 ──────────────────────────────────────────
  function selectCategory(value) {
    state.category = value;
    document.querySelectorAll('#category-group .choice').forEach((b) => {
      b.classList.toggle('selected', b.dataset.value === value);
    });

    $('fs-item').disabled = false;

    // 品項依業務類別過濾
    const sel = $('f-item');
    sel.innerHTML = '<option value="">請選擇</option>';
    const items = state.masters.items.filter((i) => i.category === value);
    items.forEach((i) => {
      const o = document.createElement('option');
      o.value = i.name;
      o.textContent = i.name;
      sel.appendChild(o);
    });
    const other = document.createElement('option');
    other.value = '__other__';
    other.textContent = '其他（自行輸入）';
    sel.appendChild(other);

    if (!items.length) {
      $('wrap-item-other').classList.remove('hidden');
      sel.value = '__other__';
    } else {
      $('wrap-item-other').classList.add('hidden');
    }

    // 品牌與保固只在車體包膜出現；打蠟鍍膜不記品牌
    const isWrap = value === '車體包膜';
    $('wrap-brand').classList.toggle('hidden', !isWrap);
    $('wrap-warranty').classList.toggle('hidden', !isWrap);
    $('f-warranty').required = isWrap;

    if (isWrap) {
      const bsel = $('f-brand');
      bsel.innerHTML = '<option value="">—</option>';
      state.masters.brands
        .filter((b) => b.categories.indexOf(value) >= 0)
        .forEach((b) => {
          const o = document.createElement('option');
          o.value = b.name;
          o.textContent = b.name;
          bsel.appendChild(o);
        });
    }
  }

  // ── 送出 ──────────────────────────────────────────────
  async function onSubmit(e) {
    e.preventDefault();
    const btn = $('btn-submit');

    if (!state.category) return toast('請選擇業務類別', true);

    const itemValue = $('f-item').value;
    if (!itemValue) return toast('請選擇施工品項', true);
    if (itemValue === '__other__' && !$('f-item-other').value.trim()) {
      return toast('請輸入品項說明', true);
    }
    if (!state.known && !$('f-owner').value.trim()) {
      return toast('這是新車牌，請填寫車主姓名', true);
    }

    const payload = {
      plate: $('f-plate').value.trim(),
      date: $('f-date').value,
      category: state.category,
      item: itemValue === '__other__' ? '其他' : itemValue,
      itemOther: itemValue === '__other__' ? $('f-item-other').value.trim() : '',
      brand: state.category === '車體包膜' ? $('f-brand').value : '',
      warrantyYears: state.category === '車體包膜' ? $('f-warranty').value : '',
      amount: $('f-amount').value,
      paymentStatus: $('f-payment').value,
      paidAmount: $('f-payment').value === '收訂金' ? $('f-paid').value : '',
      feedback: $('f-feedback').value.trim(),
      orderNo: state.reuseOrderNo || '',
      vehicle: { model: $('f-model').value.trim(), color: $('f-color').value.trim() },
      customer: {
        name: $('f-owner').value.trim(),
        phone: $('f-phone').value.trim(),
        birthday: $('f-birthday').value,
        source: $('f-source').value,
      },
    };

    // 網路慢時老闆會連按，這裡先鎖住；後端另有 LockService 把關
    btn.disabled = true;
    btn.textContent = '送出中…';
    try {
      const r = await API.createRecord(payload);
      state.lastSubmit = { plate: payload.plate, date: payload.date, orderNo: r.orderNo };

      let detail = '單號 ' + r.orderNo;
      if (r.warrantyExpiry) detail += '　保固至 ' + r.warrantyExpiry;
      if (r.createdVehicle) detail += '　（已建立新車輛）';
      $('success-detail').textContent = detail;

      hide($('form-record'));
      show($('submit-success'));
      window.scrollTo(0, 0);
    } catch (e) {
      toast(e.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = '送出';
    }
  }

  /**
   * reuseVehicle=true：沿用同車輛與同日期，處理「一次進廠做兩個品項」。
   * 這種情況不常見，所以不做複選 UI，用按鈕沿用即可（見資料表設計 9.1）。
   */
  function resetForm(reuseVehicle) {
    const form = $('form-record');
    const keepPlate = state.lastSubmit ? state.lastSubmit.plate : '';
    const keepDate = state.lastSubmit ? state.lastSubmit.date : '';

    form.reset();
    state.category = '';
    state.reuseOrderNo = reuseVehicle && state.lastSubmit ? state.lastSubmit.orderNo : '';
    document.querySelectorAll('#category-group .choice').forEach((b) => b.classList.remove('selected'));
    $('fs-item').disabled = true;
    $('f-item').innerHTML = '<option value="">請先選擇業務類別</option>';
    hide($('wrap-brand')); hide($('wrap-warranty'));
    hide($('wrap-paid')); hide($('wrap-item-other'));
    hide($('submit-success'));
    show(form);

    if (reuseVehicle) {
      $('f-plate').value = keepPlate;
      $('f-date').value = keepDate;
      onPlateBlur();
    } else {
      state.known = null;
      hide($('vehicle-known'));
      hide($('vehicle-new'));
      $('f-date').value = keepDate || new Date().toISOString().slice(0, 10);
    }
    window.scrollTo(0, 0);
  }

  // ── 查詢 ──────────────────────────────────────────────
  async function doSearch() {
    const kw = $('f-search').value.trim();
    if (!kw) return;

    const box = $('search-results');
    box.innerHTML = '<p class="muted">搜尋中…</p>';
    $('vehicle-detail').innerHTML = '';

    try {
      const list = await API.searchVehicles(kw);
      if (!list.length) {
        box.innerHTML = '<p class="muted">查無資料。</p>';
        return;
      }
      box.innerHTML = list.map((v) => `
        <div class="result-card" data-id="${v.vehicleId}">
          <div class="result-main">
            <b class="plate">${esc(v.plate)}</b>
            <span class="muted">${esc(v.model || '')} ${esc(v.color || '')}</span>
          </div>
          <div class="result-sub">
            <span>${esc(v.customerName)}</span>
            <span class="muted">${esc(v.customerPhone)}</span>
            <span class="muted">最近施工 ${esc(v.lastServiceDate || '—')}</span>
          </div>
          ${v.status === '已轉手' ? '<span class="tag">已轉手</span>' : ''}
        </div>`).join('');

      box.querySelectorAll('.result-card').forEach((c) => {
        c.addEventListener('click', () => loadDetail(c.dataset.id));
      });
    } catch (e) {
      box.innerHTML = '<p class="error-text">' + esc(e.message) + '</p>';
    }
  }

  async function loadDetail(vehicleId) {
    const box = $('vehicle-detail');
    box.innerHTML = '<p class="muted">載入中…</p>';
    try {
      const d = await API.getVehicleHistory(vehicleId);
      const c = d.customer || {};
      box.innerHTML = `
        <div class="detail">
          <h3>${esc(d.vehicle.plate)}　<span class="muted">${esc(d.vehicle.model || '')} ${esc(d.vehicle.color || '')}</span></h3>
          <p class="muted">車主：${esc(c.name || '—')}　${esc(c.phone || '')}　生日：${esc(fmtBirthday(c.birthday))}</p>
          <p class="muted">累計消費：${d.totalAmount.toLocaleString()} 元　共 ${d.records.length} 次施工</p>
          <div class="record-list">
            ${d.records.map(renderRecord).join('') || '<p class="muted">尚無施工紀錄。</p>'}
          </div>
        </div>`;
    } catch (e) {
      box.innerHTML = '<p class="error-text">' + esc(e.message) + '</p>';
    }
  }

  function renderRecord(r) {
    const warranty = r.warrantyExpiry
      ? `<span class="badge ${r.warrantyActive ? 'ok' : 'expired'}">保固${r.warrantyActive ? '至' : '已過期'} ${r.warrantyExpiry}</span>`
      : '';
    const pay = r.paymentStatus !== '已收'
      ? `<span class="badge warn">${esc(r.paymentStatus)}</span>` : '';
    return `
      <div class="record">
        <div class="record-head">
          <b>${esc(r.date)}</b>
          <span class="cat">${esc(r.category)}</span>
          <span>${esc(r.item)}${r.itemOther ? '（' + esc(r.itemOther) + '）' : ''}</span>
          ${r.brand ? '<span class="brand">' + esc(r.brand) + '</span>' : ''}
        </div>
        <div class="record-foot">
          <span class="amount">${Number(r.amount || 0).toLocaleString()} 元</span>
          ${pay}${warranty}
        </div>
        ${r.feedback ? '<p class="feedback">客戶反應：' + esc(r.feedback) + '</p>' : ''}
      </div>`;
  }

  // 生日的年份 1900 是「客戶沒給年份」的佔位值，顯示時只給月日
  function fmtBirthday(b) {
    if (!b) return '—';
    const s = String(b);
    return s.indexOf('1900-') === 0 ? s.slice(5) : s;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[ch]);
  }

  init();
})();
