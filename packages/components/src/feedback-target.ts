import { createContext, useContext } from 'react';

export const FeedbackTarget = createContext<((target: HTMLDivElement | null) => void) | undefined>(undefined);
export function useFeedbackTarget() { return useContext(FeedbackTarget); }
