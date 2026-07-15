const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// 【GET】查询所有产品（供前端首页展示）
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products); // 这就是 ◄── 返回 JSON 数据 给前端
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