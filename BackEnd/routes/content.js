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
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
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
        return res.status(400).json({ error: '文件不能超过 200MB' });
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

// ===== 产品名称查询（供 admin 对照表 + 前端页面使用） =====
// ⚠️ 必须放在 GET /:type/:id 前面，避免 /products/search 被 /:type/:id 抢先匹配

// 按 productId 或 name 搜索产品
router.get('/products/search', async (req, res) => {
  const { q, id } = req.query;
  try {
    let filter = {};
    if (id) {
      // 精确按 productId 查找
      filter.productId = id;
    } else if (q) {
      // 模糊搜索：匹配 productId 或 name
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

// 获取指定类型的数据（支持 ?category= 筛选 product / product-tag）
router.get('/:type', async (req, res) => {
  const Model = collections[req.params.type];
  if (!Model) return res.status(400).json({ error: '无效的数据类型' });
  try {
    const filter = {};

    // 🔥 支持 ?category=keyboard 按分类筛选
    if (req.query.category) {
      const catMap = { 'keyboard': '键盘', 'mouse': '鼠标', 'earphone': '耳机', 'speaker': '音箱', 'camera': '相机' };
      const mapped = catMap[req.query.category] || req.query.category;

      if (req.params.type === 'product') {
        filter.category = mapped;              // Product 模型用 category 字段
      } else if (req.params.type === 'product-tag') {
        filter.type = mapped;                  // ProductTag 模型用 type 字段
      }
    }

    const data = await Model.find(filter).sort({ order: 1, createdAt: -1 });
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
    console.log('[Content] POST /' + req.params.type + ' 保存成功, _id:', saved._id);
    res.status(201).json(saved);
  } catch (err) {
    console.error('[Content] POST /' + req.params.type + ' 保存失败:', err.message);
    // Mongoose 验证错误时返回更友好的提示
    if (err.name === 'ValidationError') {
      const fields = Object.keys(err.errors).join(', ');
      return res.status(400).json({ error: '字段验证失败: ' + fields + ' — ' + err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// ===== 辅助函数：递归提取文档中所有 /uploads/ 开头的文件路径 =====
function getUploadPaths(doc) {
  if (!doc) return [];
  const paths = [];
  const docObj = doc.toObject ? doc.toObject() : doc;

  function collect(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const val of Object.values(obj)) {
      if (typeof val === 'string' && val.startsWith('/uploads/')) {
        paths.push(val);
      } else if (Array.isArray(val)) {
        val.forEach(item => collect(item));
      } else if (typeof val === 'object' && val !== null) {
        collect(val);
      }
    }
  }

  collect(docObj);
  return [...new Set(paths)]; // 去重
}

// ===== 辅助函数：从磁盘删除文件 =====
function deleteUploadedFiles(filePaths) {
  const uploadDir = path.join(__dirname, '..', 'uploads');
  for (const urlPath of filePaths) {
    const filename = path.basename(urlPath);
    const fullPath = path.join(uploadDir, filename);
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log('[Cleanup] 🗑️ 已删除磁盘文件:', filename);
      } else {
        console.log('[Cleanup] ⚠️ 文件不存在，跳过:', filename);
      }
    } catch (err) {
      console.error('[Cleanup] ❌ 删除文件失败:', filename, err.message);
    }
  }
}

// 删除指定类型的数据（同时清理关联的上传文件）
router.delete('/:type/:id', async (req, res) => {
  const Model = collections[req.params.type];
  if (!Model) return res.status(400).json({ error: '无效的数据类型' });
  try {
    // 先查找记录，获取文件路径后再删除
    const doc = await Model.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: '未找到' });

    // 清理关联的 /uploads/ 文件
    const uploadPaths = getUploadPaths(doc);
    if (uploadPaths.length > 0) {
      console.log('[Content] DELETE 清理 ' + uploadPaths.length + ' 个文件:', uploadPaths);
      deleteUploadedFiles(uploadPaths);
    }

    // 删除数据库记录
    await Model.findByIdAndDelete(req.params.id);
    res.json({ message: '删除成功', cleanedFiles: uploadPaths.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新指定类型的数据（编辑功能）
router.put('/:type/:id', async (req, res) => {
  const Model = collections[req.params.type];
  if (!Model) return res.status(400).json({ error: '无效的数据类型' });
  try {
    const updated = await Model.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',  // 返回更新后的文档（替代已弃用的 new: true）
      runValidators: true       // 执行 Mongoose 验证
    });
    if (!updated) return res.status(404).json({ error: '未找到' });
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