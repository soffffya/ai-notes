import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

const OPENAI_KEY_STORAGE = 'openaiApiKey';

type SettingsDialogProps = {
  email: string;
  onLogout: () => void;
  onOpenChange: (open: boolean) => void;
  onSaveApiKey: (value: string) => void;
  open: boolean;
};

export default function SettingsDialog({
  email,
  onLogout,
  onOpenChange,
  onSaveApiKey,
  open,
}: SettingsDialogProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    setApiKey(localStorage.getItem(OPENAI_KEY_STORAGE) ?? '');
  }, [open]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription>{t('settings.description')}</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-5">
          <Card className="bg-muted/60 shadow-none">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground">{t('settings.currentAccount')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{email}</p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between rounded-[22px] bg-muted p-4">
            <div>
              <Label htmlFor="theme-toggle">{t('settings.darkTheme')}</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('settings.darkThemeDescription')}
              </p>
            </div>
            <Switch
              checked={resolvedTheme === 'dark'}
              id="theme-toggle"
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="language-select">{t('settings.language')}</Label>
            <Select
              id="language-select"
              onChange={(event) => void i18n.changeLanguage(event.target.value)}
              value={i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'ru'}
            >
              <option value="ru">{t('settings.languageRu')}</option>
              <option value="en">{t('settings.languageEn')}</option>
            </Select>
            <p className="text-xs text-muted-foreground">{t('settings.languageDescription')}</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="openai-key">{t('settings.openAiKey')}</Label>
            <Input
              id="openai-key"
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              type="password"
              value={apiKey}
            />
            <p className="text-xs text-muted-foreground">
              {t('settings.openAiKeyDescription')}
            </p>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button onClick={onLogout} type="button" variant="ghost">
            {t('settings.logout')}
          </Button>
          <Button
            onClick={() => {
              onSaveApiKey(apiKey);
            }}
            type="button"
            variant="outline"
          >
            {t('settings.saveKey')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
