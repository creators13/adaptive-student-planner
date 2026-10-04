/* Small building blocks shared by every screen: buttons and labelled form fields. */
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface ButtonProps {
  children?: ReactNode;
  kind?: 'primary' | 'secondary' | 'danger';
  small?: boolean;
  icon?: IconName;
  aria?: string;
  id?: string;
  title?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export function Button({ children, kind = 'secondary', small, icon, aria, id, title, disabled, onClick }: ButtonProps) {
  return (
    <button type="button" className={'btn btn-' + kind + (small ? ' btn-sm' : '')} id={id} title={title} disabled={disabled} aria-label={aria} onClick={onClick}>
      {icon ? <Icon name={icon} size={15} /> : null}
      {children != null && children !== '' ? <span>{children}</span> : null}
    </button>
  );
}

// A labelled form field. The control gets the field's id unless it already has one.
export function Field({ label, hint, children }: { label: string; hint?: string | null; children: ReactElement<{ id?: string }> }) {
  const auto = useId();
  const id = (isValidElement(children) && children.props.id) || auto;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}
