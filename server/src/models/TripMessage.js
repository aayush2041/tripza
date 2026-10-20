import mongoose from 'mongoose';

/**
 * TripMessage Schema
 * Real-time and persisted chat message records for private Trip Rooms.
 * Only accessible to verified trip hosts and confirmed members.
 */
const tripMessageSchema = new mongoose.Schema(
  {
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: [true, 'Trip reference is required'],
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender reference is required'],
      index: true,
    },
    message: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true,
      minlength: [1, 'Message cannot be empty'],
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    editedAt: {
      type: Date,
      default: null,
    },
    moderation: {
      status: {
        type: String,
        enum: ['visible', 'reported', 'hidden', 'deleted'],
        default: 'visible',
      },
      reportedBy: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      reportReason: {
        type: String,
        trim: true,
        maxlength: 500,
      },
      deletedAt: {
        type: Date,
        default: null,
      },
      deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for performant chronological and cursor pagination
tripMessageSchema.index({ trip: 1, createdAt: -1 });
tripMessageSchema.index({ trip: 1, _id: -1 });

export const TripMessage = mongoose.model('TripMessage', tripMessageSchema);
export default TripMessage;
