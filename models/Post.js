const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 300 },
    link: { type: String, required: true, trim: true, unique: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tag: { type: [String], default: [], index: true },
    clicks: { type: Number, default: 0, min: 0 },
    source: { type: String, trim: true, maxlength: 80 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Post', postSchema);
