import mongoose from 'mongoose';

const tripMembershipSchema = new mongoose.Schema(
  {
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },
    traveller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'withdrawn'],
      default: 'pending',
      required: true,
      index: true,
    },
    message: {
      type: String,
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
      default: '',
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    decisionReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Decision reason cannot exceed 500 characters'],
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Enforce unique trip/traveller combination at database level to prevent duplicate requests
tripMembershipSchema.index({ trip: 1, traveller: 1 }, { unique: true });

export const TripMembership = mongoose.model('TripMembership', tripMembershipSchema);
