/**
 * UI 渲染模块
 * 负责页面渲染、交互事件处理
 */

// 全局状态
let currentFilter = 'all';
let searchQuery = '';
let currentView = 'list'; // 'list' | 'manage'

// 缩放和拖拽状态
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let startX, startY;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

/**
 * 渲染主内容
 */
async function renderContent() {
  const container = document.getElementById('content');
  
  if (currentView === 'manage') {
    await renderManageView(container);
  } else {
    await renderListView(container);
  }
  
  await updateStats();
}

/**
 * 渲染列表视图（普通浏览）
 */
async function renderListView(container) {
  const allData = await mapDB.getAllMapData();
  let html = '';
  let hasResults = false;

  for (const shape of allData) {
    let shapeHtml = '';
    let shapeHasResults = false;

    for (const door of shape.doors) {
      // 筛选门位置
      if (currentFilter !== 'all' && !door.positionName.includes(currentFilter)) {
        continue;
      }

      let mapsHtml = '';
      let doorHasResults = false;

      for (const map of door.maps) {
        // 搜索过滤
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (
            !map.name.toLowerCase().includes(q) &&
            !door.positionName.toLowerCase().includes(q) &&
            !shape.name.toLowerCase().includes(q) &&
            !shape.symbol.toLowerCase().includes(q)
          ) {
            continue;
          }
        }

        doorHasResults = true;
        shapeHasResults = true;
        hasResults = true;

        // 生成图片 URL（从 Blob）
        const imageUrl = map.imageData ? URL.createObjectURL(map.imageData) : '';
        const thumbUrl = map.thumbnail ? URL.createObjectURL(map.thumbnail) : imageUrl;

        mapsHtml += `
          <div class="image-card" data-map-id="${map.id}">
            <img src="${thumbUrl || ''}" alt="${map.name}" loading="lazy" 
                 onclick="openModal(${map.id})" data-full-src="${imageUrl}">
            <div class="image-info">
              <div class="image-name">${map.name}</div>
              <div class="image-path">${shape.symbol} > ${door.positionName}</div>
            </div>
          </div>
        `;
      }

      if (doorHasResults) {
        shapeHtml += `
          <div class="door-group">
            <div class="door-title">🚪 ${door.positionName}</div>
            <div class="image-grid">${mapsHtml}</div>
          </div>
        `;
      }
    }

    if (shapeHasResults) {
      html += `
        <div class="shape-section" data-shape="${shape.symbol}">
          <div class="shape-title">
            <span class="shape-symbol">${shape.symbol}</span>
            <span>${shape.name}</span>
            <span style="font-size: 0.7em; color: #888;">- ${shape.description || ''}</span>
          </div>
          ${shapeHtml}
        </div>
      `;
    }
  }

  if (!hasResults) {
    html = '<div class="no-results">😔 没有找到匹配的地图<br><small>点击右上角管理按钮添加地图</small></div>';
  }

  container.innerHTML = html;
}

/**
 * 渲染管理视图
 */
async function renderManageView(container) {
  const allData = await mapDB.getAllMapData();
  
  let html = `
    <div class="manage-header">
      <h2>📋 地图管理</h2>
      <div class="manage-actions">
        <button class="btn btn-primary" onclick="showAddShapeModal()">➕ 添加形状</button>
        <button class="btn btn-secondary" onclick="exportData()">📤 导出数据</button>
        <button class="btn btn-secondary" onclick="document.getElementById('importFile').click()">📥 导入数据</button>
        <input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(event)">
      </div>
    </div>
  `;

  for (const shape of allData) {
    html += `
      <div class="manage-shape-section">
        <div class="manage-shape-header">
          <span class="shape-symbol">${shape.symbol}</span>
          <span class="shape-name">${shape.name}</span>
          <div class="shape-actions">
            <button class="btn btn-small" onclick="showAddDoorModal(${shape.id})">➕ 添加门位置</button>
            <button class="btn btn-small btn-edit" onclick="showEditShapeModal(${shape.id})">✏️ 编辑</button>
            <button class="btn btn-small btn-danger" onclick="confirmDeleteShape(${shape.id}, '${shape.symbol}')">🗑️ 删除</button>
          </div>
        </div>
    `;

    for (const door of shape.doors) {
      html += `
        <div class="manage-door-section">
          <div class="manage-door-header">
            <span>🚪 ${door.positionName}</span>
            <div class="door-actions">
              <button class="btn btn-small" onclick="showAddMapModal(${door.id}, '${shape.symbol}', '${door.positionName}')">➕ 添加地图</button>
              <button class="btn btn-small btn-edit" onclick="showEditDoorModal(${door.id})">✏️ 编辑</button>
              <button class="btn btn-small btn-danger" onclick="confirmDeleteDoor(${door.id}, '${door.positionName}')">🗑️ 删除</button>
            </div>
          </div>
          <div class="manage-maps-grid">
      `;

      for (const map of door.maps) {
        const thumbUrl = map.thumbnail ? URL.createObjectURL(map.thumbnail) : 
                         (map.imageData ? URL.createObjectURL(map.imageData) : '');
        html += `
          <div class="manage-map-card">
            <img src="${thumbUrl || ''}" alt="${map.name}">
            <div class="manage-map-info">
              <span>${map.name}</span>
              <div class="manage-map-actions">
                <button class="btn btn-tiny btn-edit" onclick="showEditMapModal(${map.id})">✏️</button>
                <button class="btn btn-tiny btn-danger" onclick="confirmDeleteMap(${map.id}, '${map.name}')">🗑️</button>
              </div>
            </div>
          </div>
        `;
      }

      if (door.maps.length === 0) {
        html += '<div class="empty-hint">暂无地图，点击上方按钮添加</div>';
      }

      html += `
          </div>
        </div>
      `;
    }

    if (shape.doors.length === 0) {
      html += '<div class="empty-hint">暂无门位置，点击上方按钮添加</div>';
    }

    html += '</div>';
  }

  if (allData.length === 0) {
    html += `
      <div class="empty-state">
        <p>📭 暂无地图数据</p>
        <p>点击"添加形状"开始创建</p>
      </div>
    `;
  }

  container.innerHTML = html;
}

/**
 * 更新统计信息
 */
async function updateStats() {
  const stats = await mapDB.getStats();
  document.getElementById('totalMaps').textContent = stats.maps;
  document.getElementById('totalShapes').textContent = stats.shapes;
}

/**
 * 切换视图
 */
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  renderContent();
}

/**
 * 设置筛选
 */
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter || btn.dataset.filter === 'all' && filter === 'all');
  });
  renderContent();
}

/**
 * 设置搜索
 */
function setSearch(query) {
  searchQuery = query;
  renderContent();
}

/**
 * 打开图片模态框
 */
async function openModal(mapId) {
  const map = await dbOps.get('maps', mapId);
  if (!map) return;

  const modal = document.getElementById('modal');
  const modalImage = document.getElementById('modalImage');
  const modalInfo = document.getElementById('modalInfo');

  const imageUrl = map.imageData ? URL.createObjectURL(map.imageData) : '';
  modalImage.src = imageUrl;
  modalInfo.textContent = map.name;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  resetZoom();
}

/**
 * 关闭模态框
 */
function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
  resetZoom();
}

/**
 * 缩放和拖拽控制
 */
function updateImageTransform() {
  const modalImage = document.getElementById('modalImage');
  modalImage.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  document.getElementById('zoomLevel').textContent = Math.round(currentZoom * 100) + '%';
}

function resetZoom() {
  currentZoom = 1;
  panX = 0;
  panY = 0;
  updateImageTransform();
}

function zoomIn() {
  currentZoom = Math.min(currentZoom + ZOOM_STEP, MAX_ZOOM);
  updateImageTransform();
}

function zoomOut() {
  currentZoom = Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM);
  updateImageTransform();
}

function setupZoomAndPan() {
  const modal = document.getElementById('modal');
  const modalImage = document.getElementById('modalImage');

  // 鼠标滚轮缩放
  modal.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = modalImage.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    const oldZoom = currentZoom;
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    currentZoom = Math.max(MIN_ZOOM, Math.min(currentZoom + delta, MAX_ZOOM));
    const zoomRatio = currentZoom / oldZoom;
    panX = panX * zoomRatio - mouseX * (zoomRatio - 1);
    panY = panY * zoomRatio - mouseY * (zoomRatio - 1);
    updateImageTransform();
  });

  // 鼠标拖拽
  modalImage.addEventListener('mousedown', (e) => {
    if (currentZoom <= 1) return;
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    modalImage.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateImageTransform();
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    const modalImage = document.getElementById('modalImage');
    if (modalImage) modalImage.style.cursor = '';
  });

  // 双击重置
  modalImage.addEventListener('dblclick', (e) => {
    e.preventDefault();
    resetZoom();
  });

  // 缩放手势支持（移动端）
  let lastTouchDistance = 0;
  modal.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
    }
  });

  modal.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const scale = distance / lastTouchDistance;
      currentZoom = Math.max(MIN_ZOOM, Math.min(currentZoom * scale, MAX_ZOOM));
      lastTouchDistance = distance;
      updateImageTransform();
    }
  });

  // 缩放按钮
  document.getElementById('zoomIn').addEventListener('click', zoomIn);
  document.getElementById('zoomOut').addEventListener('click', zoomOut);
  document.getElementById('zoomReset').addEventListener('click', resetZoom);
}

/**
 * 导出数据
 */
async function exportData() {
  try {
    const data = await mapDB.exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `map-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据导出成功！');
  } catch (err) {
    showToast('导出失败：' + err.message);
  }
}

/**
 * 导入数据
 */
async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await mapDB.importData(data);
    showToast('数据导入成功！');
    renderContent();
  } catch (err) {
    showToast('导入失败：' + err.message);
  }
  
  event.target.value = '';
}

/**
 * 显示提示消息
 */
function showToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * 显示确认对话框
 */
function showConfirm(title, message) {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
      <div class="confirm-content">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="confirm-actions">
          <button class="btn btn-secondary" id="confirmCancel">取消</button>
          <button class="btn btn-danger" id="confirmOk">确定</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    
    dialog.querySelector('#confirmOk').onclick = () => { dialog.remove(); resolve(true); };
    dialog.querySelector('#confirmCancel').onclick = () => { dialog.remove(); resolve(false); };
  });
}