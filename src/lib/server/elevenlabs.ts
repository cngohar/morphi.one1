import { ELEVENLABS_API_KEY } from '$app/env/private';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export const elevenlabs = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });
