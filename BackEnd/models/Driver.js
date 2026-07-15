// models/Driver.js
const mongoose = require('mongoose');
const DriverSchema = new mongoose.Schema({
  type: { type: String, required: true },       // keyboard / mouse / headset
  name: { type: String, required: true },
  version: { type: String, default: '' },
  description: { type: String, default: '' },
  file: { type: String, required: true },        // 驱动文件下载链接
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Driver', DriverSchema);
