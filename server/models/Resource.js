const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Resource title is required'],
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  grade: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Resource content is required']
  },
  // Pre-computed chunks with embeddings for RAG retrieval
  chunks: [{
    text: {
      type: String,
      required: true
    },
    embedding: {
      type: [Number],
      required: true
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient metadata-based filtering before vector search
resourceSchema.index({ subject: 1, grade: 1 });

module.exports = mongoose.model('Resource', resourceSchema);
