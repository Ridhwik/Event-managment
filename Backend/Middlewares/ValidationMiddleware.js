const { body, validationResult } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Event creation validation
const validateEventCreation = [
  body('accountNumber')
    .trim()
    .notEmpty()
    .withMessage('Account number is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Account number must be between 1 and 50 characters'),

  body('activityName')
    .trim()
    .notEmpty()
    .withMessage('Activity name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Activity name must be between 1 and 100 characters'),

  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid date'),

  body('closingDate')
    .optional()
    .isISO8601()
    .withMessage('Closing date must be a valid date'),

  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),

  body('budget')
    .isNumeric()
    .withMessage('Budget must be a number')
    .isFloat({ min: 0 })
    .withMessage('Budget must be non-negative'),

  body('venue')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Venue must be less than 100 characters'),

  handleValidationErrors
];

// Bill creation validation
const validateBillCreation = [
  body('event')
    .isMongoId()
    .withMessage('Valid event ID is required'),

  body('vendor')
    .trim()
    .notEmpty()
    .withMessage('Vendor name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Vendor name must be between 1 and 100 characters'),

  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0 })
    .withMessage('Amount must be non-negative'),

  body('gstAmount')
    .optional()
    .isNumeric()
    .withMessage('GST amount must be a number')
    .isFloat({ min: 0 })
    .withMessage('GST amount must be non-negative'),

  body('paidBy')
    .isIn(['company', 'self', 'own'])
    .withMessage('Paid by must be company, self, or own'),

  body('paymentType')
    .isIn(['full', 'token'])
    .withMessage('Payment type must be full or token'),

  handleValidationErrors
];

// User creation validation
const validateUserCreation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Name must be between 1 and 50 characters'),

  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),

  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number is required'),

  body('role')
    .isIn(['director', 'teamLeader', 'employee', 'organizer'])
    .withMessage('Role must be director, teamLeader, employee, or organizer'),

  handleValidationErrors
];

module.exports = {
  validateEventCreation,
  validateBillCreation,
  validateUserCreation,
  handleValidationErrors
};