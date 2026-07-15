// models/ProductTag.js
const mongoose = require('mongoose');
const ProductTagSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  image: { type: String, required: true },
  type: { type: String },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('ProductTag', ProductTagSchema);