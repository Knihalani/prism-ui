import { registerComponent } from '@prism-ui/react';
import { artifact } from './artifact';
import '../feedback';

registerComponent(artifact);

export { Artifact, artifact } from './artifact';
export { artifactPlugin, artifactSchema, type ArtifactProps } from './model';
export { ArtifactProvider, useArtifact } from './use-artifact';
export { defaultArtifactImports, type ArtifactKind, type ArtifactOptions } from './policy';
