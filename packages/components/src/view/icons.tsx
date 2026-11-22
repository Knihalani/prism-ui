import type { SVGProps } from 'react';
import { Icon, iconNames, type IconName } from '@prism-ui/react';
export { iconNames };
const aliases: Record<string, IconName> = { x: 'close', time: 'clock', money: 'dollar', location: 'map-pin', warning: 'warning', delete: 'trash', pencil: 'edit' };
export function ViewIcon({ name, className, label, ...props }: { name: string; label?: string } & SVGProps<SVGSVGElement>) {
  return <Icon {...props} name={aliases[name] ?? name as IconName} className={className} width="1em" height="1em" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} data-icon={name} />;
}
