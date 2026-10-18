import { verifyToken, createClerkClient } from '@clerk/backend';
import { createSessionVerifier } from './session.js';
export const verifySession = createSessionVerifier({ verifyToken, createClerkClient });
