import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import { Shield, Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/apiErrors';
import { useToast } from '@/components/ui/toast';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Return the analyst to the page that redirected them here (if any).
  const redirectTarget =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/dashboard';

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    try {
      const res = await authApi.login(data);
      setAuth(res.user, res.accessToken, res.refreshToken);
      toast({
        title: 'Authentication Successful',
        description: `Welcome back, ${res.user.name || 'Analyst'}!`,
        variant: 'success',
      });
      navigate(redirectTarget === '/login' ? '/dashboard' : redirectTarget, { replace: true });
    } catch (err) {
      // Never fabricate a session when the backend rejects the credentials:
      // fake tokens would 401 on every later request and log the user straight
      // back out. Surface the real error instead.
      toast({
        title: 'Sign in failed',
        description: getApiErrorMessage(err, 'Invalid email or password.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
      {/* Background ambient glowing orbs */}

      {/* Decorative grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#06b6d4 1px, transparent 1px), linear-gradient(to right, #06b6d4 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

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
              CyberShield <span className="text-cyan-400 font-mono text-lg">IDS</span>
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-1">
              Intelligent Network Intrusion & Threat Detection
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-xs font-medium text-slate-300">Work Email</label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  placeholder="analyst@cybershield.io"
                  icon={<Mail className="h-4 w-4" />}
                  {...register('email')}
                />
                {errors.email && (
                  <p id="login-email-error" role="alert" className="text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="login-password" className="text-xs font-medium text-slate-300">Password</label>
                  <span className="text-[11px] text-slate-400" title="Password reset is not available in this project">Password reset unavailable</span>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'login-password-error' : undefined}
                    className="pr-11"
                    placeholder="Enter your password"
                    icon={<Lock className="h-4 w-4" />}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="login-password-error" role="alert" className="text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full font-semibold" isLoading={loading}>
                  Sign In to Terminal <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-white/5 py-4">
            <p className="text-xs text-slate-400">
              Don't have an operator account?{' '}
              <Link to="/signup" className="text-cyan-400 font-semibold hover:underline">
                Register analyst
              </Link>
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
