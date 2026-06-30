const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma } = require('../config/prisma');
const { env } = require('../config/env');
const { ApiError } = require('../utils/apiError');

function accessPayload(user) {
  return {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name
  };
}

function signAccessToken(user) {
  return jwt.sign(accessPayload(user), env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL });
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, tokenType: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: env.REFRESH_TOKEN_TTL });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new ApiError(401, 'Authentication required');
    }

    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive) {
      throw new ApiError(401, 'User account is inactive or missing');
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive
    };
    req.auth = payload;
    next();
  } catch (error) {
    next(error);
  }
}

function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action'));
    }
    next();
  };
}

function isRole(user, roles) {
  return Boolean(user && roles.includes(user.role));
}

module.exports = {
  requireAuth,
  authorize,
  isRole,
  signAccessToken,
  signRefreshToken,
  hashToken
};
