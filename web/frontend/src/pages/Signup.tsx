import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import { Shield, Lock, Mail, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/apiErrors';
import { useToast } from '@/components/ui/toast';

const signupSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export default function Signup() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setLoading(true);
    try {
      const res = await authApi.signup({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      setAuth(res.user, res.accessToken, res.refreshToken);
      toast({
        title: 'Account Created',
        description: `Welcome to CyberShield IDS, ${res.user.name}!`,
        variant: 'success',
      });
      navigate('/dashboard');
    } catch (err) {
      // Do not invent a session when registration fails (duplicate email,
      // validation error, outage, ...): fake tokens would immediately 401 and
      // bounce the analyst back to this page.
      toast({
        title: 'Registration failed',
        description: getApiErrorMessage(err, 'Could not create your analyst account.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="border-white/10 bg-slate-900/80 shadow-2xl backdrop-blur-2xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500 shadow-lg shadow-cyan-500/30">
              <Shield className="h-7 w-7 text-slate-950 font-black" />
            </div>
            <CardTitle className="justify-center text-2xl font-bold tracking-tight text-white">
              Create Analyst Account
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-1">
              Join the CyberShield Threat Intelligence SOC
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Full Name</label>
                <Input
                  placeholder="Alex Mercer"
                  icon={<User className="h-4 w-4" />}
                  {...register('name')}
                />
                {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Email Address</label>
                <Input
                  type="email"
                  placeholder="analyst@domain.com"
                  icon={<Mail className="h-4 w-4" />}
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
              </div>

              <div className="space-y-1">
                <label htmlFor="signup-password" className="text-xs font-medium text-slate-300">Password</label>
                <div className="relative"><Input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  icon={<Lock className="h-4 w-4" />}
                  className="pr-11"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'signup-password-error' : undefined}
                  {...register('password')}
                /><button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                {errors.password && <p id="signup-password-error" role="alert" className="text-xs text-red-400">{errors.password.message}</p>}
              </div>

              <div className="space-y-1">
                <label htmlFor="signup-confirm-password" className="text-xs font-medium text-slate-300">Confirm Password</label>
                <div className="relative"><Input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  icon={<Lock className="h-4 w-4" />}
                  className="pr-11"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={errors.confirmPassword ? 'signup-confirm-error' : undefined}
                  {...register('confirmPassword')}
                /><button type="button" className="password-toggle" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword}>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                {errors.confirmPassword && (
                  <p id="signup-confirm-error" role="alert" className="text-xs text-red-400">{errors.confirmPassword.message}</p>
                )}
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full font-semibold" isLoading={loading}>
                  Initialize Access <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-white/5 py-4">
            <p className="text-xs text-slate-400">
              Already have an operator account?{' '}
              <Link to="/login" className="text-cyan-400 font-semibold hover:underline">
                Sign in here
              </Link>
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
