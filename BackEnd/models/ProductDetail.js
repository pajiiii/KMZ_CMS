// models/ProductDetail.js
const mongoose = require('mongoose');

// 颜色子文档 Schema（嵌入式，每个产品可有多个颜色选项）
const ColorVariantSchema = new mongoose.Schema({
  name: { type: String, required: true },   // 颜色名称，如"星空黑"
  image: { type: String, required: true }   // 该颜色对应的产品图片 URL
}, { _id: true });  // Mongoose 子文档 ID；当前后台按完整颜色列表保存。

const ProductDetailSchema = new mongoose.Schema({
  productId: { type: String, required: true, unique: true },
  image: { type: String, required: true },          // 默认主图（兼容旧数据，colors 为空时使用）
  colors: { type: [ColorVariantSchema], default: [] }, // 多颜色列表
  introduction: { type: String, default: '' },       // 产品介绍（富文本 HTML）
  buyLink1: { type: String },
  buyLink2: { type: String },
  buyLink3: { type: String },
  buyLink4: { type: String },
  buyLink5: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ProductDetail', ProductDetailSchema);
