/**
 * IndexedDB 数据库操作封装
 * 用于存储地图形状、门位置、地图图片等数据
 */

const DB_NAME = 'MapViewerDB';
const DB_VERSION = 1;

// 数据库实例
let dbInstance = null;

/**
 * 打开数据库
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('无法打开数据库'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 创建地图形状表
      if (!db.objectStoreNames.contains('shapes')) {
        const shapeStore = db.createObjectStore('shapes', { keyPath: 'id', autoIncrement: true });
        shapeStore.createIndex('symbol', 'symbol', { unique: true });
        shapeStore.createIndex('name', 'name', { unique: false });
      }

      // 创建门位置表
      if (!db.objectStoreNames.contains('doorPositions')) {
        const doorStore = db.createObjectStore('doorPositions', { keyPath: 'id', autoIncrement: true });
        doorStore.createIndex('shapeId', 'shapeId', { unique: false });
        doorStore.createIndex('positionName', 'positionName', { unique: false });
      }

      // 创建地图图片表
      if (!db.objectStoreNames.contains('maps')) {
        const mapStore = db.createObjectStore('maps', { keyPath: 'id', autoIncrement: true });
        mapStore.createIndex('doorPositionId', 'doorPositionId', { unique: false });
        mapStore.createIndex('name', 'name', { unique: false });
        mapStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 创建设置表（用于存储应用配置）
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

/**
 * 通用事务操作
 */
function transaction(storeNames, mode = 'readonly') {
  return openDB().then(db => {
    return db.transaction(storeNames, mode);
  });
}

/**
 * 通用 CRUD 操作
 */
const dbOps = {
  // 添加数据
  add(storeName, data) {
    return transaction([storeName], 'readwrite').then(tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(storeName);
        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  },

  // 获取单条数据
  get(storeName, id) {
    return transaction([storeName]).then(tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(storeName);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  },

  // 获取所有数据
  getAll(storeName) {
    return transaction([storeName]).then(tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  },

  // 通过索引查询
  getByIndex(storeName, indexName, value) {
    return transaction([storeName]).then(tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  },

  // 更新数据
  update(storeName, data) {
    return transaction([storeName], 'readwrite').then(tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  },

  // 删除数据
  delete(storeName, id) {
    return transaction([storeName], 'readwrite').then(tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  },

  // 清空表
  clear(storeName) {
    return transaction([storeName], 'readwrite').then(tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  },

  // 计数
  count(storeName) {
    return transaction([storeName]).then(tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(storeName);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }
};

/**
 * 地图数据操作
 */
const mapDB = {
  // 获取所有地图数据（包含关联关系）
  async getAllMapData() {
    const shapes = await dbOps.getAll('shapes');
    const doorPositions = await dbOps.getAll('doorPositions');
    const maps = await dbOps.getAll('maps');

    // 组装数据
    return shapes.map(shape => ({
      ...shape,
      doors: doorPositions
        .filter(dp => dp.shapeId === shape.id)
        .map(dp => ({
          ...dp,
          maps: maps.filter(m => m.doorPositionId === dp.id)
        }))
    }));
  },

  // 添加形状
  async addShape(symbol, name, description = '') {
    return dbOps.add('shapes', { symbol, name, description });
  },

  // 添加门位置
  async addDoorPosition(shapeId, positionName) {
    return dbOps.add('doorPositions', { shapeId, positionName });
  },

  // 添加地图
  async addMap(doorPositionId, name, imageData, thumbnail = null) {
    return dbOps.add('maps', {
      doorPositionId,
      name,
      imageData,
      thumbnail,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  },

  // 删除形状（级联删除）
  async deleteShape(shapeId) {
    const doorPositions = await dbOps.getByIndex('doorPositions', 'shapeId', shapeId);
    for (const dp of doorPositions) {
      await this.deleteDoorPosition(dp.id);
    }
    return dbOps.delete('shapes', shapeId);
  },

  // 删除门位置（级联删除）
  async deleteDoorPosition(doorPositionId) {
    const maps = await dbOps.getByIndex('maps', 'doorPositionId', doorPositionId);
    for (const map of maps) {
      await dbOps.delete('maps', map.id);
    }
    return dbOps.delete('doorPositions', doorPositionId);
  },

  // 删除地图
  async deleteMap(mapId) {
    return dbOps.delete('maps', mapId);
  },

  // 更新地图
  async updateMap(mapId, updates) {
    const map = await dbOps.get('maps', mapId);
    if (!map) throw new Error('地图不存在');
    return dbOps.update('maps', { ...map, ...updates, updatedAt: new Date() });
  },

  // 更新形状
  async updateShape(shapeId, updates) {
    const shape = await dbOps.get('shapes', shapeId);
    if (!shape) throw new Error('形状不存在');
    return dbOps.update('shapes', { ...shape, ...updates });
  },

  // 更新门位置
  async updateDoorPosition(doorPositionId, updates) {
    const dp = await dbOps.get('doorPositions', doorPositionId);
    if (!dp) throw new Error('门位置不存在');
    return dbOps.update('doorPositions', { ...dp, ...updates });
  },

  // 获取统计信息
  async getStats() {
    const shapeCount = await dbOps.count('shapes');
    const doorCount = await dbOps.count('doorPositions');
    const mapCount = await dbOps.count('maps');
    return {
      shapes: shapeCount,
      doorPositions: doorCount,
      maps: mapCount
    };
  },

  // 搜索地图
  async searchMaps(query) {
    const allData = await this.getAllMapData();
    const lowerQuery = query.toLowerCase();
    
    const results = [];
    for (const shape of allData) {
      for (const door of shape.doors) {
        for (const map of door.maps) {
          if (
            map.name.toLowerCase().includes(lowerQuery) ||
            door.positionName.toLowerCase().includes(lowerQuery) ||
            shape.name.toLowerCase().includes(lowerQuery) ||
            shape.symbol.toLowerCase().includes(lowerQuery)
          ) {
            results.push({
              ...map,
              doorPosition: door,
              shape: shape
            });
          }
        }
      }
    }
    return results;
  },

  // 导出所有数据为 JSON
  async exportData() {
    const shapes = await dbOps.getAll('shapes');
    const doorPositions = await dbOps.getAll('doorPositions');
    const maps = await dbOps.getAll('maps');
    
    // 将 Blob 转换为 Base64
    const mapsWithBase64 = await Promise.all(maps.map(async (map) => {
      const imageDataBase64 = map.imageData ? await blobToBase64(map.imageData) : null;
      const thumbnailBase64 = map.thumbnail ? await blobToBase64(map.thumbnail) : null;
      return {
        ...map,
        imageData: imageDataBase64,
        thumbnail: thumbnailBase64
      };
    }));

    return {
      version: DB_VERSION,
      exportDate: new Date().toISOString(),
      shapes,
      doorPositions,
      maps: mapsWithBase64
    };
  },

  // 从 JSON 导入数据
  async importData(data) {
    // 清空现有数据
    await dbOps.clear('shapes');
    await dbOps.clear('doorPositions');
    await dbOps.clear('maps');

    // 导入形状
    for (const shape of data.shapes) {
      await dbOps.add('shapes', shape);
    }

    // 导入门位置
    for (const dp of data.doorPositions) {
      await dbOps.add('doorPositions', dp);
    }

    // 导入地图
    for (const map of data.maps) {
      const imageData = map.imageData ? await base64ToBlob(map.imageData) : null;
      const thumbnail = map.thumbnail ? await base64ToBlob(map.thumbnail) : null;
      await dbOps.add('maps', {
        ...map,
        imageData,
        thumbnail
      });
    }
  },

  // 初始化默认数据
  async initDefaultData() {
    const stats = await this.getStats();
    if (stats.shapes > 0) return; // 已有数据，不初始化

    const defaultShapes = [
      { symbol: '┏', name: '┏ 形地图', description: '左上直角地图' },
      { symbol: '┗', name: '┗ 形地图', description: '左下直角地图' },
      { symbol: '┣', name: '┣ 形地图', description: '左侧T形地图' },
      { symbol: '┳', name: '┳ 形地图', description: '上方T形地图' },
      { symbol: '▁┃━', name: '▁┃━ 形地图', description: '横竖交叉地图' },
      { symbol: '▃▃', name: '▃▃ 形地图', description: '双竖线地图' },
      { symbol: '▌', name: '▌ 形地图', description: '左侧竖线地图' },
      { symbol: '横Y', name: '横Y 形地图', description: '横向Y形地图' }
    ];

    for (const shape of defaultShapes) {
      await this.addShape(shape.symbol, shape.name, shape.description);
    }
  }
};

/**
 * 工具函数：Blob 转 Base64
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 工具函数：Base64 转 Blob
 */
function base64ToBlob(base64) {
  return new Promise((resolve, reject) => {
    // 处理 data URL 格式
    const parts = base64.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(parts[1] || parts[0]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    resolve(new Blob([u8arr], { type: mime }));
  });
}

/**
 * 工具函数：压缩图片
 */
function compressImage(file, maxWidth = 1920, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 等比缩放
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(blob);
        }, file.type || 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 工具函数：生成缩略图
 */
function generateThumbnail(file, size = 300) {
  return compressImage(file, size, 0.6);
}