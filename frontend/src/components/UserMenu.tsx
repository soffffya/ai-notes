import { Button } from '@/components/ui/button';

type UserMenuProps = {
  email: string;
  onLogout: () => void;
};

export default function UserMenu({ email, onLogout }: UserMenuProps) {
  return (
    <div className="rounded-[24px] border border-border/70 bg-white/85 p-5 shadow-soft backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-secondary-foreground">
            Аккаунт
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">{email}</p>
        </div>
        <Button onClick={onLogout} size="sm" type="button" variant="outline">
          Выйти
        </Button>
      </div>
    </div>
  );
}
