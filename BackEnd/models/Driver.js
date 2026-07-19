// models/Driver.js
const mongoose = require('mongoose');
//引入mongoose库，这个是一个用于在Node.js中与MongoDB数据库进行交互的对象数据建模（ODM）库。
// 它提供了一个直观的方式来定义数据模型、验证数据、执行查询等。
const DriverSchema = new mongoose.Schema({
  type: { type: String, required: true },       // 键盘 / 鼠标 / 耳机
  model: { type: String, required: true },       // 型号，如 H75 / M7 / K9pAI
  name: { type: String, required: true },        // 驱动名称
  version: { type: String, default: '' },
  description: { type: String, default: '' },
  file: { type: String, required: true },        // 驱动文件下载链接
  webDriverLink: { type: String, default: '' },  // 网页版驱动链接（可选）
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Driver', DriverSchema);
