import {ProviderError} from '../domain/provider-error';
import type {VideoScene} from '../domain/video-plan';
import type {SelectedVideo} from './select-video-file';

export async function reviewClip(
  scene: Pick<VideoScene, 'id' | 'visualIntent' | 'requiredVisualObjects'>,
  clip: Pick<SelectedVideo, 'sourcePageUrl' | 'downloadUrl'>,
  ask: (question: string) => Promise<string>,
  log: (message: string) => void,
): Promise<boolean> {
  log(`\nScene ${scene.id}: ${scene.visualIntent}`);
  log(`Required objects: ${(scene.requiredVisualObjects ?? []).join(', ') || scene.visualIntent}`);
  log(`Pexels page: ${clip.sourcePageUrl}`);
  log(`Video preview: ${clip.downloadUrl}`);
  while (true) {
    const answer = (await ask('Open the preview. Does it show the required object/action? [y/n/q] ')).trim().toLowerCase();
    if (answer === 'y' || answer === 'yes') return true;
    if (answer === 'n' || answer === 'no') return false;
    if (answer === 'q' || answer === 'quit') {
      const detail = 'Footage review stopped. No unapproved clip will be used.';
      throw new ProviderError(detail, {provider: 'pexels', kind: 'validation', detail});
    }
    log('Enter y to accept, n to skip, or q to stop.');
  }
}
