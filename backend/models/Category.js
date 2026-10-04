const mongoose = require('mongoose');
const slugify = require('../utils/slugify');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Category name is required'], trim: true, maxlength: 60 },
    slug: { type: String, unique: true, lowercase: true, index: true },
    description: { type: String, trim: true, maxlength: 400, default: '' },
    image: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.pre('validate', async function (next) {
  try {
    if (this.name && (!this.slug || this.isModified('name'))) {
      const base = slugify(this.name);
      const exists = await mongoose.model('Category').exists({ slug: base, _id: { $ne: this._id } });
      this.slug = exists && this.isNew ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base;
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Category', categorySchema);
