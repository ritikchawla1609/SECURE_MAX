import { z } from 'zod';
import { validationError } from './errors';

export const walletAuthSchema = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export const accessRequestSchema = z.object({
  asset_id: z.string().uuid(),
  operation: z.enum(['read', 'decrypt', 'transfer']),
  purpose: z.string().optional(),
});

export const assetRegistrationSchema = z.object({
  asset_code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  classification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'HIGH']),
  department: z.string().min(1),
});

export const keyRotationSchema = z.object({
  asset_id: z.string().uuid(),
});

/**
 * Validates a request object against a Zod schema
 * @param schema Zod schema
 * @param data Data to validate
 * @returns Validated data
 * @throws {SecureMaxError} If validation fails
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw validationError('Invalid request parameters', result.error.format());
  }
  return result.data;
}
