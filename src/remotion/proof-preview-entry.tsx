import {Composition, registerRoot} from 'remotion';
import {ProofPreview, type ProofPreviewProps} from './ProofPreview';

const defaults: ProofPreviewProps = {source: '', trimStartSec: 0, cropPosition: '50% 50%', durationSec: 2};
registerRoot(() => <Composition id="ProofPreview" component={ProofPreview} width={360} height={640} fps={30}
  durationInFrames={60} defaultProps={defaults}
  calculateMetadata={({props}) => ({durationInFrames: Math.max(1, Math.round(props.durationSec * 30))})} />);
