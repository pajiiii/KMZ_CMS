// models/HomeTag.js
const mongoose = require('mongoose');
const HomeTagSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  image: { type: String, required: true },
  description: { type: String },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('HomeTag', HomeTagSchema);