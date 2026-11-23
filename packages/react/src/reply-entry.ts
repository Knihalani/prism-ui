import { createContext } from 'react';

export const ReplyEntryContext = createContext<{ history: boolean; index: number } | undefined>(undefined);
