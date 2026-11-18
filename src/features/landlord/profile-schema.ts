import { z } from 'zod'

/** Shared by onboarding and Settings. */
export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(100),
  displayName: z
    .string()
    .trim()
    .max(60, 'Keep it under 60 characters')
    .refine((v) => v === '' || v.length >= 2, 'Enter at least 2 characters, or leave it blank'),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address, e.g. name@gmail.com')),
})

export type ProfileForm = z.infer<typeof profileSchema>
