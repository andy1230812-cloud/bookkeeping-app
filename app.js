// ============================================
// 記帳本 PWA - 主程式
// ============================================

// === 設定 ===
// 請將這裡替換成你的 Google Apps Script 網頁應用程式 URL
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbza27xoTxTVIckvCTNci926wdhlZrAzWs8OBRRAZKjT2rfseB0n7jNDq3sh7BxtQ4k/exec';

// === 類別資料 ===
const CATEGORIES = {
  '支出': ['餐飲', '交通', '娛樂', '購物', '住宿', '日用品', '醫療', '教育'],
  '收入': ['薪資', '獎金', '投資', '副業', '禮金', '退款', '利息', '其他'],
  '轉帳': ['家人', '朋友', '公司', '信用卡', '貸款', '儲蓄', '投資', '其他'],
  '提款': ['ATM', '銀行櫃台', '其他'],
  '存款': ['定存', '活存', '儲蓄', '其他'],
  '換匯': ['美元', '日幣', '歐元', '人民幣', '英鎊', '韓元', '港幣', '其他'],
};

// === 目前交易狀態 ===
let currentTransaction = {
  type: '',
  amount: '',
  category: '',
};

// === 畫面切換 ===
function navigateTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// === Toast 訊息 ===
function showToast(message, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}

// === 初始化 ===
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initTypeSelection();
  initKeypad();
  initConfirm();
  initSpeech();
  initServiceWorker();
  flushPendingQueue();
});

// === 導航按鈕 ===
function initNavigation() {
  // 首頁 → 類型選擇
  document.getElementById('btn-new-entry').addEventListener('click', () => {
    navigateTo('screen-type');
  });

  // 所有返回按鈕
  document.querySelectorAll('.back-button').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.target);
    });
  });
}

// === 類型選擇 ===
function initTypeSelection() {
  document.querySelectorAll('.type-button').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTransaction.type = btn.dataset.type;
      currentTransaction.amount = '';
      currentTransaction.category = '';
      document.getElementById('amount-value').textContent = '0';
      document.getElementById('amount-title').textContent = `${currentTransaction.type} - 輸入金額`;
      navigateTo('screen-amount');
    });
  });
}

// === 數字鍵盤 ===
function initKeypad() {
  document.querySelectorAll('.key-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      handleKeyInput(key);
    });
  });

  document.getElementById('btn-next-category').addEventListener('click', () => {
    if (!currentTransaction.amount || currentTransaction.amount === '0') {
      showToast('請輸入金額');
      return;
    }
    renderCategories();
    navigateTo('screen-category');
  });
}

function handleKeyInput(key) {
  let amount = currentTransaction.amount;

  if (key === 'delete') {
    amount = amount.slice(0, -1);
  } else if (key === '.') {
    if (amount.includes('.')) return;
    if (amount === '') amount = '0';
    amount += '.';
  } else {
    // 限制小數點後 2 位
    if (amount.includes('.')) {
      const decimals = amount.split('.')[1];
      if (decimals && decimals.length >= 2) return;
    }
    // 避免開頭多個 0
    if (amount === '0' && key !== '.') {
      amount = key;
    } else {
      // 限制最大長度
      if (amount.replace('.', '').length >= 10) return;
      amount += key;
    }
  }

  currentTransaction.amount = amount;
  document.getElementById('amount-value').textContent = amount || '0';
}

// === 類別選擇 ===
function renderCategories() {
  const grid = document.getElementById('category-grid');
  const categories = CATEGORIES[currentTransaction.type] || [];
  document.getElementById('category-title').textContent = `${currentTransaction.type} - 選擇類別`;

  grid.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-button';
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      // 移除其他選取狀態
      grid.querySelectorAll('.category-button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      currentTransaction.category = cat;
      // 短暫延遲後跳到確認畫面
      setTimeout(() => showConfirmScreen(), 200);
    });
    grid.appendChild(btn);
  });
}

// === 確認畫面 ===
function showConfirmScreen() {
  const now = new Date();
  const date = formatDate(now);
  const time = formatTime(now);

  document.getElementById('confirm-type').textContent = currentTransaction.type;
  document.getElementById('confirm-amount').textContent = `$${currentTransaction.amount}`;
  document.getElementById('confirm-category').textContent = currentTransaction.category;
  document.getElementById('confirm-date').textContent = date;
  document.getElementById('confirm-time').textContent = time;

  navigateTo('screen-confirm');
}

function initConfirm() {
  document.getElementById('btn-submit').addEventListener('click', submitTransaction);
  document.getElementById('btn-back-edit').addEventListener('click', () => {
    navigateTo('screen-category');
  });
}

// === 日期時間格式化 ===
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTime(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${min}:${s}`;
}

// === 送出交易 ===
async function submitTransaction() {
  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.textContent = '送出中...';

  const now = new Date();
  const data = {
    date: formatDate(now),
    time: formatTime(now),
    type: currentTransaction.type,
    amount: parseFloat(currentTransaction.amount),
    category: currentTransaction.category,
  };

  try {
    if (SCRIPT_URL === 'YOUR_SCRIPT_URL_HERE') {
      throw new Error('尚未設定 Google Apps Script URL');
    }
    await sendToGoogleSheets(data);
    showSuccess();
  } catch (error) {
    // 儲存到離線佇列
    saveToPendingQueue(data);
    if (SCRIPT_URL === 'YOUR_SCRIPT_URL_HERE') {
      showToast('已暫存（請先設定 Google Apps Script URL）', 3000);
    } else {
      showToast('網路異常，已暫存待上傳', 3000);
    }
    showSuccess();
  } finally {
    btn.disabled = false;
    btn.textContent = '確認送出';
  }
}

async function sendToGoogleSheets(data) {
  const response = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('送出失敗');
  }
}

// === 離線佇列 ===
function saveToPendingQueue(data) {
  const queue = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
  queue.push(data);
  localStorage.setItem('pendingTransactions', JSON.stringify(queue));
}

async function flushPendingQueue() {
  if (SCRIPT_URL === 'YOUR_SCRIPT_URL_HERE') return;

  const queue = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
  if (queue.length === 0) return;

  const remaining = [];
  for (const data of queue) {
    try {
      await sendToGoogleSheets(data);
    } catch {
      remaining.push(data);
    }
  }

  localStorage.setItem('pendingTransactions', JSON.stringify(remaining));
  if (remaining.length === 0 && queue.length > 0) {
    showToast(`已補傳 ${queue.length} 筆暫存記錄`);
  }
}

// 連線恢復時自動補傳
window.addEventListener('online', () => {
  flushPendingQueue();
});

// === 成功動畫 ===
function showSuccess() {
  const overlay = document.getElementById('success-overlay');
  overlay.classList.remove('hidden');
  setTimeout(() => {
    overlay.classList.add('hidden');
    // 重置狀態
    currentTransaction = { type: '', amount: '', category: '' };
    navigateTo('screen-home');
  }, 1500);
}

// === 語音辨識 ===
function initSpeech() {
  const micBtn = document.getElementById('btn-mic');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    micBtn.addEventListener('click', () => {
      showToast('此裝置不支援語音功能');
    });
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'zh-TW';
  recognition.continuous = false;
  recognition.interimResults = false;

  let isListening = false;

  micBtn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
      isListening = true;
      micBtn.classList.add('listening');
    } catch {
      showToast('語音辨識啟動失敗');
    }
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (transcript.includes('記帳')) {
      navigateTo('screen-type');
    } else {
      showToast(`聽到：「${transcript}」，請說「記帳」`);
    }
  };

  recognition.onerror = (event) => {
    isListening = false;
    micBtn.classList.remove('listening');
    if (event.error === 'not-allowed') {
      showToast('請允許麥克風權限');
    } else if (event.error === 'no-speech') {
      showToast('沒有偵測到語音，請再試一次');
    } else {
      showToast('語音辨識失敗，請使用下方按鈕');
    }
  };

  recognition.onend = () => {
    isListening = false;
    micBtn.classList.remove('listening');
  };
}

// === Service Worker 註冊 ===
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .catch(() => { });
  }
}
