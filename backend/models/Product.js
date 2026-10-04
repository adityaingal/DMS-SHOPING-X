const mongoose = require('mongoose');
const slugify = require('../utils/slugify');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true, minlength: 2, maxlength: 160 },
    slug: { type: String, unique: true, index: true },
    description: { type: String, required: [true, 'Description is required'], trim: true, maxlength: 5000 },
    price: { type: Number, required: [true, 'Price is required'], min: [0, 'Price cannot be negative'] },
    discountPrice: {
      type: Number,
      min: 0,
      default: null,
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true;
          return v > 0 && v < this.price;
        },
        message: 'Discount price must be lower than the price',
      },
    },
    images: { type: [String], default: [] },
    category: { type: String, required: [true, 'Category is required'], lowercase: true, trim: true, index: true },
    brand: { type: String, required: [true, 'Brand is required'], trim: true, index: true },
    stock: { type: Number, required: true, default: 0, min: [0, 'Stock cannot be negative'] },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    featured: { type: Boolean, default: false, index: true },
    soldCount: { type: Number, default: 0, min: 0 },
    isSample: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productSchema.pre('validate', async function (next) {
  try {
    if (!this.slug && this.name) {
      const base = slugify(this.name);
      const exists = await mongoose.model('Product').exists({ slug: base });
      this.slug = exists ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base;
    }
    if (this.discountPrice !== null && this.discountPrice !== undefined && this.discountPrice >= this.price) {
      this.discountPrice = null;
    }
    next();
  } catch (err) {
    next(err);
  }
});

productSchema.index({ name: 'text', brand: 'text', description: 'text' });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ rating: -1 });

productSchema.virtual('effectivePrice').get(function () {
  return this.discountPrice != null ? this.discountPrice : this.price;
});

productSchema.virtual('discountPercent').get(function () {
  if (this.discountPrice == null || !this.price) return 0;
  return Math.round(((this.price - this.discountPrice) / this.price) * 100);
});

module.exports = mongoose.model('Product', productSchema);
