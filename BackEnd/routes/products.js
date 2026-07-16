const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// 中英文分类映射（URL 用英文 key，数据库存中文值）
const CATEGORY_MAP = {
  'keyboard': '键盘', 'mouse': '鼠标', 'earphone': '耳机',
  'speaker': '音箱', 'camera': '相机'
};

// 【GET】查询所有产品（供前端展示 + 支持 ?category= 筛选）
router.get('/', async (req, res) => {
  try {
    const filter = {};
    // 支持 ?category=keyboard → 映射为中文分类名过滤
    if (req.query.category) {
      const mapped = CATEGORY_MAP[req.query.category];
      filter.category = mapped || req.query.category;
      console.log('[products] 筛选分类:', req.query.category, '→', filter.category);
    }
    console.log('[products] 查询 filter:', JSON.stringify(filter));
    const products = await Product.find(filter).sort({ createdAt: -1 });
    console.log('[products] 返回数量:', products.length);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 【POST】新增产品（供后台管理上传）
router.post('/', async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    const saved = await newProduct.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;