// models/SocialPlatform.js
const mongoose = require('mongoose');
const SocialPlatformSchema = new mongoose.Schema({
  name: { type: String, required: true },        // 平台名称（微博/抖音/B站/小红书...）
  qrImage: { type: String, required: true },      // 二维码图片URL
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('SocialPlatform', SocialPlatformSchema);
