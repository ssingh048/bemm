import jwt from 'jsonwebtoken';

// The JWT secret should be in environment variables in a real application
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '24h'; // Token expires in 24 hours

export function generateToken(user: any) {
  return jwt.sign(
    { 
      id: user.id,
      email: user.email,
      role: user.role 
    }, 
    JWT_SECRET, 
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    console.log('JWT successfully verified:', { id: decoded.id, role: decoded.role });
    return decoded;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}