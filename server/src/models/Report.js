import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter is required'],
      index: true,
    },
    targetType: {
      type: String,
      enum: ['user', 'trip', 'message'],
      required: [true, 'Target type is required'],
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Target ID is required'],
      index: true,
    },
    category: {
      type: String,
      enum: [
        'harassment',
        'spam',
        'misleading',
        'impersonation',
        'unsafe_conduct',
        'inappropriate_content',
        'other',
      ],
      required: [true, 'Report category is required'],
      index: true,
    },
    explanation: {
      type: String,
      trim: true,
      maxlength: [1000, 'Explanation cannot exceed 1000 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['open', 'under_review', 'action_taken', 'dismissed'],
      default: 'open',
      index: true,
    },
    moderatorNotes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Moderator notes cannot exceed 2000 characters'],
      default: '',
      select: false, // Hidden from regular user serialization
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolutionAction: {
      type: String,
      enum: ['none', 'warning_issued', 'content_removed', 'user_suspended', 'dismissed'],
      default: 'none',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        // Never expose moderator notes to regular API responses unless explicitly requested
        if (ret.moderatorNotes === undefined || ret.moderatorNotes === '') {
          delete ret.moderatorNotes;
        }
        return ret;
      },
    },
  }
);

// Compound indexes for report discovery, moderation queues, and duplicate prevention
reportSchema.index({ targetType: 1, targetId: 1 });
reportSchema.index({ reporter: 1, targetType: 1, targetId: 1, status: 1 });
reportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model('Report', reportSchema);
