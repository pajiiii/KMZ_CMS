const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const HomeCarousel = require('../models/HomeCarousel');
const HomeTag = require('../models/HomeTag');
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
      return res.status(400).json({ error: '请选择图片文件（支持 jpg/png/gif/webp/svg/bmp）' });
    }
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
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
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ url, filename: req.file.filename });
  });
});

// 所有集合映射
const collections = {
  'product': Product,
  'home-carousel': HomeCarousel,
  'home-tag': HomeTag,
  'product-tag': ProductTag,
  'product-detail': ProductDetail,
  'driver': Driver,
  'social': SocialPlatform
};

// 获取指定类型的数据
router.get('/:type', async (req, res) => {
  const Model = collections[req.params.type];
  if (!Model) return res.status(400).json({ error: '无效的数据类型' });
  try {
    const data = await Model.find().sort({ order: 1, createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 上传指定类型的数据
router.post('/:type', async (req, res) => {
  const Model = collections[req.params.type];
  if (!Model) return res.status(400).json({ error: '无效的数据类型' });
  try {
    const newItem = new Model(req.body);
    const saved = await newItem.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 删除指定类型的数据
router.delete('/:type/:id', async (req, res) => {
  const Model = collections[req.params.type];
  if (!Model) return res.status(400).json({ error: '无效的数据类型' });
  try {
    const deleted = await Model.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: '未找到' });
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 产品名称查询（供 admin 对照表 + 前端页面使用） =====

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

module.exports = router;