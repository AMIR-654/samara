// ===== Firebase SDK v10 Modular =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, doc,
  getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  orderBy, query, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ===== Config =====
const firebaseConfig = {
  apiKey: "AIzaSyD15jjDHKnJJSTIiS1qkqHOp8LGN7gIRD4",
  authDomain: "samara-560ad.firebaseapp.com",
  projectId: "samara-560ad",
  storageBucket: "samara-560ad.firebasestorage.app",
  messagingSenderId: "838230946676",
  appId: "1:838230946676:web:9ac33c5ee94f47c8407221"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ===== State =====
let categories = [];   // [{ id, ...data, items:[...] }]
let allItems   = [];   // flat list
let dragSrc    = null;

// ===== Init =====
window.addEventListener('DOMContentLoaded', () => {
  loadAll();
});

// ===== Load All =====
window.loadAll = async function () {
  showLoading();
  categories = [];
  allItems   = [];

  try {
    const catsSnap = await getDocs(
      query(collection(db, 'categories'), orderBy('sortOrder', 'asc'))
    );

    for (const catDoc of catsSnap.docs) {
      const catData = { id: catDoc.id, ...catDoc.data(), items: [] };

      const itemsSnap = await getDocs(
        query(collection(db, 'categories', catDoc.id, 'items'), orderBy('sortOrder', 'asc'))
      );

      itemsSnap.forEach(itemDoc => {
        const item = { id: itemDoc.id, catId: catDoc.id, catTitle: catData.title, ...itemDoc.data() };
        catData.items.push(item);
        allItems.push(item);
      });

      categories.push(catData);
    }

    renderCategories();
    renderItems();
    updateStats();
    populateCatSelects();
  } catch (e) {
    notify('خطأ في التحميل: ' + e.message, 'error');
    console.error(e);
  }
};

// ===== Render Categories =====
function renderCategories(list = categories) {
  const grid = document.getElementById('categoriesGrid');
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><span>لا توجد تصنيفات بعد</span></div>`;
    return;
  }
  grid.innerHTML = list.map(cat => buildCatCard(cat)).join('');
  attachCatDrag();
}

function buildCatCard(cat) {
  const icon = cat.icon
    ? (cat.icon.startsWith('http') ? `<img src="${cat.icon}" alt="" />` : cat.icon)
    : '📁';
  const statusClass = cat.status !== false ? 'on' : 'off';
  const statusLabel = cat.status !== false ? 'مفعّل' : 'معطّل';

  return `
  <div class="cat-card" draggable="true" data-id="${cat.id}" data-type="cat">
    <div class="cat-card-header">
      <div class="drag-handle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/></svg>
      </div>
      <div class="cat-icon">${icon}</div>
      <div class="cat-meta">
        <div class="cat-title">${cat.title || '—'}</div>
        <div class="cat-id">${cat.id}</div>
      </div>
      <span class="cat-badge ${statusClass}">${statusLabel}</span>
    </div>
    <div class="cat-card-body">
      <div class="cat-info">
        <div class="info-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          ترتيب: ${cat.sortOrder ?? 0}
        </div>
        ${cat.password ? `<div class="info-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          محمي
        </div>` : ''}
        <div class="info-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          ${cat.items.length} عنصر
        </div>
      </div>
      <div class="cat-card-actions">
        <button class="btn-icon accent" title="تعديل" onclick="openCategoryModal('${cat.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon ${cat.status !== false ? 'danger' : 'success'}" title="${cat.status !== false ? 'تعطيل' : 'تفعيل'}" onclick="toggleCatStatus('${cat.id}', ${cat.status !== false})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${cat.status !== false ? '<path d="M18.36 6.64A9 9 0 0 1 20.77 15"/><path d="M6.16 6.16a9 9 0 1 0 12.68 12.68"/><line x1="2" y1="2" x2="22" y2="22"/>' : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'}</svg>
        </button>
        <button class="btn-icon accent" title="تغيير كلمة المرور" onclick="openPasswordModal('cat','${cat.id}','')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </button>
        <button class="btn-icon accent" title="إضافة عنصر" onclick="openItemModal(null,'${cat.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="btn-icon danger" title="حذف" onclick="confirmDelete('cat','${cat.id}','')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>
  </div>`;
}

// ===== Render Items =====
function renderItems(list = allItems, catFilter = '') {
  const grid = document.getElementById('itemsGrid');
  let items = list;
  if (catFilter) items = items.filter(i => i.catId === catFilter);

  if (!items.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><span>لا توجد عناصر</span></div>`;
    return;
  }
  grid.innerHTML = items.map(item => buildItemCard(item)).join('');
  attachItemDrag();
}

function buildItemCard(item) {
  const icon = item.icon
    ? (item.icon.startsWith('http') ? `<img src="${item.icon}" alt="" />` : item.icon)
    : '🔗';
  const statusClass = item.status !== false ? 'on' : 'off';
  const statusLabel = item.status !== false ? 'مفعّل' : 'معطّل';

  return `
  <div class="item-card" draggable="true" data-id="${item.id}" data-cat="${item.catId}" data-type="item">
    <div class="drag-handle">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/></svg>
    </div>
    <div class="item-icon">${icon}</div>
    <div class="item-meta">
      <div class="item-title">${item.title || '—'}</div>
      ${item.url ? `<div class="item-url">${item.url}</div>` : ''}
      <span class="item-cat-tag">${item.catTitle || item.catId}</span>
    </div>
    <span class="item-badge ${statusClass}">${statusLabel}</span>
    <div class="item-actions">
      <button class="btn-icon accent" title="تعديل" onclick="openItemModal('${item.id}','${item.catId}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn-icon ${item.status !== false ? 'danger' : 'success'}" title="${item.status !== false ? 'تعطيل' : 'تفعيل'}" onclick="toggleItemStatus('${item.id}','${item.catId}',${item.status !== false})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${item.status !== false ? '<path d="M18.36 6.64A9 9 0 0 1 20.77 15"/><path d="M6.16 6.16a9 9 0 1 0 12.68 12.68"/><line x1="2" y1="2" x2="22" y2="22"/>' : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'}</svg>
      </button>
      <button class="btn-icon accent" title="تغيير الرابط" onclick="openUrlModal('${item.id}','${item.catId}','${(item.url || '').replace(/'/g,"\\'")}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </button>
      <button class="btn-icon accent" title="تغيير كلمة المرور" onclick="openPasswordModal('item','${item.id}','${item.catId}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </button>
      <button class="btn-icon danger" title="حذف" onclick="confirmDelete('item','${item.id}','${item.catId}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  </div>`;
}

// ===== Stats =====
function updateStats() {
  document.getElementById('totalCats').textContent  = categories.length;
  document.getElementById('totalItems').textContent = allItems.length;
}

function populateCatSelects() {
  const opts = categories.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
  document.getElementById('filterCat').innerHTML   = `<option value="">كل التصنيفات</option>${opts}`;
  document.getElementById('itemCatSelect').innerHTML = `<option value="">اختر تصنيفاً…</option>${opts}`;
}

// ===== Loading =====
function showLoading() {
  document.getElementById('categoriesGrid').innerHTML = `<div class="loading-state"><div class="spinner"></div><span>جارٍ التحميل…</span></div>`;
  document.getElementById('itemsGrid').innerHTML      = `<div class="loading-state"><div class="spinner"></div><span>جارٍ التحميل…</span></div>`;
}

// ===== Navigation =====
window.showSection = function (name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  const idx = name === 'categories' ? 0 : 1;
  document.querySelectorAll('.nav-item')[idx].classList.add('active');
};

// ===== Sidebar toggle (mobile) =====
window.toggleSidebar = function () {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('active');
};
window.closeSidebar = function () {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');
};

// ===== Search =====
window.handleSearch = function (q) {
  q = q.trim().toLowerCase();
  if (!q) {
    renderCategories();
    renderItems();
    return;
  }
  const filteredCats  = categories.filter(c =>
    (c.title || '').toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
  );
  const filteredItems = allItems.filter(i =>
    (i.title || '').toLowerCase().includes(q) ||
    (i.url   || '').toLowerCase().includes(q) ||
    (i.catTitle || '').toLowerCase().includes(q)
  );
  renderCategories(filteredCats);
  renderItems(filteredItems);
};

// ===== Filter items by category =====
window.filterItemsByCategory = function (catId) {
  renderItems(allItems, catId);
};

// ===== Category Modal =====
window.openCategoryModal = async function (id = null) {
  clearCatForm();
  document.getElementById('catModalTitle').textContent = id ? 'تعديل التصنيف' : 'تصنيف جديد';
  if (id) {
    const cat = categories.find(c => c.id === id);
    if (cat) {
      document.getElementById('catId').value       = cat.id;
      document.getElementById('catTitle').value    = cat.title || '';
      document.getElementById('catIcon').value     = cat.icon  || '';
      document.getElementById('catOrder').value    = cat.sortOrder ?? 0;
      document.getElementById('catStatus').checked = cat.status !== false;
    }
  }
  document.getElementById('categoryModal').classList.add('active');
};

window.closeCategoryModal = function () {
  document.getElementById('categoryModal').classList.remove('active');
};

function clearCatForm() {
  ['catId','catTitle','catIcon','catOrder','catPassword'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('catStatus').checked = true;
}

window.saveCategory = async function () {
  const id       = document.getElementById('catId').value.trim();
  const title    = document.getElementById('catTitle').value.trim();
  const icon     = document.getElementById('catIcon').value.trim();
  const password = document.getElementById('catPassword').value;
  const order    = parseInt(document.getElementById('catOrder').value) || 0;
  const status   = document.getElementById('catStatus').checked;

  if (!title) return notify('العنوان مطلوب', 'error');

  const data = { title, icon, sortOrder: order, status };
  if (password) data.password = password;

  try {
    if (id) {
      await updateDoc(doc(db, 'categories', id), data);
      notify('تم تحديث التصنيف بنجاح');
    } else {
      await addDoc(collection(db, 'categories'), data);
      notify('تم إنشاء التصنيف بنجاح');
    }
    closeCategoryModal();
    await loadAll();
  } catch (e) {
    notify('خطأ: ' + e.message, 'error');
  }
};

// ===== Toggle Category Status =====
window.toggleCatStatus = async function (id, currentStatus) {
  try {
    await updateDoc(doc(db, 'categories', id), { status: !currentStatus });
    notify(!currentStatus ? 'تم التفعيل' : 'تم التعطيل');
    await loadAll();
  } catch (e) {
    notify('خطأ: ' + e.message, 'error');
  }
};

// ===== Delete Category =====
async function deleteCategoryById(id) {
  try {
    // Delete sub-items first
    const itemsSnap = await getDocs(collection(db, 'categories', id, 'items'));
    const batch = writeBatch(db);
    itemsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'categories', id));
    await batch.commit();
    notify('تم الحذف بنجاح');
    await loadAll();
  } catch (e) {
    notify('خطأ: ' + e.message, 'error');
  }
}

// ===== Item Modal =====
window.openItemModal = async function (itemId = null, catId = null) {
  clearItemForm();
  document.getElementById('itemModalTitle').textContent = itemId ? 'تعديل العنصر' : 'عنصر جديد';

  if (catId) document.getElementById('itemCatSelect').value = catId;

  if (itemId && catId) {
    const item = allItems.find(i => i.id === itemId && i.catId === catId);
    if (item) {
      document.getElementById('itemId').value        = item.id;
      document.getElementById('itemCatId').value     = item.catId;
      document.getElementById('itemCatSelect').value = item.catId;
      document.getElementById('itemTitle').value     = item.title    || '';
      document.getElementById('itemIcon').value      = item.icon     || '';
      document.getElementById('itemUrl').value       = item.url      || '';
      document.getElementById('itemAction').value    = item.action   || '';
      document.getElementById('itemOrder').value     = item.sortOrder ?? 0;
      document.getElementById('itemStatus').checked  = item.status !== false;
    }
  }
  document.getElementById('itemModal').classList.add('active');
};

window.closeItemModal = function () {
  document.getElementById('itemModal').classList.remove('active');
};

function clearItemForm() {
  ['itemId','itemCatId','itemTitle','itemIcon','itemUrl','itemAction','itemPassword','itemOrder'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('itemStatus').checked  = true;
  document.getElementById('itemCatSelect').value = '';
}

window.saveItem = async function () {
  const id       = document.getElementById('itemId').value.trim();
  const catId    = document.getElementById('itemCatSelect').value;
  const title    = document.getElementById('itemTitle').value.trim();
  const icon     = document.getElementById('itemIcon').value.trim();
  const url      = document.getElementById('itemUrl').value.trim();
  const action   = document.getElementById('itemAction').value.trim();
  const password = document.getElementById('itemPassword').value;
  const order    = parseInt(document.getElementById('itemOrder').value) || 0;
  const status   = document.getElementById('itemStatus').checked;

  if (!catId)  return notify('اختر تصنيفاً', 'error');
  if (!title)  return notify('العنوان مطلوب', 'error');

  const data = { title, icon, url, action, sortOrder: order, status };
  if (password) data.password = password;

  try {
    if (id) {
      const oldCatId = document.getElementById('itemCatId').value;
      if (oldCatId && oldCatId !== catId) {
        // moved to different category
        const oldRef = doc(db, 'categories', oldCatId, 'items', id);
        const newRef = doc(db, 'categories', catId, 'items', id);
        const snap = await getDoc(oldRef);
        if (snap.exists()) {
          await setDoc(newRef, { ...snap.data(), ...data });
          await deleteDoc(oldRef);
        }
      } else {
        await updateDoc(doc(db, 'categories', catId, 'items', id), data);
      }
      notify('تم تحديث العنصر بنجاح');
    } else {
      await addDoc(collection(db, 'categories', catId, 'items'), data);
      notify('تم إنشاء العنصر بنجاح');
    }
    closeItemModal();
    await loadAll();
  } catch (e) {
    notify('خطأ: ' + e.message, 'error');
  }
};

// ===== Toggle Item Status =====
window.toggleItemStatus = async function (itemId, catId, currentStatus) {
  try {
    await updateDoc(doc(db, 'categories', catId, 'items', itemId), { status: !currentStatus });
    notify(!currentStatus ? 'تم التفعيل' : 'تم التعطيل');
    await loadAll();
  } catch (e) {
    notify('خطأ: ' + e.message, 'error');
  }
};

async function deleteItemById(itemId, catId) {
  try {
    await deleteDoc(doc(db, 'categories', catId, 'items', itemId));
    notify('تم الحذف بنجاح');
    await loadAll();
  } catch (e) {
    notify('خطأ: ' + e.message, 'error');
  }
}

// ===== Password Modal =====
window.openPasswordModal = function (type, docId, catId) {
  document.getElementById('pwType').value  = type;
  document.getElementById('pwDocId').value = docId;
  document.getElementById('pwCatId').value = catId;
  document.getElementById('pwNew').value   = '';
  document.getElementById('passwordModal').classList.add('active');
};
window.closePasswordModal = function () {
  document.getElementById('passwordModal').classList.remove('active');
};
window.savePassword = async function () {
  const type  = document.getElementById('pwType').value;
  const docId = document.getElementById('pwDocId').value;
  const catId = document.getElementById('pwCatId').value;
  const pw    = document.getElementById('pwNew').value;

  try {
    if (type === 'cat') {
      await updateDoc(doc(db, 'categories', docId), { password: pw });
    } else {
      await updateDoc(doc(db, 'categories', catId, 'items', docId), { password: pw });
    }
    notify('تم تحديث كلمة المرور');
    closePasswordModal();
    await loadAll();
  } catch (e) {
    notify('خطأ: ' + e.message, 'error');
  }
};

// ===== URL Modal =====
window.openUrlModal = function (itemId, catId, currentUrl) {
  document.getElementById('urlDocId').value = itemId;
  document.getElementById('urlCatId').value = catId;
  document.getElementById('urlNew').value   = currentUrl || '';
  document.getElementById('urlModal').classList.add('active');
};
window.closeUrlModal = function () {
  document.getElementById('urlModal').classList.remove('active');
};
window.saveUrl = async function () {
  const itemId = document.getElementById('urlDocId').value;
  const catId  = document.getElementById('urlCatId').value;
  const url    = document.getElementById('urlNew').value.trim();
  try {
    await updateDoc(doc(db, 'categories', catId, 'items', itemId), { url });
    notify('تم تحديث الرابط');
    closeUrlModal();
    await loadAll();
  } catch (e) {
    notify('خطأ: ' + e.message, 'error');
  }
};

// ===== Confirm Delete Modal =====
let confirmCallback = null;
window.confirmDelete = function (type, id, catId) {
  const label = type === 'cat' ? 'التصنيف' : 'العنصر';
  document.getElementById('confirmMsg').textContent = `هل أنت متأكد من حذف ${label}؟ لا يمكن التراجع عن هذا الإجراء.`;
  confirmCallback = async () => {
    closeConfirm();
    if (type === 'cat')  await deleteCategoryById(id);
    else                  await deleteItemById(id, catId);
  };
  document.getElementById('confirmOk').onclick = confirmCallback;
  document.getElementById('confirmModal').classList.add('active');
};
window.closeConfirm = function () {
  document.getElementById('confirmModal').classList.remove('active');
};

// Close modals on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.classList.remove('active');
  });
});

// ===== Notifications =====
window.notify = function (msg, type = 'success') {
  const container = document.getElementById('notifContainer');
  const el = document.createElement('div');
  el.className = `notif ${type}`;
  el.innerHTML = `<span class="notif-dot"></span>${msg}`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(10px)'; el.style.transition = '.3s'; setTimeout(() => el.remove(), 300); }, 3500);
};

// ===== Drag & Drop — Categories =====
function attachCatDrag() {
  const cards = document.querySelectorAll('.cat-card[draggable="true"]');
  cards.forEach(card => {
    card.addEventListener('dragstart', onCatDragStart);
    card.addEventListener('dragover',  onCatDragOver);
    card.addEventListener('dragleave', onCatDragLeave);
    card.addEventListener('drop',      onCatDrop);
    card.addEventListener('dragend',   onCatDragEnd);
  });
}

function onCatDragStart(e) {
  dragSrc = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.id);
}
function onCatDragOver(e) {
  e.preventDefault();
  if (this !== dragSrc) this.classList.add('drag-over');
}
function onCatDragLeave() { this.classList.remove('drag-over'); }
function onCatDrop(e) {
  e.stopPropagation();
  if (this === dragSrc) return;
  const srcId  = dragSrc.dataset.id;
  const tgtId  = this.dataset.id;
  const srcIdx = categories.findIndex(c => c.id === srcId);
  const tgtIdx = categories.findIndex(c => c.id === tgtId);
  if (srcIdx < 0 || tgtIdx < 0) return;
  const [moved] = categories.splice(srcIdx, 1);
  categories.splice(tgtIdx, 0, moved);
  saveCatOrder();
  renderCategories();
}
function onCatDragEnd() {
  document.querySelectorAll('.cat-card').forEach(c => { c.classList.remove('dragging','drag-over'); });
  dragSrc = null;
}

async function saveCatOrder() {
  const batch = writeBatch(db);
  categories.forEach((c, i) => {
    c.sortOrder = i;
    batch.update(doc(db, 'categories', c.id), { sortOrder: i });
  });
  await batch.commit();
}

// ===== Drag & Drop — Items =====
function attachItemDrag() {
  const cards = document.querySelectorAll('.item-card[draggable="true"]');
  cards.forEach(card => {
    card.addEventListener('dragstart', onItemDragStart);
    card.addEventListener('dragover',  onItemDragOver);
    card.addEventListener('dragleave', onItemDragLeave);
    card.addEventListener('drop',      onItemDrop);
    card.addEventListener('dragend',   onItemDragEnd);
  });
}

function onItemDragStart(e) {
  dragSrc = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.id);
}
function onItemDragOver(e) {
  e.preventDefault();
  if (this !== dragSrc) this.classList.add('drag-over');
}
function onItemDragLeave() { this.classList.remove('drag-over'); }
function onItemDrop(e) {
  e.stopPropagation();
  if (this === dragSrc) return;
  const srcId    = dragSrc.dataset.id;
  const srcCat   = dragSrc.dataset.cat;
  const tgtId    = this.dataset.id;
  const tgtCat   = this.dataset.cat;
  if (srcCat !== tgtCat) return; // cross-category drag not supported

  const catItems = allItems.filter(i => i.catId === srcCat);
  const srcIdx   = catItems.findIndex(i => i.id === srcId);
  const tgtIdx   = catItems.findIndex(i => i.id === tgtId);
  if (srcIdx < 0 || tgtIdx < 0) return;

  const [moved] = catItems.splice(srcIdx, 1);
  catItems.splice(tgtIdx, 0, moved);

  // Rebuild allItems order
  const otherItems = allItems.filter(i => i.catId !== srcCat);
  allItems.length = 0;
  allItems.push(...otherItems, ...catItems);

  saveItemOrder(srcCat, catItems);
  renderItems(allItems, document.getElementById('filterCat').value);
}
function onItemDragEnd() {
  document.querySelectorAll('.item-card').forEach(c => { c.classList.remove('dragging','drag-over'); });
  dragSrc = null;
}

async function saveItemOrder(catId, catItems) {
  const batch = writeBatch(db);
  catItems.forEach((item, i) => {
    item.sortOrder = i;
    batch.update(doc(db, 'categories', catId, 'items', item.id), { sortOrder: i });
  });
  await batch.commit();
}
