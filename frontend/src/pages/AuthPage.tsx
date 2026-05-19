import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod/v3';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';

type AuthFormValues = {
  email: string;
  password: string;
};

export default function AuthPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { t } = useTranslation();
  const authSchema = z.object({
    email: z.string().email(t('auth.validation.email')),
    password: z.string().min(8, t('auth.validation.password')),
  });
  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onSubmit',
  });

  async function onSubmit(values: AuthFormValues) {
    form.clearErrors('root');

    try {
      if (auth.mode === 'login') {
        await auth.login(values.email, values.password);
      } else {
        await auth.register(values.email, values.password);
      }

      await navigate('/');
    } catch (error) {
      form.setError('root', {
        message: error instanceof Error ? error.message : t('auth.errors.fallback'),
      });
    }
  }

  function switchMode(mode: 'login' | 'register') {
    form.clearErrors();
    auth.setMode(mode);
  }

  return (
    <main className="container flex min-h-screen items-center justify-center py-12">
      <section className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/80 bg-card/95 p-8 shadow-soft">
          <CardContent className="p-0">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-secondary-foreground">
              {t('auth.badge')}
            </p>
            <h1 className="max-w-[10ch] text-[clamp(2.4rem,5vw,4.4rem)] font-semibold leading-[0.95]">
              {t('auth.heroTitle')}
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              {t('auth.heroDescription')}
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[20px] border border-border/70 bg-secondary/80 p-4">
                <p className="text-sm font-semibold">{t('auth.fastInputTitle')}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('auth.fastInputDescription')}
                </p>
              </div>
              <div className="rounded-[20px] border border-border/70 bg-muted/80 p-4">
                <p className="text-sm font-semibold">{t('auth.confidenceTitle')}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('auth.confidenceDescription')}
                </p>
              </div>
              <div className="rounded-[20px] border border-border/70 bg-accent/80 p-4">
                <p className="text-sm font-semibold">{t('auth.undoTitle')}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('auth.undoDescription')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 p-8 shadow-soft">
          <CardContent className="p-0">
            <Tabs
              onValueChange={(value) => switchMode(value as 'login' | 'register')}
              value={auth.mode}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t('auth.loginTab')}</TabsTrigger>
                <TabsTrigger value="register">{t('auth.registerTab')}</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mt-6">
              <h2 className="text-2xl font-semibold">
                {auth.mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {auth.mode === 'login'
                  ? t('auth.loginDescription')
                  : t('auth.registerDescription')}
              </p>
            </div>

            <form className="mt-8" noValidate onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup>
                <Controller
                  control={form.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>{t('auth.email')}</FieldLabel>
                      <Input
                        {...field}
                        autoComplete="email"
                        id={field.name}
                        placeholder="you@example.com"
                        type="email"
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldDescription>{t('auth.emailHint')}</FieldDescription>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                <Controller
                  control={form.control}
                  name="password"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>{t('auth.password')}</FieldLabel>
                      <Input
                        {...field}
                        autoComplete={auth.mode === 'login' ? 'current-password' : 'new-password'}
                        id={field.name}
                        placeholder={t('auth.passwordPlaceholder')}
                        type="password"
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldDescription>
                        {auth.mode === 'login'
                          ? t('auth.passwordHintLogin')
                          : t('auth.passwordHintRegister')}
                      </FieldDescription>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                <FieldError errors={[form.formState.errors.root]} />

                <Button className="w-full" disabled={auth.isLoading} type="submit">
                  {auth.isLoading
                    ? t('auth.submitLoading')
                    : auth.mode === 'login'
                      ? t('auth.submitLogin')
                      : t('auth.submitRegister')}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
