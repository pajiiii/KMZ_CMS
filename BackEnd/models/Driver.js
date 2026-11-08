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
  // 不设开关默认值，旧记录在保存时根据已有地址推断。
  hasClient: { type: Boolean },
  hasWeb: { type: Boolean },
  file: { type: String, default: '', trim: true }, // 驱动文件下载链接
  webDriverLink: { type: String, default: '', trim: true }, // 网页版驱动链接
  createdAt: { type: Date, default: Date.now }
});

DriverSchema.pre('validate', function () {
  const file = (this.file || '').trim();
  const webLink = (this.webDriverLink || '').trim();
  if (typeof this.hasClient !== 'boolean') this.hasClient = Boolean(file);
  if (typeof this.hasWeb !== 'boolean') this.hasWeb = Boolean(webLink);

  if (this.hasClient && !file) {
    this.invalidate('file', '提供客户端时必须上传驱动文件');
  }
  if (this.hasWeb) {
    try {
      const url = new URL(webLink);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('无效协议');
    } catch (_) {
      this.invalidate('webDriverLink', '提供网页端时必须填写有效的 http:// 或 https:// 链接');
    }
  }
});

module.exports = mongoose.model('Driver', DriverSchema);
