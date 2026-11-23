export const PAGE_LIMIT = 20;

export const ROLE_OPTIONS = [
    { value: '',          label: 'All Roles'  },
    { value: 'user',      label: 'User'       },
    { value: 'promoter',  label: 'Promoter'   },
    { value: 'sub_admin', label: 'Sub Admin'  },
    { value: 'admin',     label: 'Admin'      },
    { value: 'bot',       label: 'Bot'        },
];

export const STATUS_OPTIONS = [
    { value: '',         label: 'All Status' },
    { value: 'active',   label: 'Active'     },
    { value: 'blocked',  label: 'Blocked'    },
    { value: 'inactive', label: 'Inactive'   },
    { value: 'pending',  label: 'Pending'    },
];

export const VERIFIED_OPTIONS = [
    { value: '',           label: 'Any Verification' },
    { value: 'verified',   label: 'Verified'         },
    { value: 'unverified', label: 'Unverified'       },
];

export const ACTIVE_OPTIONS = [
    { value: '',         label: 'Any Active State' },
    { value: 'active',   label: 'Active'           },
    { value: 'inactive', label: 'Inactive'         },
];

export const HAS_REFERRAL_OPTIONS = [
    { value: '',    label: 'All Users'     },
    { value: 'yes', label: 'Referred'      },
    { value: 'no',  label: 'Not Referred'  },
];

export const SORT_OPTIONS = [
    { value: 'createdAt',   label: 'Joined Date' },
    { value: 'displayName', label: 'Name'        },
    { value: 'email',       label: 'Email'       },
    { value: 'status',      label: 'Status'      },
];

export const DEFAULT_FIELDS = { firstName: '', lastName: '', email: '', phone: '' };

export const DEFAULT_PARAMS = {
    page: 1, limit: PAGE_LIMIT,
    firstName: '', lastName: '', email: '', phone: '',
    status: '', verified: '', active: '', role: '',
    fromDate: '', toDate: '',
    /* Referral filters */
    hasReferral: '', referralCode: '', referredBy: '',
    referralFrom: '', referralTo: '',
    sortBy: 'createdAt', sortDir: 'desc',
};
