import { registerComponent } from '@prism-ui/react';
import { artifact } from './artifact';

registerComponent(artifact);

export { Artifact, artifact } from './artifact';
export { artifactPlugin, artifactSchema, type ArtifactProps } from './model';
export { ArtifactProvider, useArtifact, artifactStrings } from './use-artifact';
export { defaultArtifactImports, type ArtifactKind, type ArtifactOptions } from './policy';

export type { ArtifactModel, ArtifactSlotProps } from './artifact';
