const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    HttpOnly: true,
    secure: true,
    sameSite: 'None',
  };

  // remove password from output(response)
  user.password = undefined;

  res.cookie('jwt', token, cookieOptions);

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = async (req, res, next) => {
  try {
    const newUser = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      passwordChangedAt: req.body.passwordChangedAt,
      role: req.body.role,
    });

    createSendToken(newUser, 201, req, res);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password!', 400));
    }

    // 2) Check if user exist & password is correct
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.correctPassword(password, user.password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    // 3) If everything ok, send token to client
    createSendToken(user, 200, req, res);
  } catch (err) {
    next(err);
  }
};

exports.logout = (req, res) => {
  res.clearCookie('jwt', {
    HttpOnly: true,
    secure: true,
    sameSite: 'None',
  });
  res.status(200).json({
    status: 'success',
  });
};

exports.protect = async (req, res, next) => {
  try {
    // 1) Getting token and check if it's there
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      // res.redirect('/');
      return next(
        new AppError('You are not logged in! Please log in to get access', 401),
      );
    }

    // 2) Verification token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user still exist
    const currentUser = await User.findById(decoded.id);
    if (!currentUser)
      return next(
        new AppError(
          'The user belonging to the token does not exist anymore',
          401,
        ),
      );

    // 4) Check if user change password after the JWT was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError(
          'User recently changed password! Please log in again',
          401,
        ),
      );
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    next();
  } catch (err) {
    next(err);
  }
};

exports.getUserInfo = async (req, res, next, dataForRoute = false) => {
  try {
    // 1) Getting token and check if it's there
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      // res.redirect('/');
      return next(
        new AppError('You are not logged in! Please log in to get access', 401),
      );
    }

    // 2) Verification token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user still exist
    const currentUser = await User.findById(decoded.id);
    if (!currentUser)
      return next(
        new AppError(
          'The user belonging to the token does not exist anymore',
          401,
        ),
      );

    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next();
    }

    if (dataForRoute) return currentUser;

    res.status(200).json({
      status: 'success',
      data: {
        currentUser,
      },
    });
  } catch (err) {
    next(err);
  }
};

// exports.isLoggedIn = async (req, res, next) => {
//   if (req.cookies.jwt) {
//     try {
//       // 1) verify token
//       const decoded = await promisify(jwt.verify)(
//         req.cookies.jwt,
//         process.env.JWT_SECRET,
//       );

//       // 2) Check if user still exists
//       const currentUser = await User.findById(decoded.id);
//       if (!currentUser) {
//         return next();
//       }

//       // 3) Check if user changed password after the token was issued
//       if (currentUser.changedPasswordAfter(decoded.iat)) {
//         return next();
//       }

//       // THERE IS A LOGGED IN USER
//       // res.locals.user = currentUser;

//       res.status(200).json({
//         status: 'success',
//         data: {
//           currentUser,
//         },
//       });
//     } catch (err) {
//       next(err);
//     }
//   }
//   next();
// };

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }

    next();
  };

exports.forgotPassword = async (req, res, next) => {
  try {
    // 1) Get user base on posted email
    const user = await User.findOne({ email: req.body.email });
    if (!user)
      return next(
        new AppError('There is no user with this email address', 404),
      );

    // 2) Generate random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateModifiedOnly: true });

    // 3) Send it to user's email
    const resetURL = `${req.protocol}://${req.get('host')}/api/users/resetPassword/${resetToken}`;

    const message = `Forgot your password? Submit a PATCH request with your new password and passwordCOnfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Your password reset token (valid for 5 min)',
        message,
      });

      res.status(200).json({
        status: 'success',
        message: 'Token sent to email',
      });
    } catch (err) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateModifiedOnly: true });

      return next(
        new AppError(
          'There was an error sending the email. Try again later',
          500,
        ),
      );
    }
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    // 1) Get user base on the token
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    // 2) If token has not expired and there is user, set the new password
    if (!user)
      return next(new AppError('Token is invalid or has expired', 400));
    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // 3) Update passwordChangedAt property for the user

    // 4) Log the user in, send JWT
    createSendToken(user, 200, req, res);
  } catch (err) {
    next(err);
  }
};

exports.updatePassword = async (req, res, next) => {
  try {
    // 1) Get user from collection
    const user = await User.findById(req.user.id).select('+password');

    // 2) Check if posted current password is correct
    if (!(await user.correctPassword(req.body.passwordCurrent, user.password)))
      return next(new AppError('Your current password is worng', 401));

    // 3) If so, update password
    user.password = req.body.password;
    await user.save();

    // 4) Log user in, send JWT
    createSendToken(user, 200, req, res);
  } catch (err) {
    next(err);
  }
};
