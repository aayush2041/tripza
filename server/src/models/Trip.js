import mongoose from 'mongoose';

const itineraryItemSchema = new mongoose.Schema(
  {
    day: {
      type: Number,
      required: true,
      min: 1,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    activities: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Trip title is required'],
      trim: true,
      minlength: [3, 'Trip title must be at least 3 characters'],
      maxlength: [120, 'Trip title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Trip description is required'],
      trim: true,
      minlength: [10, 'Trip description must be at least 10 characters'],
      maxlength: [3000, 'Trip description cannot exceed 3000 characters'],
    },
    startingCity: {
      type: String,
      required: [true, 'Starting city is required'],
      trim: true,
      maxlength: [100, 'Starting city cannot exceed 100 characters'],
      index: true,
    },
    meetingPoint: {
      type: String,
      required: [true, 'Meeting point is required'],
      trim: true,
      maxlength: [200, 'Meeting point cannot exceed 200 characters'],
    },
    destination: {
      type: String,
      required: [true, 'Destination is required'],
      trim: true,
      maxlength: [100, 'Destination cannot exceed 100 characters'],
      index: true,
    },
    intermediateStops: {
      type: [String],
      default: [],
      validate: [
        (val) => val.length <= 15,
        'Cannot have more than 15 intermediate stops',
      ],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      validate: {
        validator: function (val) {
          return !this.startDate || val >= this.startDate;
        },
        message: 'End date must be on or after start date',
      },
    },
    category: {
      type: String,
      required: [true, 'Trip category is required'],
      enum: [
        'trekking',
        'hiking',
        'backpacking',
        'road trip',
        'weekend getaway',
        'sightseeing',
        'camping',
        'other',
      ],
      index: true,
    },
    budget: {
      amount: {
        type: Number,
        required: [true, 'Budget amount is required'],
        min: [0, 'Budget amount cannot be negative'],
      },
      currency: {
        type: String,
        default: 'INR',
        enum: ['INR'],
      },
      included: {
        type: [String],
        default: [],
      },
      excluded: {
        type: [String],
        default: [],
      },
    },
    itinerary: {
      type: [itineraryItemSchema],
      default: [],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'Maximum group size is required'],
      min: [2, 'Maximum group size must be at least 2'],
      max: [50, 'Maximum group size cannot exceed 50'],
    },
    // Maintained transactionally; counts approved travelling members (excluding host)
    approvedMembersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    joinPolicy: {
      type: String,
      enum: ['approval_required', 'direct_join'],
      default: 'approval_required',
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled', 'completed'],
      default: 'draft',
      index: true,
    },
    organiser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Virtual: available spots for joiners (maxGroupSize - 1 for organiser - approvedMembersCount)
tripSchema.virtual('availableSpots').get(function () {
  const maxJoiners = Math.max(0, this.maxGroupSize - 1);
  return Math.max(0, maxJoiners - (this.approvedMembersCount || 0));
});

// Virtual: is the trip full?
tripSchema.virtual('isFull').get(function () {
  const maxJoiners = Math.max(0, this.maxGroupSize - 1);
  return (this.approvedMembersCount || 0) >= maxJoiners;
});

// Compound indexes for high-performance discovery queries
tripSchema.index({ status: 1, startDate: 1 });
tripSchema.index({ status: 1, destination: 1 });
tripSchema.index({ status: 1, startingCity: 1 });
tripSchema.index({ status: 1, category: 1 });
tripSchema.index({ status: 1, 'budget.amount': 1 });

export const Trip = mongoose.model('Trip', tripSchema);
