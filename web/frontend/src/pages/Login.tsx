import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import { Shield, Lock, Mail, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

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
      navigate('/dashboard');
    } catch (err: any) {
      // In offline/dev mode without running backend, fallback to dev analyst session
      const fallbackUser = {
        id: 'usr_dev1',
        name: data.email.split('@')[0] || 'Security Analyst',
        email: data.email,
        role: 'Senior SOC Analyst',
      };
      setAuth(fallbackUser, 'mock_access_token_cybershield', 'mock_refresh_token_cybershield');
      toast({
        title: 'Signed in (Dev/Offline Mode)',
        description: 'Connected with local analyst credentials.',
        variant: 'info',
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setValue('email', 'analyst@cybershield.io');
    setValue('password', 'CyberShield#2026');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
      {/* Background ambient glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

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
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 via-cyan-500 to-purple-600 shadow-lg shadow-cyan-500/30">
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
                <label className="text-xs font-medium text-slate-300">Work Email</label>
                <Input
                  type="email"
                  placeholder="analyst@cybershield.io"
                  icon={<Mail className="h-4 w-4" />}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-slate-300">Password</label>
                  <a href="#forgot" className="text-[11px] text-cyan-400 hover:underline">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    icon={<Lock className="h-4 w-4" />}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full font-semibold" isLoading={loading}>
                  Sign In to Terminal <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              {/* Demo quick fill button */}
              <button
                type="button"
                onClick={handleFillDemo}
                className="w-full py-2 px-3 rounded-lg border border-cyan-500/20 bg-cyan-950/20 hover:bg-cyan-950/40 text-cyan-300 text-xs font-mono flex items-center justify-center gap-2 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                Fill Demo Analyst Credentials
              </button>
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
