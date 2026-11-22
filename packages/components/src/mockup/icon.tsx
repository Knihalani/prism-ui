import { Icon, type IconName } from '@prism-ui/react';
export function MockupIcon({ name }: { name: IconName | 'source' }) { return <Icon name={name === 'source' ? 'code' : name} />; }
