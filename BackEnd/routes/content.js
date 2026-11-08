const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const HomeCarousel = require('../models/HomeCarousel');
const HomeTag = require('../models/HomeTag');
const HomeMiniCarousel = require('../models/HomeMiniCarousel');
const ProductTag = require('../models/ProductTag');
const ProductDetail = require('../models/ProductDetail');
const Product = require('../models/Product');
const Driver = require('../models/Driver');
const SocialPlatform = require('../models/SocialPlatform');

// ===== 内存缓存：5 分钟有效期，最多 200 个查询结果 =====
const apiCache = new Map();
const cacheVersions = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of apiCache) {
    if (now - entry.ts >= CACHE_TTL_MS) apiCache.delete(key);
  }
}

function getCache(key) {
  pruneCache();
  const entry = apiCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { apiCache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) {
  pruneCache();
  apiCache.delete(key);
  while (apiCache.size >= CACHE_MAX_ENTRIES) apiCache.delete(apiCache.keys().next().value);
  apiCache.set(key, { data, ts: Date.now() });
}
// 数据变更时清除对应类型的所有缓存
function clearCache(type) {
  cacheVersions.set(type, (cacheVersions.get(type) || 0) + 1);
  const prefix = '/api/content/' + type + '?';
  let count = 0;
  for (const key of apiCache.keys()) {
    if (key.startsWith(prefix)) { apiCache.delete(key); count++; }
  }
  if (count > 0) console.log('[Cache] 🧹 清除 ' + type + ' 缓存 ×' + count);
}
// 包装：查询 + 缓存
async function cachedFind(Model, cacheKey, filter = {}, sort = { order: 1, createdAt: -1 }) {
  const cached = getCache(cacheKey);
  if (cached !== null) { console.log('[Cache] ⚡ 命中:', cacheKey); return cached; }
  const type = cacheKey.split('?')[0].slice('/api/content/'.length);
  const version = cacheVersions.get(type) || 0;
  const data = await Model.find(filter).sort(sort);
  // 写操作期间发出的旧查询不能重新填入已经失效的缓存。
  if ((cacheVersions.get(type) || 0) === version) setCache(cacheKey, data);
  console.log('[Cache] 💾 写入:', cacheKey, '(' + data.length + ' 条)');
  return data;
}

// ---- 图片上传配置 ----
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i;
    cb(null, allowed.test(path.extname(file.originalname)));
  }
});

// 图片上传接口（带详细错误处理）
router.post('/upload', (req, res) => {
  upload.single('image')(req, res, (err) => {
    // Multer 错误处理
    if (err) {
      console.error('[Upload] 图片上传错误:', err.code || err.message || err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: '图片不能超过 10MB' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: '一次只能上传一张图片' });
      }
      if (err.message) {
        return res.status(400).json({ error: '上传失败: ' + err.message });
      }
      return res.status(500).json({ error: '服务器上传错误' });
    }
    if (!req.file) {
      console.error('[Upload] req.file 为空，可能是磁盘写入失败或文件格式不正确');
      return res.status(400).json({ error: '请选择图片文件（支持 jpg/png/gif/webp/svg/bmp），如已选择请检查磁盘空间和目录权限' });
    }
    // 使用相对路径（不以协议/主机开头），确保无论从 localhost 还是外网 IP 访问都能正常加载
    const url = `/uploads/${req.file.filename}`;
    console.log('[Upload] 图片上传成功:', url);
    res.json({ url, filename: req.file.filename });
  });
});

// 驱动文件上传配置
const driverUpload = multer({
  storage,
  limits: { fileSize: 300 * 1024 * 1024 }, // 300MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(zip|rar|exe|7z|gz|tar|dmg|pkg|msi|pdf)$/i;
    cb(null, allowed.test(path.extname(file.originalname)));
  }
});

// 驱动文件上传接口
router.post('/upload-driver', (req, res) => {
  driverUpload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: '文件不能超过 300MB' });
      }
      if (err.message) {
        return res.status(400).json({ error: '上传失败: ' + err.message });
      }
      return res.status(500).json({ error: '服务器上传错误' });
    }
    if (!req.file) {
      return res.status(400).json({ error: '请选择驱动文件（支持 zip/rar/exe/7z 等）' });
    }
    // 使用相对路径，确保无论从 localhost 还是外网 IP 访问都能正常加载
    const url = `/uploads/${req.file.filename}`;
    res.json({ url, filename: req.file.filename });
  });
});

// 所有集合映射
const collections = {
  'product': Product,
  'home-carousel': HomeCarousel,
  'home-tag': HomeTag,
  'home-mini-carousel': HomeMiniCarousel,
  'product-tag': ProductTag,
  'product-detail': ProductDetail,
  'driver': Driver,
  'social': SocialPlatform
};

// 小轮播区域总开关，必须先于 /:type/:id 注册。
router.get('/home-mini-carousel/settings', async (req, res) => {
  try {
    const settings = await HomeMiniCarousel.Settings.findById('global').lean();
    res.json({ enabled: settings?.enabled === true });
  } catch (err) {
    console.error('[MiniCarousel] 读取显示设置失败:', err.message);
    res.status(500).json({ error: '读取小轮播显示设置失败' });
  }
});

router.put('/home-mini-carousel/settings', async (req, res) => {
  if (typeof req.body?.enabled !== 'boolean') {
    return res.status(400).json({ error: '显示设置必须为布尔值' });
  }
  try {
    const settings = await HomeMiniCarousel.Settings.findByIdAndUpdate('global', {
      $set: { enabled: req.body.enabled }
    }, { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true });
    res.json({ enabled: settings.enabled === true });
  } catch (err) {
    console.error('[MiniCarousel] 保存显示设置失败:', err.message);
    res.status(500).json({ error: '保存小轮播显示设置失败' });
  }
});

// ===== 产品名称查询（供 admin 对照表 + 前端页面使用） =====
// ⚠️ 必须放在 GET /:type/:id 前面，避免 /products/search 被 /:type/:id 抢先匹配

// 按 productId 或 name 搜索产品
router.get('/products/search', async (req, res) => {
  const { q, id } = req.query;
  try {
    let filter = {};
    if (id) {
      filter.productId = id;
    } else if (q) {
      const regex = new RegExp(q, 'i');
      filter = { $or: [{ productId: regex }, { name: regex }] };
    }
    const data = await Product.find(filter).sort({ productId: 1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单条数据（用于编辑回填）— 必须放在 GET /:type 前面，避免 /:type 抢先匹配
router.get('/:type/:id', async (req, res) => {
  const Model = collections[req.params.type];
  if (!Model) return res.status(400).json({ error: '无效的数据类型' });
  try {
    const item = await Model.findById(req.params.id);
    if (!item) return res.status(404).json({ error: '未找到' });
    res.json(item);
  } catch (err) {
    console.error('[Content] GET /' + req.params.type + '/' + req.params.id + ' 查询失败:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 获取指定类型的数据（支持 ?category= + ?productId= 筛选，带缓存）
router.get('/:type', async (req, res) => {
  const Model = collections[req.params.type];
  if (!Model) return res.status(400).json({ error: '无效的数据类型' });
  try {
    const filter = {};

    // 🔥 支持 ?category=keyboard 按分类筛选
    if (req.query.category) {
      const catMap = { 'keyboard': '键盘', 'mouse': '鼠标', 'earphone': '耳机', 'speaker': '音箱', 'camera': '相机', 'accessory': '其他配件' };
      const mapped = catMap[req.query.category] || req.query.category;

      if (req.params.type === 'product') {
        filter.category = mapped;
      } else if (req.params.type === 'product-tag') {
        filter.type = mapped;
      }
    }

    // 🔥 支持 ?productId=H75 按产品 ID 筛选（用于产品详情页，避免拉取全部数据）
    if (req.query.productId) {
      filter.productId = req.query.productId;
    }

    // 只使用实际生效的筛选条件，忽略无关参数，避免制造重复缓存。
    const cacheKey = '/api/content/' + req.params.type + '?' + JSON.stringify(filter);
    const data = await cachedFind(Model, cacheKey, filter);
    console.log('[Content] GET /' + req.params.type + ' 返回 ' + data.length + ' 条');
    res.json(data);
  } catch (err) {
    console.error('[Content] GET /' + req.params.type + ' 查询失败:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 上传指定类型的数据
router.post('/:type', async (req, res) => {
  const Model = collections[req.params.type];
  if (!Model) return res.status(400).json({ error: '无效的数据类型' });
  try {
    console.log('[Content] POST /' + req.params.type + ' 请求体:', JSON.stringify(req.body).substring(0, 200));
    const newItem = new Model(req.body);
    const saved = await newItem.save();
    clearCache(req.params.type); // 数据变更，清除缓存
    console.log('[Content] POST /' + req.params.type + ' 保存成功, _id:', saved._id);
    res.status(201).json(saved);
  } catch (err) {
    console.error('[Content] POST /' + req.params.type + ' 保存失败:', err.message);
    if (err.name === 'ValidationError') {
      const fields = Object.keys(err.errors).join(', ');
      return res.status(400).json({ error: '字段验证失败: ' + fields + ' — ' + err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// 提取字符串、数组、嵌套对象及富文本中的上传文件引用，统一为本地路径。
function getUploadPaths(doc) {
  if (!doc) return [];
  const paths = [];
  const docObj = doc.toObject ? doc.toObject() : doc;

  function collect(obj) {
    if (typeof obj === 'string') {
      for (const match of obj.matchAll(/\/uploads\/[^?#\s"'<>\\)]+/gi)) {
        try {
          const normalized = path.posix.normalize(decodeURIComponent(match[0]).replace(/\\/g, '/'));
          if (normalized.slice(0, '/uploads/'.length).toLowerCase() !== '/uploads/') continue;
          const filename = normalized.slice('/uploads/'.length);
          if (!filename || filename === '.' || filename === '..' || /[\/\\\x00]/.test(filename)) continue;
          paths.push('/uploads/' + filename);
        } catch (_) { /* 无法确认的路径不参与自动删除 */ }
      }
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(collect);
    }
  }

  collect(docObj);
  return [...new Set(paths)]; // 去重
}

// 记录已删除后，检查所有内容集合；任一查询失败时保留全部候选文件。
async function deleteUploadedFiles(filePaths) {
  const referenced = new Set();
  try {
    for (const Model of Object.values(collections)) {
      const docs = await Model.find({}).lean();
      // 大小写差异也保守视为引用，兼容 Windows 文件系统。
      docs.forEach(doc => getUploadPaths(doc).forEach(url => referenced.add(url.toLowerCase())));
    }
  } catch (err) {
    console.error('[Cleanup] 引用检查失败，保留文件:', err.message);
    return { cleanedFiles: 0, cleanupPending: true };
  }
  const uploadRoot = path.resolve(__dirname, '..', 'uploads');
  let cleanedFiles = 0, cleanupPending = false;
  for (const urlPath of filePaths) {
    if (referenced.has(urlPath.toLowerCase())) continue;
    const filename = path.basename(urlPath);
    const fullPath = path.resolve(uploadRoot, filename);
    if (path.dirname(fullPath) !== uploadRoot) continue;
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        cleanedFiles++;
        console.log('[Cleanup] 🗑️ 已删除磁盘文件:', filename);
      } else {
        console.log('[Cleanup] ⚠️ 文件不存在，跳过:', filename);
      }
    } catch (err) {
      cleanupPending = true;
      console.error('[Cleanup] ❌ 删除文件失败:', filename, err.message);
    }
  }
  return { cleanedFiles, cleanupPending };
}

// 删除指定类型的数据（同时清理关联的上传文件）
router.delete('/:type/:id', async (req, res) => {
  const Model = collections[req.params.type];
  if (!Model) return res.status(400).json({ error: '无效的数据类型' });
  try {
    // 先成功删除数据库记录并取得原文档，避免数据库失败时已经删掉文件。
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: '未找到' });

    clearCache(req.params.type);
    // 仅清理这条记录涉及且其他记录已不再引用的文件。
    const uploadPaths = getUploadPaths(doc);
    const cleanup = uploadPaths.length ? await deleteUploadedFiles(uploadPaths) : { cleanedFiles: 0, cleanupPending: false };
    res.json({ message: cleanup.cleanupPending ? '记录已删除，部分文件保留待清理' : '删除成功', ...cleanup });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新指定类型的数据（编辑功能）
router.put('/:type/:id', async (req, res) => {
  const Model = collections[req.params.type];
  if (!Model) return res.status(400).json({ error: '无效的数据类型' });
  try {
    let updated;
    if (req.params.type === 'driver') {
      // 合并已有记录后执行文档校验，确保开关和地址一起验证（也支持部分更新）。
      updated = await Model.findById(req.params.id);
      if (!updated) return res.status(404).json({ error: '未找到' });
      updated.set(req.body);
      await updated.save();
    } else {
      updated = await Model.findByIdAndUpdate(req.params.id, req.body, {
        returnDocument: 'after',
        runValidators: true
      });
    }
    if (!updated) return res.status(404).json({ error: '未找到' });
    clearCache(req.params.type); // 数据变更，清除缓存
    console.log('[Content] PUT /' + req.params.type + '/' + req.params.id + ' 更新成功');
    res.json(updated);
  } catch (err) {
    console.error('[Content] PUT 更新失败:', err.message);
    if (err.name === 'ValidationError') {
      const fields = Object.keys(err.errors).join(', ');
      return res.status(400).json({ error: '字段验证失败: ' + fields + ' — ' + err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
