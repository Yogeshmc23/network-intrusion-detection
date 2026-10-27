import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import User from '../models/User';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const authRouter = Router();

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['admin', 'analyst']).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * @openapi
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: analyst@cybershield.local
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *               name:
 *                 type: string
 *                 example: Security Analyst
 *               role:
 *                 type: string
 *                 enum: [admin, analyst]
 *                 default: analyst
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already in use
 */
authRouter.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = signupSchema.parse(req.body);

    const existingUser = await User.findOne({ email: validated.email });
    if (existingUser) {
      throw new AppError('An account with this email already exists', 409);
    }

    const user = new User({
      email: validated.email,
      password: validated.password,
      name: validated.name,
      role: validated.role || 'analyst',
    });

    await user.save();

    const tokenPayload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user & retrieve access tokens
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: analyst@cybershield.local
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid email or password
 */
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = loginSchema.parse(req.body);

    const user = await User.findOne({ email: validated.email });
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isMatch = await user.comparePassword(validated.password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    const tokenPayload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh expired access token with valid refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsIn...
 *     responses:
 *       200:
 *         description: New tokens generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 accessToken: { type: string }
 *                 refreshToken: { type: string }
 *       401:
 *         description: Invalid or expired refresh token
 */
authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = refreshSchema.parse(req.body);

    let decoded;
    try {
      decoded = verifyRefreshToken(validated.refreshToken);
    } catch (err) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      throw new AppError('User belonging to this token no longer exists', 401);
    }

    const tokenPayload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get profile of authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 user: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Unauthorized
 */
authRouter.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default authRouter;
