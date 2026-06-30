/**
 * 主应用模块
 * 处理模态框、事件绑定、初始化
 */

/**
 * 显示添加形状模态框
 */
function showAddShapeModal() {
  showModal('添加形状', `
    <div class="form-group">
      <label>形状符号</label>
      <input type="text" id="shapeSymbol" placeholder="如: ┏" maxlength="10">
    </div>
    <div class="form-group">
      <label>形状名称</label>
      <input type="text" id="shapeName" placeholder="如: ┏ 形地图">
    </div>
    <div class="form-group">
      <label>形状描述</label>
      <input type="text" id="shapeDesc" placeholder="如: 左上直角地图">
    </div>
  `, async () => {
    const symbol = document.getElementById('shapeSymbol').value.trim();
    const name = document.getElementById('shapeName').value.trim();
    const desc = document.getElementById('shapeDesc').value.trim();
    
    if (!symbol || !name) {
      showToast('请填写符号和名称');
      return false;
    }
    
    await mapDB.addShape(symbol, name, desc);
    showToast('形状添加成功');
    renderContent();
    return true;
  });
}

/**
 * 显示编辑形状模态框
 */
async function showEditShapeModal(shapeId) {
  const shape = await dbOps.get('shapes', shapeId);
  if (!shape) return;
  
  showModal('编辑形状', `
    <div class="form-group">
      <label>形状符号</label>
      <input type="text" id="shapeSymbol" value="${shape.symbol}" maxlength="10">
    </div>
    <div class="form-group">
      <label>形状名称</label>
      <input type="text" id="shapeName" value="${shape.name}">
    </div>
    <div class="form-group">
      <label>形状描述</label>
      <input type="text" id="shapeDesc" value="${shape.description || ''}">
    </div>
  `, async () => {
    const symbol = document.getElementById('shapeSymbol').value.trim();
    const name = document.getElementById('shapeName').value.trim();
    const desc = document.getElementById('shapeDesc').value.trim();
    
    if (!symbol || !name) {
      showToast('请填写符号和名称');
      return false;
    }
    
    await mapDB.updateShape(shapeId, { symbol, name, description: desc });
    showToast('形状更新成功');
    renderContent();
    return true;
  });
}

/**
 * 确认删除形状
 */
async function confirmDeleteShape(shapeId, symbol) {
  const confirmed = await showConfirm('删除形状', `确定要删除形状 "${symbol}" 吗？这将同时删除其下所有门位置和地图。`);
  if (confirmed) {
    await mapDB.deleteShape(shapeId);
    showToast('形状已删除');
    renderContent();
  }
}

/**
 * 显示添加门位置模态框
 */
function showAddDoorModal(shapeId) {
  showModal('添加门位置', `
    <div class="form-group">
      <label>门位置名称</label>
      <input type="text" id="doorName" placeholder="如: 侧门在上">
    </div>
  `, async () => {
    const name = document.getElementById('doorName').value.trim();
    
    if (!name) {
      showToast('请填写门位置名称');
      return false;
    }
    
    await mapDB.addDoorPosition(shapeId, name);
    showToast('门位置添加成功');
    renderContent();
    return true;
  });
}

/**
 * 显示编辑门位置模态框
 */
async function showEditDoorModal(doorId) {
  const door = await dbOps.get('doorPositions', doorId);
  if (!door) return;
  
  showModal('编辑门位置', `
    <div class="form-group">
      <label>门位置名称</label>
      <input type="text" id="doorName" value="${door.positionName}">
    </div>
  `, async () => {
    const name = document.getElementById('doorName').value.trim();
    
    if (!name) {
      showToast('请填写门位置名称');
      return false;
    }
    
    await mapDB.updateDoorPosition(doorId, { positionName: name });
    showToast('门位置更新成功');
    renderContent();
    return true;
  });
}

/**
 * 确认删除门位置
 */
async function confirmDeleteDoor(doorId, name) {
  const confirmed = await showConfirm('删除门位置', `确定要删除 "${name}" 吗？这将同时删除其下所有地图。`);
  if (confirmed) {
    await mapDB.deleteDoorPosition(doorId);
    showToast('门位置已删除');
    renderContent();
  }
}

/**
 * 显示添加地图模态框
 */
function showAddMapModal(doorPositionId, shapeSymbol, doorName) {
  showModal('添加地图', `
    <div class="form-group">
      <label>地图名称</label>
      <input type="text" id="mapName" placeholder="如: 右路">
    </div>
    <div class="form-group">
      <label>选择图片</label>
      <input type="file" id="mapImage" accept="image/*">
      <div class="image-preview" id="imagePreview"></div>
    </div>
  `, async () => {
    const name = document.getElementById('mapName').value.trim();
    const fileInput = document.getElementById('mapImage');
    
    if (!name) {
      showToast('请填写地图名称');
      return false;
    }
    
    if (!fileInput.files[0]) {
      showToast('请选择图片');
      return false;
    }
    
    const file = fileInput.files[0];
    const imageData = await compressImage(file);
    const thumbnail = await generateThumbnail(file);
    
    await mapDB.addMap(doorPositionId, name, imageData, thumbnail);
    showToast('地图添加成功');
    renderContent();
    return true;
  }, () => {
    // 图片预览
    const fileInput = document.getElementById('mapImage');
    const preview = document.getElementById('imagePreview');
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          preview.innerHTML = `<img src="${e.target.result}" alt="预览">`;
        };
        reader.readAsDataURL(file);
      }
    });
  });
}

/**
 * 显示编辑地图模态框
 */
async function showEditMapModal(mapId) {
  const map = await dbOps.get('maps', mapId);
  if (!map) return;
  
  const thumbUrl = map.thumbnail ? URL.createObjectURL(map.thumbnail) : 
                   (map.imageData ? URL.createObjectURL(map.imageData) : '');
  
  showModal('编辑地图', `
    <div class="form-group">
      <label>地图名称</label>
      <input type="text" id="mapName" value="${map.name}">
    </div>
    <div class="form-group">
      <label>当前图片</label>
      <div class="image-preview">
        <img src="${thumbUrl}" alt="当前图片">
      </div>
    </div>
    <div class="form-group">
      <label>更换图片（可选）</label>
      <input type="file" id="mapImage" accept="image/*">
      <div class="image-preview" id="imagePreview"></div>
    </div>
  `, async () => {
    const name = document.getElementById('mapName').value.trim();
    const fileInput = document.getElementById('mapImage');
    
    if (!name) {
      showToast('请填写地图名称');
      return false;
    }
    
    const updates = { name };
    
    if (fileInput.files[0]) {
      const file = fileInput.files[0];
      updates.imageData = await compressImage(file);
      updates.thumbnail = await generateThumbnail(file);
    }
    
    await mapDB.updateMap(mapId, updates);
    showToast('地图更新成功');
    renderContent();
    return true;
  }, () => {
    // 图片预览
    const fileInput = document.getElementById('mapImage');
    const preview = document.getElementById('imagePreview');
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          preview.innerHTML = `<img src="${e.target.result}" alt="预览">`;
        };
        reader.readAsDataURL(file);
      }
    });
  });
}

/**
 * 确认删除地图
 */
async function confirmDeleteMap(mapId, name) {
  const confirmed = await showConfirm('删除地图', `确定要删除地图 "${name}" 吗？`);
  if (confirmed) {
    await mapDB.deleteMap(mapId);
    showToast('地图已删除');
    renderContent();
  }
}

/**
 * 通用模态框
 */
function showModal(title, content, onConfirm, onOpen = null) {
  const modal = document.createElement('div');
  modal.className = 'form-modal';
  modal.innerHTML = `
    <div class="form-modal-content">
      <div class="form-modal-header">
        <h3>${title}</h3>
        <span class="form-modal-close">&times;</span>
      </div>
      <div class="form-modal-body">
        ${content}
      </div>
      <div class="form-modal-footer">
        <button class="btn btn-secondary" id="modalCancel">取消</button>
        <button class="btn btn-primary" id="modalConfirm">确定</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 绑定事件
  modal.querySelector('.form-modal-close').onclick = () => modal.remove();
  modal.querySelector('#modalCancel').onclick = () => modal.remove();
  modal.querySelector('#modalConfirm').onclick = async () => {
    const result = await onConfirm();
    if (result !== false) {
      modal.remove();
    }
  };
  
  // 点击背景关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  // 打开后回调
  if (onOpen) {
    setTimeout(onOpen, 0);
  }
}

/**
 * 设置事件监听
 */
function setupEventListeners() {
  // 搜索框
  document.getElementById('searchBox').addEventListener('input', function() {
    setSearch(this.value);
  });
  
  // 筛选按钮
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      setFilter(this.dataset.filter);
    });
  });
  
  // 视图切换
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      switchView(this.dataset.view);
    });
  });
  
  // 键盘事件
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      // 关闭画廊
      closeGallery();
      // 关闭所有表单模态框
      document.querySelectorAll('.form-modal').forEach(m => m.remove());
    }
  });
}

/**
 * 初始化应用
 */
async function initApp() {
  try {
    // 初始化数据库
    await openDB();
    await mapDB.initDefaultData();
    
    // 设置事件监听
    setupEventListeners();
    
    // 渲染内容
    await renderContent();
    
    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('Service Worker 注册成功');
      }).catch(err => {
        console.log('Service Worker 注册失败:', err);
      });
    }
  } catch (err) {
    console.error('初始化失败:', err);
    showToast('初始化失败，请刷新重试');
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp);