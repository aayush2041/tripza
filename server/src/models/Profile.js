import mongoose from 'mongoose';

const verificationSubSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['unverified', 'pending_review', 'verified', 'rejected'],
      default: 'unverified',
      index: true,
    },
    submittedAt: {
      type: Date,
      default: null,
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
    rejectionReason: {
      type: String,
      default: null,
      maxlength: 500,
    },
    reviewNotes: {
      type: String,
      default: null,
      maxlength: 1000,
    },
  },
  { _id: false }
);

const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    profilePhotoUrl: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2048, 'Photo URL is too long'],
    },
    bio: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    homeCity: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Home city cannot exceed 100 characters'],
    },
    travelInterests: {
      type: [String],
      default: [],
      validate: [
        (val) => val.length <= 20,
        'Cannot specify more than 20 travel interests',
      ],
    },
    languages: {
      type: [String],
      default: [],
      validate: [
        (val) => val.length <= 10,
        'Cannot specify more than 10 languages',
      ],
    },
    verification: {
      type: verificationSubSchema,
      default: () => ({ status: 'unverified' }),
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

/**
 * Returns a score from 0 to 100 representing profile completeness.
 */
profileSchema.virtual('completenessPercentage').get(function () {
  let score = 20; // 20% for basic name registration
  if (this.bio && this.bio.trim().length > 10) score += 20;
  if (this.homeCity && this.homeCity.trim().length > 0) score += 15;
  if (this.travelInterests && this.travelInterests.length > 0) score += 15;
  if (this.languages && this.languages.length > 0) score += 10;
  if (this.profilePhotoUrl && this.profilePhotoUrl.trim().length > 0) score += 20;
  return Math.min(100, score);
});

/**
 * Serializes profile for public consumption without leaking private review metadata.
 */
profileSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    userId: this.user,
    fullName: this.fullName,
    bio: this.bio,
    homeCity: this.homeCity,
    travelInterests: this.travelInterests,
    languages: this.languages,
    profilePhotoUrl: this.profilePhotoUrl,
    verificationStatus: this.verification?.status || 'unverified',
    completenessPercentage: this.completenessPercentage,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Profile = mongoose.model('Profile', profileSchema);
