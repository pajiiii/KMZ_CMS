// models/HomeMiniCarousel.js
// 主页小型叠加轮播 — 产品穿出卡片效果
const mongoose = require('mongoose');
const HomeMiniCarouselSchema = new mongoose.Schema({
  productId: { type: String, required: true },   // 关联产品 ID
  bgImage: { type: String, required: true },      // 底层背景素材 URL
  fgImage: { type: String, required: true },      // 上层产品素材 URL（透明 PNG，建议高于卡片）
  name: { type: String },                         // 产品名称（优先使用此字段，若无则通过 productId 映射查找）
  description: { type: String },                  // 描述小字
  order: { type: Number, default: 0 },            // 排序，越小越靠前
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('HomeMiniCarousel', HomeMiniCarouselSchema);

// 区域总开关单独保存，不修改轮播条目；未配置时默认关闭。
const HomeMiniCarouselSettingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  enabled: { type: Boolean, default: false }
});
module.exports.Settings = mongoose.model('HomeMiniCarouselSettings', HomeMiniCarouselSettingsSchema, 'home_mini_carousel_settings');
