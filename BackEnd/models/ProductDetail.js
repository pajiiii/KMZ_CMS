// models/ProductDetail.js
const mongoose = require('mongoose');
const ProductDetailSchema = new mongoose.Schema({
  productId: { type: String, required: true, unique: true },
  image: { type: String, required: true },
  buyLink1: { type: String },
  buyLink2: { type: String },
  buyLink3: { type: String },
  buyLink4: { type: String },
  buyLink5: { type: String },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('ProductDetail', ProductDetailSchema);