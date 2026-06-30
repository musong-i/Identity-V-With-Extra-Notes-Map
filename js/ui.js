/**
 * UI 渲染模块
 * 负责页面渲染、交互事件处理
 */

// 全局状态
let currentFilter = 'all';
let searchQuery = '';
let currentView = 'list'; // 'list' | 'manage'

// 画廊状态
const galleries = {}; // 按组ID存储画廊数据

// 缩放和拖拽状态
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let startX, startY;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

// 当前活跃的画廊
let activeGallery = null;
let galleryHistoryPushed = false; // 标记是否已 pushState

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

        // 使用 door.id 作为组标识，实现组间隔离
        mapsHtml += `
          <div class="image-card" data-map-id="${map.id}">
            <img src="${thumbUrl || ''}" alt="${map.name}" loading="lazy" 
                 onclick="openGallery(${door.id}, ${map.id})" data-full-src="${imageUrl}">
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
      <h2> 地图管理</h2>
      <div class="manage-actions">
        <button class="btn btn-primary" onclick="showAddShapeModal()"> 添加形状</button>
        <button class="btn btn-secondary" onclick="exportData()"> 导出数据</button>
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
            <button class="btn btn-small btn-danger" onclick="confirmDeleteShape(${shape.id}, '${shape.symbol}')">️ 删除</button>
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
              <button class="btn btn-small btn-danger" onclick="confirmDeleteDoor(${door.id}, '${door.positionName}')">️ 删除</button>
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

// ==================== 独立图片画廊组件 ====================

/**
 * 打开独立图片画廊
 * @param {number} doorId - 门位置ID（组标识）
 * @param {number} mapId - 当前图片ID
 */
async function openGallery(doorId, mapId) {
  // 获取门位置信息
  const door = await dbOps.get('doorPositions', doorId);
  if (!door) return;

  // 获取该组的所有地图
  const maps = await dbOps.getByIndex('maps', 'doorPositionId', doorId);
  if (!maps || maps.length === 0) return;

  // 找到当前图片在组中的索引
  const mapIndex = maps.findIndex(m => m.id === mapId);
  if (mapIndex === -1) return;

  // 创建或更新画廊
  activeGallery = {
    doorId: doorId,
    maps: maps,
    currentIndex: mapIndex,
    doorName: door.positionName
  };

  // 添加历史记录，拦截安卓返回键（仅首次打开时）
  if (!galleryHistoryPushed) {
    history.pushState({ gallery: true }, '', '');
    galleryHistoryPushed = true;
  }

  renderGallery();
}

/**
 * 渲染画廊界面
 */
function renderGallery() {
  if (!activeGallery) return;

  const container = document.getElementById('galleryContainer');
  const map = activeGallery.maps[activeGallery.currentIndex];
  const imageUrl = map.imageData ? URL.createObjectURL(map.imageData) : '';
  const isFirst = activeGallery.currentIndex === 0;
  const isLast = activeGallery.currentIndex === activeGallery.maps.length - 1;

  container.innerHTML = `
    <div class="gallery-overlay active" id="galleryOverlay">
      <!-- 关闭按钮 -->
      <div class="gallery-close" id="galleryClose" onclick="closeGallery()">&times;</div>
      
      <!-- 左箭头 -->
      <button class="gallery-arrow gallery-prev ${isFirst ? 'disabled' : ''}" 
              onclick="galleryPrev()" ${isFirst ? 'disabled' : ''}>
        &#10094;
      </button>
      
      <!-- 图片容器 -->
      <div class="gallery-image-wrapper">
        <img id="galleryImage" src="${imageUrl}" alt="${map.name}" 
             class="gallery-image">
      </div>
      
      <!-- 右箭头 -->
      <button class="gallery-arrow gallery-next ${isLast ? 'disabled' : ''}" 
              onclick="galleryNext()" ${isLast ? 'disabled' : ''}>
        &#10095;
      </button>
      
      <!-- 缩放控制 -->
      <div class="gallery-zoom-controls">
        <button class="zoom-btn" onclick="galleryZoomOut()">−</button>
        <span class="zoom-level" id="galleryZoomLevel">100%</span>
        <button class="zoom-btn" onclick="galleryZoomIn()">+</button>
        <button class="zoom-btn" onclick="galleryZoomReset()">↺</button>
      </div>
      
      <!-- 缩放提示 -->
      <div class="gallery-zoom-hint">
        💡 滚轮缩放 · 拖拽移动 · 双击重置 · 左右滑动翻页
      </div>
    </div>
  `;

  // 重置缩放
  currentZoom = 1;
  panX = 0;
  panY = 0;

  // 设置事件监听
  setupGalleryEvents();
}

/**
 * 设置画廊事件监听
 */
function setupGalleryEvents() {
  const overlay = document.getElementById('galleryOverlay');
  const image = document.getElementById('galleryImage');

  if (!overlay || !image) return;

  // 点击背景关闭（不是点击图片本身）
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeGallery();
    }
  });

  // 鼠标滚轮缩放
  overlay.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = image.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    const oldZoom = currentZoom;
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    currentZoom = Math.max(MIN_ZOOM, Math.min(currentZoom + delta, MAX_ZOOM));
    const zoomRatio = currentZoom / oldZoom;
    panX = panX * zoomRatio - mouseX * (zoomRatio - 1);
    panY = panY * zoomRatio - mouseY * (zoomRatio - 1);
    updateGalleryImageTransform();
  });

  // 鼠标拖拽
  image.addEventListener('mousedown', (e) => {
    if (currentZoom <= 1) return;
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    image.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateGalleryImageTransform();
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    const img = document.getElementById('galleryImage');
    if (img) img.style.cursor = '';
  });

  // 双击重置
  image.addEventListener('dblclick', (e) => {
    e.preventDefault();
    galleryZoomReset();
  });

  // 触摸手势支持（移动端）
  let lastTouchDistance = 0;
  let touchStartX, touchStartY;
  let touchStartClientX, touchStartClientY;
  let isTouchDragging = false;
  let isTouchSwiping = false;
  let touchMoved = false;

  image.addEventListener('touchstart', (e) => {
    touchMoved = false;
    if (e.touches.length === 2) {
      // 双指缩放
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1) {
      touchStartClientX = e.touches[0].clientX;
      touchStartClientY = e.touches[0].clientY;
      if (currentZoom > 1) {
        // 单指拖拽（仅在放大状态下）
        isTouchDragging = true;
        touchStartX = e.touches[0].clientX - panX;
        touchStartY = e.touches[0].clientY - panY;
      }
    }
  });

  image.addEventListener('touchmove', (e) => {
    touchMoved = true;
    if (e.touches.length === 2) {
      // 双指缩放
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const scale = distance / lastTouchDistance;
      currentZoom = Math.max(MIN_ZOOM, Math.min(currentZoom * scale, MAX_ZOOM));
      lastTouchDistance = distance;
      updateGalleryImageTransform();
    } else if (isTouchDragging && e.touches.length === 1) {
      // 单指拖拽
      e.preventDefault();
      panX = e.touches[0].clientX - touchStartX;
      panY = e.touches[0].clientY - touchStartY;
      updateGalleryImageTransform();
    }
  });

  image.addEventListener('touchend', (e) => {
    if (isTouchDragging) {
      isTouchDragging = false;
      return;
    }
    // 如果没有移动（点击），不处理
    // 如果移动了但没有拖拽，可能是滑动翻页
    if (touchMoved && !isTouchDragging && currentZoom <= 1) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartClientX;
      const dy = touch.clientY - touchStartClientY;
      // 水平滑动距离大于垂直距离，且超过阈值
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
          galleryNext(); // 向左滑，下一张
        } else {
          galleryPrev(); // 向右滑，上一张
        }
      }
    }
  });

  // 键盘支持
  document.addEventListener('keydown', handleGalleryKeydown);

  // 监听返回键事件（安卓物理返回键）
  window.addEventListener('popstate', handleGalleryPopState);
}

/**
 * 键盘事件处理
 */
function handleGalleryKeydown(e) {
  if (!activeGallery) return;
  
  switch (e.key) {
    case 'Escape':
      closeGallery();
      break;
    case 'ArrowLeft':
      galleryPrev();
      break;
    case 'ArrowRight':
      galleryNext();
      break;
  }
}

/**
 * 更新画廊图片变换
 */
function updateGalleryImageTransform() {
  const image = document.getElementById('galleryImage');
  if (!image) return;
  image.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  const zoomLevel = document.getElementById('galleryZoomLevel');
  if (zoomLevel) {
    zoomLevel.textContent = Math.round(currentZoom * 100) + '%';
  }
}

/**
 * 画廊缩放控制
 */
function galleryZoomIn() {
  currentZoom = Math.min(currentZoom + ZOOM_STEP, MAX_ZOOM);
  updateGalleryImageTransform();
}

function galleryZoomOut() {
  currentZoom = Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM);
  updateGalleryImageTransform();
}

function galleryZoomReset() {
  currentZoom = 1;
  panX = 0;
  panY = 0;
  updateGalleryImageTransform();
}

/**
 * 画廊翻页
 */
function galleryPrev() {
  if (!activeGallery || activeGallery.currentIndex <= 0) return;
  activeGallery.currentIndex--;
  renderGallery();
}

function galleryNext() {
  if (!activeGallery || activeGallery.currentIndex >= activeGallery.maps.length - 1) return;
  activeGallery.currentIndex++;
  renderGallery();
}

/**
 * 处理返回键事件（安卓物理返回键）
 */
function handleGalleryPopState(e) {
  if (activeGallery) {
    galleryHistoryPushed = false;
    closeGallery();
  }
}

/**
 * 关闭画廊
 */
function closeGallery() {
  const container = document.getElementById('galleryContainer');
  container.innerHTML = '';
  activeGallery = null;
  currentZoom = 1;
  panX = 0;
  panY = 0;
  document.removeEventListener('keydown', handleGalleryKeydown);
  window.removeEventListener('popstate', handleGalleryPopState);

  // 如果是通过点击关闭按钮关闭的，需要回退历史记录
  if (galleryHistoryPushed) {
    galleryHistoryPushed = false;
    history.back();
  }
}

// ==================== 数据操作 ====================

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