const { z } = require('zod');

// Strong credential policy: 12+ chars, at least one uppercase,
// one lowercase, one digit, one special character.
const strongCredential = z
  .string()
  .min(12, 'credential must be at least 12 characters')
  .regex(/[a-z]/, 'credential must contain a lowercase letter')
  .regex(/[A-Z]/, 'credential must contain an uppercase letter')
  .regex(/[0-9]/, 'credential must contain a digit')
  .regex(/[^a-zA-Z0-9]/, 'credential must contain a special character');

const createIdentitySchema = z.object({
  name: z.string().min(1).max(100),
  credential: strongCredential,
  role: z.enum(['admin', 'service', 'user']),
});

const loginSchema = z.object({
  name: z.string().min(1),
  credential: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const createSecretSchema = z.object({
  name: z.string().min(1).max(200),
  tag: z.string().min(1).max(100),
  value: z.string().min(1),
});

const updateSecretSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    tag: z.string().min(1).max(100).optional(),
    value: z.string().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one of name, tag, or value must be provided',
  });

const createPolicySchema = z.object({
  role: z.string().min(1).max(50),
  resourceTag: z.string().min(1).max(100),
  action: z.string().min(1).max(50),
  effect: z.enum(['allow', 'deny']),
});

module.exports = {
  createIdentitySchema,
  loginSchema,
  refreshSchema,
  createSecretSchema,
  updateSecretSchema,
  createPolicySchema,
};
